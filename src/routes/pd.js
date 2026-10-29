/**
 * Karta pacienta v PéčeDoma (od 0.11.65): portál PéčeDoma (Data klienta) otevře stránku /pd/ v rámu s podepsanou vstupenkou,
 * kterou vydá partnerské API (POST /api/partner/vstupenka – jen server PéčeDoma s partnerským klíčem, po ověření přihlášení
 * a role v portálu). Vstupenka platí 30 minut a nese: tenant, pacienta, jméno z portálu a zda je to lékař.
 *   GET  /api/pd/karta   Authorization: Pd <vstupenka>   → { pacient, balik (pasivní karta jako na zamčeném telefonu – bez PINů), plan, verze, lekar, kdo, interval }
 *   POST /api/pd/plan    Authorization: Pd <vstupenka>   { data, platnostDo, poznamka, typ: ZMENA|REVIZE }   jen lékař → nová verze plánu
 * Stránka ani vstupenka nedávají nic jiného: žádný deník k zápisu, žádné PINy, žádná správa.
 */
import { Router } from 'express';
import { config } from '../config.js';
import { vTenantu } from '../db.js';
import { h, chyba, omez, ip, text } from '../http.js';
import { overSession } from '../crypto.js';
import { audit, zapisDenik, balikProZarizeni, planAktualni, ulozPlan } from '../kp.js';

export const pd = Router();
const tenantRe = /^[A-Z0-9]{16}$/;

function vstupenka(req) {
  const hl = String(req.headers.authorization || '');
  if (!/^Pd /i.test(hl)) throw chyba('Chybí vstupenka z PéčeDoma', 401);
  const v = overSession(hl.slice(3).trim());
  if (!v || v.typ !== 'pd' || !tenantRe.test(v.tenant || '') || !v.pacientId) throw chyba('Vstupenka z PéčeDoma neplatí nebo vypršela – zavřete okno a otevřete Kartu pacienta znovu', 401);
  return { tenant: v.tenant, pacientId: Number(v.pacientId), kdo: String(v.kdo || 'lékař').slice(0, 100), lekar: v.lekar === true };
}

async function pacientVstupenky(q, v) {
  const p = await q.one(`SELECT PacientID, KodPrukazu, Jmeno, Prijmeni, Stav FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: v.pacientId });
  if (!p) throw chyba('Pacient v Kartě není', 404);
  return p;
}

pd.get('/karta', h(async (req) => {
  const v = vstupenka(req);
  omez('pd:' + ip(req), 600, 3600e3);
  return vTenantu(v.tenant, async (q) => {
    const p = await pacientVstupenky(q, v);
    const balik = await balikProZarizeni(q, p.PacientID, { rezim: 'ZAPUJCENY' });
    const verze = await q.all(`SELECT Verze AS verze, Typ AS typ, PodepsalJmeno AS podepsal, CONVERT(char(10), PlatnostDo, 23) AS platnostDo, CONVERT(char(16), Vytvoreno, 120) AS vytvoreno, Poznamka AS poznamka
      FROM dbo.A_KP_PlanVerze WHERE PacientID = @p ORDER BY Verze DESC`, { p: p.PacientID });
    const nast = await q.one(`SELECT Hodnota FROM dbo.A_KP_Nastaveni WHERE Klic = 'INTERVAL_REVIZE'`).catch(() => null);
    await audit(q, { kdo: 'PéčeDoma: ' + v.kdo, pacientId: p.PacientID, akce: 'náhled karty z PéčeDoma', detail: v.lekar ? 'lékař' : null, ip: ip(req) });
    // pasivní karta: to, co vidí kdokoli u zamčeného telefonu (krizová karta + deník), bez PINů a bez tajemství
    const { piny, ...pasivni } = balik || {};
    return { pacient: { id: p.PacientID, kod: p.KodPrukazu, jmeno: p.Jmeno, prijmeni: p.Prijmeni, stav: p.Stav }, balik: pasivni, plan: balik ? balik.plan : null, verze,
      lekar: v.lekar && p.Stav === 'AKTIVNI', kdo: v.kdo, interval: Math.min(12, Math.max(1, Number(nast && nast.Hodnota) || 3)), verejnaAdresa: config.verejnaAdresa };
  });
}));

pd.post('/plan', h(async (req) => {
  const v = vstupenka(req);
  omez('pd-plan:' + ip(req), 60, 3600e3);
  if (!v.lekar) throw chyba('Plán péče z PéčeDoma zapisuje jen lékař', 403);
  const b = req.body || {};
  const typ = b.typ === 'REVIZE' ? 'REVIZE' : 'ZMENA';
  return vTenantu(v.tenant, async (q) => {
    const p = await pacientVstupenky(q, v);
    if (p.Stav !== 'AKTIVNI') throw chyba('Průkaz je uzavřený – plán už nejde měnit');
    let data = b.data;
    if (typ === 'REVIZE' && !data) { const pl = await planAktualni(q, p.PacientID); data = pl ? pl.data : {}; }
    if (!data || typeof data !== 'object') throw chyba('Chybí data plánu');
    const platnost = /^\d{4}-\d{2}-\d{2}$/.test(b.platnostDo || '') ? b.platnostDo : null;
    const s = { uzivatelId: null, jmeno: 'PéčeDoma: ' + v.kdo };
    const verze = await ulozPlan(q, { pacientId: p.PacientID, data, platnostDo: platnost, s, typ, poznamka: text(b.poznamka, 500) || null });
    await zapisDenik(q, { pacientId: p.PacientID, typ: 'Revize', role: 'lekar', autor: s.jmeno,
      text: typ === 'REVIZE' ? `Plán péče revidován beze změny z PéčeDoma, platnost do ${platnost || '—'}.${b.poznamka ? ' ' + text(b.poznamka, 300) : ''}` : `Plán péče upraven z PéčeDoma (verze ${verze}).${b.poznamka ? ' ' + text(b.poznamka, 300) : ''}` });
    await audit(q, { kdo: s.jmeno, pacientId: p.PacientID, akce: typ === 'REVIZE' ? 'revize plánu z PéčeDoma' : 'změna plánu z PéčeDoma', detail: `verze ${verze}`, ip: ip(req) });
    return { verze };
  });
}));
