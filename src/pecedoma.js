/**
 * Propojení s PéčeDoma (od 0.7.0): Karta pacienta volá aplikaci pecedoma-karta na jhn-apps (server PéčeDoma).
 *   klienti(q)      seznam klientů poskytovatele pro výběr v průvodci Nový pacient
 *   klient(id)      export klienta (stejný JSON jako Data klienta → Export pro Kartu pacienta)
 *   sync(id)        aktivní léky a nejbližší plánovaná návštěva → A_KP_PdSync
 * Nastavení tenanta v A_KP_Nastaveni: PD_ODKAZ (adresa portálu pro uživatele), PD_API (server jhn-apps), PD_TOKEN (x-app-token
 * aplikace), PD_SYNC ('1' = synchronizovat automaticky). Server se PéčeDoma prokazuje i partnerským klíčem KP_PARTNER_KLIC.
 * Synchronizace plán péče nemění (plán = nová verze podepsaná lékařem); léky z PéčeDoma se ukazují vedle plánu a lékař je převezme.
 */
import { config } from './config.js';
import { vTenantu } from './db.js';
import { chyba } from './http.js';

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const PD_API_VYCHOZI = 'https://95-216-201-2.sslip.io';

/** Nastavení propojení pro tenant (q = dotazy v kontextu tenanta). */
export async function nastaveniPd(q) {
  const n = await q.all(`SELECT Klic, Hodnota FROM dbo.A_KP_Nastaveni WHERE Klic IN ('PD_ODKAZ', 'PD_API', 'PD_TOKEN', 'PD_SYNC')`);
  const m = Object.fromEntries(n.map((x) => [x.Klic, String(x.Hodnota || '').trim()]));
  return { odkaz: m.PD_ODKAZ || '', api: (m.PD_API || PD_API_VYCHOZI).replace(/\/+$/, ''), token: m.PD_TOKEN || '', sync: m.PD_SYNC === '1',
    nastaveno: !!(m.PD_TOKEN && config.partnerKlic) };
}

/** Volání aplikace pecedoma-karta na jhn-apps. */
export async function pdVolej(nast, akce, body = {}) {
  if (!nast.token) throw chyba('Propojení s PéčeDoma není nastavené – správce doplní token v Správa organizace → Nastavení', 400);
  if (!config.partnerKlic) throw chyba('Na serveru chybí KP_PARTNER_KLIC (nasazení deploy/vps-deploy.sh)', 500);
  let r, d;
  try {
    r = await fetch(`${nast.api}/api/apps/pecedoma-karta`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-token': nast.token },
      body: JSON.stringify({ akce, klic: config.partnerKlic, ...body }), signal: AbortSignal.timeout(20000) });
    d = await r.json();
  } catch (e) { throw chyba('Server PéčeDoma neodpovídá: ' + String(e && e.message || e).slice(0, 120), 502); }
  const v = d && d.result !== undefined ? d.result : d;
  if (!r.ok || (d && d.ok === false) || (v && v.ok === false)) throw chyba('PéčeDoma: ' + ((d && (d.error || d.chyba)) || (v && v.chyba) || ('chyba ' + r.status)), r.status >= 400 && r.status < 500 ? r.status : 502);
  return v || {};
}

/** Odpověď akce sync → řádek A_KP_PdSync (JSON texty, datum, kdo, poznámka). */
export function normalizujSync(d = {}) {
  const pole = (v) => (Array.isArray(v) ? v : []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 60).map((x) => x.slice(0, 300));
  const l = d.leky || {};
  const n = d.pristiNavsteva || null;
  const kdy = n && /^\d{4}-\d{2}-\d{2}/.test(String(n.kdy || '')) ? String(n.kdy).replace('T', ' ').slice(0, 16) : null;
  const kdo = n ? [n.lekar ? 'lékař ' + n.lekar : '', n.sestra ? 'sestra ' + n.sestra : ''].filter(Boolean).join(', ').slice(0, 200) : '';
  const pozn = n ? [n.sluzba, n.stav, n.misto].map((x) => String(x || '').trim()).filter(Boolean).join(' · ').slice(0, 300) : '';
  return { sos: pole(l.sos), opioidy: pole(l.opioidy), medikace: pole(l.medikace), pristiNavsteva: kdy, pristiKdo: kdo || null, pristiPozn: pozn || null,
    vPeceDoma: !!l.vPeceDoma, kalendarChyba: d.kalendarChyba ? String(d.kalendarChyba).slice(0, 200) : null, portalKlientId: Number((d.klient || {}).portalKlientId) || null };
}

