/**
 * Propojení s PéčeDoma (od 0.7.0): Karta pacienta volá aplikaci pecedoma-karta na jhn-apps (server PéčeDoma).
 *   klienti(q)      seznam klientů poskytovatele pro výběr v průvodci Nový pacient
 *   klient(id)      export klienta (stejný JSON jako Data klienta → Export pro Kartu pacienta)
 *   sync(id)        aktivní léky a nejbližší plánovaná návštěva → A_KP_PdSync
 * Nastavení tenanta v A_KP_Nastaveni: PD_ODKAZ (adresa portálu pro uživatele), PD_API (server jhn-apps), PD_TOKEN (x-app-token
 * aplikace), PD_SYNC ('1' = synchronizovat automaticky), PD_PORTAL ('plus' = organizace pracuje v PéčeDoma Plus – od 0.11.69 se volá
 * aplikace pecedomaplus-karta a s každým voláním se posílá tenant organizace, který je v PéčeDoma Plus stejný; jinak pecedoma-karta).
 * Server se PéčeDoma prokazuje i partnerským klíčem KP_PARTNER_KLIC.
 * Synchronizace plán péče nemění (plán = nová verze podepsaná lékařem); léky z PéčeDoma se ukazují vedle plánu a lékař je převezme.
 * Výjimka od 0.11.143: diagnózy se slučují obousměrně s Daty klienta → Diagnóza a Info (synchronizujDiagnozy) – změna z PéčeDoma
 * je nová verze plánu podepsaná „PéčeDoma: …“.
 */
import { config } from './config.js';
import { vTenantu } from './db.js';
import { chyba } from './http.js';
import { zapisDenik, planAktualni, ulozPlan, klicDg } from './kp.js';   // 0.11.82: zápis převzatého místa pobytu do deníku; 0.11.143: diagnózy

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const PD_API_VYCHOZI = 'https://95-216-201-2.sslip.io';

/** Nastavení propojení pro tenant (q = dotazy v kontextu tenanta). */
export async function nastaveniPd(q) {
  const n = await q.all(`SELECT Klic, Hodnota FROM dbo.A_KP_Nastaveni WHERE Klic IN ('PD_ODKAZ', 'PD_API', 'PD_TOKEN', 'PD_SYNC', 'PD_PORTAL')`);
  const m = Object.fromEntries(n.map((x) => [x.Klic, String(x.Hodnota || '').trim()]));
  const plus = m.PD_PORTAL === 'plus';
  /* tenant organizace z kontextu dotazu (vTenantu) – PéčeDoma Plus má stejná ID tenantů (sdílená dbo.Tenants) */
  const tenant = plus ? String(((await q.one(`SELECT CONVERT(char(16), SESSION_CONTEXT(N'IDTENANT')) AS t`)) || {}).t || '').trim() : '';
  return { odkaz: m.PD_ODKAZ || '', api: (m.PD_API || PD_API_VYCHOZI).replace(/\/+$/, ''), token: m.PD_TOKEN || '', sync: m.PD_SYNC === '1',
    portal: plus ? 'plus' : 'pecedoma', tenant, nastaveno: !!(m.PD_TOKEN && config.partnerKlic) };
}