/** Synchronizace jednoho pacienta (v kontextu tenanta). Vrátí uložený stav; chybu zapíše do A_KP_PdSync.Chyba a vyhodí ji dál. */
export async function synchronizujPacienta(q, nast, pacientId, pdKlientId) {
  if (!UUID.test(String(pdKlientId || ''))) throw chyba('Pacient není propojený s klientem PéčeDoma', 400);
  const uloz = (v, chybaText) => q.exec(`MERGE dbo.A_KP_PdSync AS t USING (SELECT @p AS PacientID) AS s ON t.PacientID = s.PacientID
      WHEN MATCHED THEN UPDATE SET Sos = @sos, Opioidy = @opi, Medikace = @med, PristiNavsteva = @pn, PristiKdo = @pk, PristiPozn = @pp, Aktualizovano = SYSDATETIME(), Chyba = @ch
      WHEN NOT MATCHED THEN INSERT (PacientID, Sos, Opioidy, Medikace, PristiNavsteva, PristiKdo, PristiPozn, Chyba) VALUES (@p, @sos, @opi, @med, @pn, @pk, @pp, @ch);`,
  { p: pacientId, sos: v ? JSON.stringify(v.sos) : null, opi: v ? JSON.stringify(v.opioidy) : null, med: v ? JSON.stringify(v.medikace) : null, pn: v ? v.pristiNavsteva : null, pk: v ? v.pristiKdo : null, pp: v ? v.pristiPozn : null, ch: chybaText });
  let d;
  try { d = await pdVolej(nast, 'sync', { klientId: String(pdKlientId).toLowerCase() }); }
  catch (e) {
    // při chybě zůstanou poslední dobrá data, jen se poznamená chyba (když řádek ještě není, založí se prázdný)
    const je = await q.one(`SELECT PacientID FROM dbo.A_KP_PdSync WHERE PacientID = @p`, { p: pacientId });
    if (je) await q.exec(`UPDATE dbo.A_KP_PdSync SET Chyba = @ch, Aktualizovano = SYSDATETIME() WHERE PacientID = @p`, { ch: String(e.message || e).slice(0, 300), p: pacientId });
    else await uloz(null, String(e.message || e).slice(0, 300));
    throw e;
  }
  const v = normalizujSync(d);
  await uloz(v, v.kalendarChyba);
  if (v.portalKlientId) await q.exec(`UPDATE dbo.A_KP_Pacient SET PdPortalKlientID = @k WHERE PacientID = @p AND PdPortalKlientID IS NULL`, { k: v.portalKlientId, p: pacientId });
  return v;
}

/** Chat PéčeDoma s klientem (od 0.8.0): zprávy A_MSPPP_Zprava přes pecedoma-karta. Zprávy z Karty nesou značku „[Karta · kdo]“. */
export async function zpravyPd(nast, pdKlientId) {
  if (!UUID.test(String(pdKlientId || ''))) throw chyba('Pacient není propojený s klientem PéčeDoma', 400);
  const r = await pdVolej(nast, 'zpravy', { klientId: String(pdKlientId).toLowerCase() });
  return { zpravy: Array.isArray(r.zpravy) ? r.zpravy : [], portalKlientId: r.portalKlientId || null };
}
export async function posliZpravuPd(nast, pdKlientId, { text, smer, kdo }) {
  if (!UUID.test(String(pdKlientId || ''))) throw chyba('Pacient není propojený s klientem PéčeDoma', 400);
  const t = String(text || '').trim().slice(0, 4000);
  if (!t) throw chyba('Napište text zprávy', 400);
  const r = await pdVolej(nast, 'zprava', { klientId: String(pdKlientId).toLowerCase(), text: t, smer: smer === 'OD_PACIENTA' ? 'OD_PACIENTA' : 'OD_TYMU', kdo: String(kdo || '').slice(0, 100) });
  return { zpravy: Array.isArray(r.zpravy) ? r.zpravy : [], portalKlientId: r.portalKlientId || null };
}

/** Záznamy pacienta z Mého průkazu (přání, poznámky, otázky; od 0.11.28) → PéčeDoma, Data klienta → Z Karty pacienta (A_MSPPP_KartaZaznam).
 *  Vrací počet nově uložených (PéčeDoma stejný text znovu neukládá). Identita pacienta jde jen jako ID klienta PéčeDoma, které portál už zná. */
export const DRUHY_PRO_PD = ['PRANI', 'POZNAMKA', 'OTAZKY', 'ZHORSENI'];
export const TYPY_ZHORSENI = ['Zhoršení stavu', 'Stav stabilizován'];
/** Zápisy o zhoršení (a stabilizaci) z deníku → PéčeDoma jako druh ZHORSENI (historie zhoršení v Data klienta → Z Karty pacienta). Nikdy neshodí zápis do deníku. */
export async function predejZhorseniPd(q, pacientId, zapisy, { audit = null, ip = null } = {}) {
  const z = (Array.isArray(zapisy) ? zapisy : []).filter((x) => TYPY_ZHORSENI.includes(x.typ) && x.text);
  if (!z.length) return false;
  try {
    const p = await q.one(`SELECT LOWER(CONVERT(char(36), PdKlientID)) AS pd FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: pacientId });
    if (!p || !p.pd) return false;
    const nast = await nastaveniPd(q);
    if (!nast.nastaveno) return false;
    const polozky = z.map((x) => ({ druh: 'ZHORSENI', nazev: x.typ, obsah: `${x.typ}: ${x.text}`, puvod: `${x.autor || 'tým'} (Karta pacienta${x.role ? ', ' + x.role : ''})`, aktualizovano: x.cas || null }));
    const r = await zaznamyPd(nast, p.pd, polozky);
    if (audit && r.ulozeno) await audit(q, { pacientId, kdo: z[0].autor || 'Karta', akce: 'PéčeDoma: zhoršení předáno', detail: z.map((x) => x.typ).join(', '), ip });
    return true;
  } catch (e) {
    if (audit) await audit(q, { pacientId, kdo: 'Karta', akce: 'PéčeDoma: předání zhoršení selhalo', detail: String(e && e.message || e).slice(0, 300), ip }).catch(() => {});
    return false;
  }
}
export async function zaznamyPd(nast, pdKlientId, polozky) {
  if (!UUID.test(String(pdKlientId || ''))) throw chyba('Pacient není propojený s klientem PéčeDoma', 400);
  const p = (Array.isArray(polozky) ? polozky : []).filter((x) => DRUHY_PRO_PD.includes(x.druh) && x.obsah).slice(0, 10)
    .map((x) => ({ druh: x.druh, nazev: String(x.nazev || '').slice(0, 150), text: String(x.obsah || '').slice(0, 8000), puvod: String(x.puvod || '').slice(0, 200), aktualizovano: x.aktualizovano || null }));
  if (!p.length) return { ulozeno: 0 };
  const r = await pdVolej(nast, 'zaznam', { klientId: String(pdKlientId).toLowerCase(), polozky: p });
  return { ulozeno: Number(r.ulozeno) || 0, portalKlientId: r.portalKlientId || null };
}

/** Léky klienta v PéčeDoma (od 0.9.0) – jedna agenda: Karta je čte i mění přímo v A_MSPPP_Medikace přes pecedoma-karta. */
/** Uživatelé portálu PéčeDoma i s telefony (akce uzivatele) – telefony vede jen portál (CLB1), kopie tabulky v PeceDomaPlus je bez nich. */
export async function uzivatelePd(nast) {
  const r = await pdVolej(nast, 'uzivatele', {});
  return (Array.isArray(r.uzivatele) ? r.uzivatele : []).map((u) => ({ id: Number(u.id), jmeno: String(u.jmeno || ''), role: String(u.role || ''), telefon: String(u.telefon || ''), login: String(u.login || '') }));
}
export async function lekyPd(nast, pdKlientId) {
  if (!UUID.test(String(pdKlientId || ''))) throw chyba('Pacient není propojený s klientem PéčeDoma', 400);
  const r = await pdVolej(nast, 'leky', { klientId: String(pdKlientId).toLowerCase() });
  return { leky: Array.isArray(r.leky) ? r.leky : [], portalKlientId: r.portalKlientId || null };
}
export async function ulozLekPd(nast, pdKlientId, lek, kdo) {
  if (!UUID.test(String(pdKlientId || ''))) throw chyba('Pacient není propojený s klientem PéčeDoma', 400);
  const r = await pdVolej(nast, 'lek-uloz', { klientId: String(pdKlientId).toLowerCase(), lek, kdo: String(kdo || '').slice(0, 100) });
  return { leky: Array.isArray(r.leky) ? r.leky : [] };
}
export async function smazLekPd(nast, pdKlientId, lekId, kdo) {
  if (!UUID.test(String(pdKlientId || ''))) throw chyba('Pacient není propojený s klientem PéčeDoma', 400);
  const r = await pdVolej(nast, 'lek-smaz', { klientId: String(pdKlientId).toLowerCase(), lekId: String(lekId), kdo: String(kdo || '').slice(0, 100) });
  return { leky: Array.isArray(r.leky) ? r.leky : [] };
}

/** Stav synchronizace pacienta pro detail a balík telefonu. */
export async function stavSync(q, pacientId) {
  const r = await q.one(`SELECT Sos, Opioidy, Medikace, CONVERT(char(16), PristiNavsteva, 120) AS pristiNavsteva, PristiKdo AS pristiKdo, PristiPozn AS pristiPozn,
      CONVERT(char(16), Aktualizovano, 120) AS aktualizovano, Chyba AS chyba FROM dbo.A_KP_PdSync WHERE PacientID = @p`, { p: pacientId });
  if (!r) return null;
  const js = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
  return { sos: js(r.Sos), opioidy: js(r.Opioidy), medikace: js(r.Medikace), pristiNavsteva: r.pristiNavsteva, pristiKdo: r.pristiKdo, pristiPozn: r.pristiPozn, aktualizovano: r.aktualizovano, chyba: r.chyba };
}

/** Automatická synchronizace všech propojených pacientů v tenantech, které ji mají zapnutou (PD_SYNC = 1). */
export async function synchronizujVse(log = console.log) {
  if (!config.partnerKlic) return { tenantu: 0, pacientu: 0, chyb: 0 };
  // seznam tenantů se zapnutou synchronizací – jen tady je potřeba kontext správce (všechna nastavení najednou)
  const tenanti = await vTenantu('*', (q) => q.all(`SELECT IDTENANT FROM dbo.A_KP_Nastaveni WHERE Klic = 'PD_SYNC' AND Hodnota = '1'`));
  let pacientu = 0, chyb = 0;
  for (const t of tenanti) {
    const tenant = String(t.IDTENANT).trim();
    try {
      await vTenantu(tenant, async (q) => {
        const nast = await nastaveniPd(q);
        if (!nast.nastaveno) return;
        const pac = await q.all(`SELECT PacientID, CONVERT(char(36), PdKlientID) AS pd FROM dbo.A_KP_Pacient WHERE Stav = 'AKTIVNI' AND PdKlientID IS NOT NULL`);
        for (const p of pac) {
          try { await synchronizujPacienta(q, nast, p.PacientID, p.pd); pacientu++; }
          catch (e) { chyb++; log(`pecedoma sync ${tenant} pacient ${p.PacientID}: ${String(e.message || e).slice(0, 120)}`); }
        }
      });
    } catch (e) { chyb++; log(`pecedoma sync ${tenant}: ${String(e.message || e).slice(0, 120)}`); }
  }
  return { tenantu: tenanti.length, pacientu, chyb };
}

/** Spustí automatickou synchronizaci: po startu a pak každých 30 minut. */
export function spustSynchronizaci(log = console.log) {
  const beh = async () => { try { const r = await synchronizujVse(log); if (r.pacientu || r.chyb) log(`pecedoma sync: ${r.pacientu} pacientů, ${r.chyb} chyb`); } catch (e) { log('pecedoma sync: ' + String(e.message || e).slice(0, 120)); } };
  setTimeout(beh, 20000);
  setInterval(beh, 30 * 60 * 1000).unref();
}