/** Volání aplikace pecedoma-karta (PéčeDoma) nebo pecedomaplus-karta (PéčeDoma Plus – s tenantem organizace) na jhn-apps. */
export async function pdVolej(nast, akce, body = {}) {
  if (!nast.token) throw chyba('Propojení s PéčeDoma není nastavené – správce doplní token v Správa organizace → Nastavení', 400);
  if (!config.partnerKlic) throw chyba('Na serveru chybí KP_PARTNER_KLIC (nasazení deploy/vps-deploy.sh)', 500);
  const plus = nast.portal === 'plus';
  if (plus && !/^[A-Z0-9]{16}$/.test(String(nast.tenant || ''))) throw chyba('Propojení s PéčeDoma Plus: chybí tenant organizace', 500);
  let r, d;
  try {
    r = await fetch(`${nast.api}/api/apps/${plus ? 'pecedomaplus-karta' : 'pecedoma-karta'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-token': nast.token },
      body: JSON.stringify({ akce, klic: config.partnerKlic, ...body, ...(plus ? { tenant: nast.tenant } : {}) }), signal: AbortSignal.timeout(20000) });
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
    vPeceDoma: !!l.vPeceDoma, kalendarChyba: d.kalendarChyba ? String(d.kalendarChyba).slice(0, 200) : null, portalKlientId: Number((d.klient || {}).portalKlientId) || null,
    kde: String(d.kde || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null,   // 0.11.80: kde se pacient nachází (PéčeDoma)
    kdeZname: Object.prototype.hasOwnProperty.call(d, 'kde') };   // 0.11.88: starší PéčeDoma pole kde neposílá → místo zůstane, jak bylo
}

/** Synchronizace jednoho pacienta (v kontextu tenanta). Vrátí uložený stav; chybu zapíše do A_KP_PdSync.Chyba a vyhodí ji dál. */
export async function synchronizujPacienta(q, nast, pacientId, pdKlientId) {
  if (!UUID.test(String(pdKlientId || ''))) throw chyba('Pacient není propojený s klientem PéčeDoma', 400);
  const uloz = (v, chybaText) => q.exec(`MERGE dbo.A_KP_PdSync AS t USING (SELECT @p AS PacientID) AS s ON t.PacientID = s.PacientID
      WHEN MATCHED THEN UPDATE SET Sos = @sos, Opioidy = @opi, Medikace = @med, PristiNavsteva = @pn, PristiKdo = @pk, PristiPozn = @pp, Kde = CASE WHEN @kz = 1 THEN @kde ELSE Kde END, Aktualizovano = SYSDATETIME(), Chyba = @ch
      WHEN NOT MATCHED THEN INSERT (PacientID, Sos, Opioidy, Medikace, PristiNavsteva, PristiKdo, PristiPozn, Kde, Chyba) VALUES (@p, @sos, @opi, @med, @pn, @pk, @pp, @kde, @ch);`,
  { p: pacientId, sos: v ? JSON.stringify(v.sos) : null, opi: v ? JSON.stringify(v.opioidy) : null, med: v ? JSON.stringify(v.medikace) : null, pn: v ? v.pristiNavsteva : null, pk: v ? v.pristiKdo : null, pp: v ? v.pristiPozn : null, kde: v ? v.kde : null, kz: v && v.kdeZname ? 1 : 0, ch: chybaText });
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
  // 0.11.147: všechna volání PéčeDoma (i diagnózy) PŘED zápisy do Karty – zápis drží zámky až do konce transakce a čtení (přehled pacientů)
  // by na ně čekalo; databáze nemá READ_COMMITTED_SNAPSHOT. Diagnózy: chyba (např. starší PéčeDoma) synchronizaci léků a návštěv neshodí.
  let dg = null;
  try { dg = await pripravDiagnozy(q, nast, pacientId, pdKlientId); }
  catch (e) { v.diagnozy = { chyba: String(e.message || e).slice(0, 200) }; console.warn(`pecedoma diagnózy pacient ${pacientId}: ${v.diagnozy.chyba}`); }
  await uloz(v, v.kalendarChyba);
  if (dg) {
    try { v.diagnozy = await zapisDiagnozy(q, pacientId, dg); }
    catch (e) { v.diagnozy = { chyba: String(e.message || e).slice(0, 200) }; console.warn(`pecedoma diagnózy pacient ${pacientId}: ${v.diagnozy.chyba}`); }
  }
  if (v.portalKlientId) await q.exec(`UPDATE dbo.A_KP_Pacient SET PdPortalKlientID = @k WHERE PacientID = @p AND PdPortalKlientID IS NULL`, { k: v.portalKlientId, p: pacientId });
  // 0.11.82: import z PéčeDoma psal do Pobytu pevně „doma“ – takový (nebo prázdný) pobyt nahradí skutečné místo z PéčeDoma; ručně zapsaný pobyt zůstává
  if (v.kde) {
    const n = await q.exec(`UPDATE dbo.A_KP_Pacient SET Pobyt = @kde WHERE PacientID = @p AND LOWER(LTRIM(RTRIM(ISNULL(Pobyt, N'')))) IN (N'', N'doma') AND ISNULL(Pobyt, N'') <> @kde`, { kde: v.kde, p: pacientId });
    if (n > 0) await zapisDenik(q, { pacientId, typ: 'Systém', text: `Místo pobytu převzato z PéčeDoma: ${v.kde}.`, autor: 'PéčeDoma', role: 'system' });
  }
  return v;
}

/* 0.11.143: diagnózy obousměrně s PéčeDoma (Data klienta → Diagnóza a Info). Slučuje se po řádcích (řádek = diagnóza, stejný kód MKN = stejná
   diagnóza) proti stavu po poslední synchronizaci (A_KP_PdSync.DgSpolecne): co od té doby přibylo na jedné straně, přibude i na druhé;
   co na jedné straně ubylo, ubude i na druhé; změněný text řádku vyhraje změněná strana (při změně na obou Karta). První synchronizace
   (žádný předchozí stav) jen sjednotí, nic nemaže. Úplně vyprázdněný text jedné strany se nebere jako smazání všeho (ochrana před omylem). */
const radkyDg = (t) => String(t || '').replace(/\r/g, '').split('\n').map((x) => x.trim()).filter(Boolean);
const mapaDg = (t) => { const m = new Map(); for (const r of radkyDg(t)) { const k = klicDg(r); if (!m.has(k)) m.set(k, r); } return m; };
export function slucDiagnozy(zaklad, karta, pd) {
  const prvni = zaklad == null;
  const B = mapaDg(zaklad);
  const K = mapaDg(!prvni && !radkyDg(karta).length && B.size ? zaklad : karta);
  const P = mapaDg(!prvni && !radkyDg(pd).length && B.size ? zaklad : pd);
  const out = [];
  for (const k of [...K.keys(), ...[...P.keys()].filter((x) => !K.has(x))]) {
    const vK = K.has(k), vP = P.has(k), vB = B.has(k);
    if (prvni) { out.push(vK ? K.get(k) : P.get(k)); continue; }
    if (vK && vP) out.push(K.get(k) !== B.get(k) ? K.get(k) : P.get(k));
    else if (!vB) out.push(vK ? K.get(k) : P.get(k));   // přibylo na jedné straně
    // jinak: bylo v posledním společném stavu a jedna strana ho smazala → smazat i na druhé
  }
  const text = out.join('\n'), norm = (t) => radkyDg(t).join('\n');
  return { text, zmenaKarta: text !== norm(karta), zmenaPd: text !== norm(pd) };
}
export async function synchronizujDiagnozy(q, nast, pacientId, pdKlientId) {
  return zapisDiagnozy(q, pacientId, await pripravDiagnozy(q, nast, pacientId, pdKlientId));
}
/** 0.11.147: část bez zápisu do Karty – čtení z PéčeDoma, sloučení a případný zápis do PéčeDoma (HTTP mimo zámky Karty) */
export async function pripravDiagnozy(q, nast, pacientId, pdKlientId) {
  const klientId = String(pdKlientId).toLowerCase();
  const pd = (await pdVolej(nast, 'diagnoza', { klientId })).diagnoza || {};
  const row = await q.one(`SELECT DgSpolecne AS dg FROM dbo.A_KP_PdSync WHERE PacientID = @p`, { p: pacientId });
  const zaklad = row && row.dg != null ? row.dg : null;
  const plan = await planAktualni(q, pacientId);
  const kartaDg = (plan && plan.data && plan.data.dg) || '';
  const m = slucDiagnozy(zaklad, kartaDg, pd.text || '');
  let doPd = false;
  if (m.zmenaPd && radkyDg(m.text).length) {
    await pdVolej(nast, 'diagnoza-uloz', { klientId, text: m.text, kdo: String((plan && plan.podepsal) || 'Karta pacienta').replace(/^PéčeDoma:\s*/, '').slice(0, 80) });
    doPd = true;
  }
  return { m, plan, pd, doPd };
}
/** 0.11.147: zápisy do Karty po sloučení diagnóz (nová verze plánu, deník, společný stav) – rychle, bez volání PéčeDoma */
export async function zapisDiagnozy(q, pacientId, { m, plan, pd, doPd }) {
  const vysledek = { doKarty: false, doPd };
  if (m.zmenaKarta && plan) {
    const kdo = String(pd.kdo || '').replace(/^Karta pacienta:\s*/, '') || 'Diagnóza a Info';
    const verze = await ulozPlan(q, { pacientId, data: { ...plan.data, dg: m.text }, platnostDo: plan.platnostDo, s: { uzivatelId: null, jmeno: 'PéčeDoma: ' + kdo }, typ: 'ZMENA', poznamka: 'diagnózy z PéčeDoma (Data klienta → Diagnóza a Info)' });
    await zapisDenik(q, { pacientId, typ: 'Systém', text: `Diagnózy sloučeny s PéčeDoma (plán péče v${verze}): ${radkyDg(m.text).join('; ')}.`, autor: 'PéčeDoma', role: 'system' });
    vysledek.doKarty = true;
  }
  await q.exec(`UPDATE dbo.A_KP_PdSync SET DgSpolecne = @dg WHERE PacientID = @p`, { dg: m.text, p: pacientId });
  return vysledek;
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
export const TYPY_ZHORSENI = ['Zhoršení stavu', 'Stav stabilizován', 'Návrat z nemocnice'];   // 0.11.145: i návrat z nemocnice (uzavírá epizodu zhoršení)
/** Zápisy o zhoršení (a stabilizaci) z deníku → PéčeDoma jako druh ZHORSENI (historie zhoršení v Data klienta → Z Karty pacienta). Nikdy neshodí zápis do deníku. */
export async function predejZhorseniPd(q, pacientId, zapisy, { audit = null, ip = null } = {}) {
  const z = (Array.isArray(zapisy) ? zapisy : []).filter((x) => TYPY_ZHORSENI.includes(x.typ) && x.text);
  if (!z.length) return false;
  try {
    const p = await q.one(`SELECT LOWER(CONVERT(char(36), PdKlientID)) AS pd FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: pacientId });
    if (!p || !p.pd) return false;
    const nast = await nastaveniPd(q);
    if (!nast.nastaveno) return false;
    const polozky = z.map((x) => ({ druh: 'ZHORSENI', nazev: x.typ, obsah: String(x.text).startsWith(x.typ) ? String(x.text) : `${x.typ}: ${x.text}`, puvod: `${x.autor || 'tým'} (Karta pacienta${x.role ? ', ' + x.role : ''})`, aktualizovano: x.cas || null }));
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
      CONVERT(char(16), Aktualizovano, 120) AS aktualizovano, Chyba AS chyba, Kde AS kde FROM dbo.A_KP_PdSync WHERE PacientID = @p`, { p: pacientId });
  if (!r) return null;
  const js = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
  return { sos: js(r.Sos), opioidy: js(r.Opioidy), medikace: js(r.Medikace), pristiNavsteva: r.pristiNavsteva, pristiKdo: r.pristiKdo, pristiPozn: r.pristiPozn, aktualizovano: r.aktualizovano, chyba: r.chyba, kde: r.kde || null };
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
      // 0.11.147: dřív všichni pacienti v jedné transakci (~1,3 s na pacienta → zámky na minutu, přehled pacientů čekal); teď každý zvlášť
      const { nast, pac } = await vTenantu(tenant, async (q) => {
        const n = await nastaveniPd(q);
        return { nast: n, pac: n.nastaveno ? await q.all(`SELECT PacientID, CONVERT(char(36), PdKlientID) AS pd FROM dbo.A_KP_Pacient WHERE Stav = 'AKTIVNI' AND PdKlientID IS NOT NULL`) : [] };
      });
      for (const p of pac) {
        try { await vTenantu(tenant, (q) => synchronizujPacienta(q, nast, p.PacientID, p.pd)); pacientu++; }
        catch (e) { chyb++; log(`pecedoma sync ${tenant} pacient ${p.PacientID}: ${String(e.message || e).slice(0, 120)}`); }
      }
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

/* ---- číselník diagnóz (0.11.92): CLB1 dbo.Diagnozy2025 přes PéčeDoma (pecedoma-karta, akce diagnozy, PéčeDoma 2.78).
   Kódy v číselníku jsou bez tečky (I509), v textu diagnóz bývají s tečkou (I50.9) – porovnává se bez tečky. Popisy se drží
   v paměti serveru (číselník se nemění); když PéčeDoma neodpoví, karta je prostě bez popisů a zkusí se to příště. */
const DG_POPISY = new Map(), DG_NEZNAME = new Map();
export const kodyDiagnoz = (text) => [...new Set((String(text || '').toUpperCase().match(/\b[A-TV-Z]\d{2}(?:\.?\d{1,2})?\b/g) || []).map((k) => k.replace('.', '')))].slice(0, 30);
export async function popisyDiagnoz(q, text) {
  const kody = kodyDiagnoz(text);
  if (!kody.length) return {};
  const chybi = kody.filter((k) => !DG_POPISY.has(k) && !(Date.now() - (DG_NEZNAME.get(k) || 0) < 3600e3));   // neznámý kód se zkusí znovu po hodině
  if (chybi.length) {
    try {
      const nast = await nastaveniPd(q);
      if (nast.nastaveno) {
        /* 0.11.93: PéčeDoma (2.78) přijímá kódy jen ve tvaru s tečkou (F01.9) nebo tříznakové (F01) – bez tečky (F019) je zahodila */
        const r = await pdVolej(nast, 'diagnozy', { kody: chybi.map((k) => (k.length > 3 ? k.slice(0, 3) + '.' + k.slice(3) : k)).join(',') });
        const m = new Map((r.diagnozy || []).map((d) => [String(d.kod || '').replace('.', '').toUpperCase(), String(d.popis || '').trim()]));
        for (const k of chybi) { if (m.get(k)) DG_POPISY.set(k, m.get(k)); else DG_NEZNAME.set(k, Date.now()); }
      }
    } catch { /* bez popisů – zkusí se při dalším načtení */ }
  }
  const out = {};
  for (const k of kody) { const p = DG_POPISY.get(k); if (p) out[k] = p; }
  return out;
}
/** našeptávač diagnóz v plánu péče: q = kód nebo slova názvu → [{kod, popis}] (nejvýš 20) */
export async function hledejDiagnozy(q, hledat) {
  const t = String(hledat || '').trim().slice(0, 60);
  if (t.length < 2) return [];
  const nast = await nastaveniPd(q);
  if (!nast.nastaveno) throw chyba('Číselník diagnóz je v PéčeDoma – propojení s PéčeDoma není nastavené');
  const r = await pdVolej(nast, 'diagnozy', { q: t });
  return (r.diagnozy || []).map((d) => { const kod = String(d.kod || '').trim(); DG_POPISY.set(kod.replace('.', '').toUpperCase(), String(d.popis || '').trim()); return { kod, popis: String(d.popis || '').trim() }; });
}
