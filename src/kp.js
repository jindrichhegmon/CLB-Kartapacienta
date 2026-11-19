/**
 * Doménová logika karty pacienta (vše běží uvnitř vTenantu – RLS hlídá tenanta).
 * q = { all, one, exec } z db.js
 */
import { randomUUID } from 'node:crypto';
import { chyba } from './http.js';
import { stavSync, nastaveniPd, popisyDiagnoz } from './pecedoma.js';

export const ROLE_UZIVATELE = ['admin', 'lekar', 'sestra', 'ctenar'];
export const TYPY_POSKYTOVATELE = { NEMOCNICE: 'Nemocnice', HOSPIC: 'Mobilní hospic', AMBULANCE: 'Paliativní ambulance', PL: 'Praktický lékař', DOMOV: 'Domov / pobytová služba', ZZS: 'Záchranná služba', JINY: 'Jiný' };
export const TYPY_DENIKU = ['Založení', 'Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Návštěva hospice', 'Telefonát', 'Pozorování rodiny', 'Zhoršení stavu', 'Stav stabilizován', 'Výjezd ZZS', 'Revize', 'Úprava údajů', 'Předání garance', 'Ukončení', 'Videohovor', 'Systém'];

/** Role lidí pracovišť na kartě (jako v demu): lékař, praktický lékař, hospic, sestra DPS. Rodina má PIN u konkrétního pacienta, ZZS žádný. */
export const ROLE_OSOBY = { LEKAR: 'Lékař a spec. sestra', PL: 'Praktický lékař', HOSPIC: 'Hospic', SESTRA: 'Sestra DPS' };
/** Role z textu (CSV, PéčeDoma: lekar / sestra / casemanager…) podle typu pracoviště; neznámá → null */
export function roleOsoby(v, typPracoviste = '') {
  const t = String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const domov = typPracoviste === 'DOMOV';
  const kod = String(v || '').trim();
  if (/^[A-Z]+$/.test(kod) && ROLE_OSOBY[kod]) return kod;   // přesný kód (vlastní export, výběr v aplikaci)
  if (/prakt|\bpl\b/.test(t)) return 'PL';
  if (/lekar|doktor|mudr|doctor/.test(t)) return typPracoviste === 'PL' ? 'PL' : 'LEKAR';
  if (/dps|domov/.test(t)) return 'SESTRA';
  if (/sestr|pecovat|pecuj|casemanager|nurse|hospic|zdravot/.test(t)) return domov ? 'SESTRA' : 'HOSPIC';
  return null;
}
/** 0.11.112: role, na které se smí správce přepnout (jen stejná nebo nižší práva): správce = všechny jeho role, lékař jen když lékařem je */
export const roleNahledu = (vlastni) => (vlastni.includes('admin') ? ['admin', ...(vlastni.includes('lekar') ? ['lekar'] : []), 'sestra', 'ctenar'] : []);
export const roleSeznam = (v) => String(v || '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => ROLE_UZIVATELE.includes(x));

export async function audit(q, { uzivatelId = null, zarizeniId = null, kdo = null, pacientId = null, akce, detail = null, ip = null }) {
  await q.exec(`INSERT INTO dbo.A_KP_AuditLog (UzivatelID, ZarizeniID, Kdo, PacientID, Akce, Detail, IP)
    VALUES (@u, @z, @k, @p, @a, @d, @ip)`, { u: uzivatelId, z: zarizeniId, k: kdo, p: pacientId, a: akce, d: detail && String(detail).slice(0, 1000), ip });
}

export async function zapisDenik(q, { pacientId, typ, text, autor, role, uzivatelId = null, zarizeniId = null, cas = null, uuid = null, overeno = true }) {
  const id = uuid || randomUUID();
  const n = await q.exec(`IF NOT EXISTS (SELECT 1 FROM dbo.A_KP_Denik WHERE UUID = @id)
    INSERT INTO dbo.A_KP_Denik (UUID, PacientID, Typ, Text, Autor, Role, UzivatelID, ZarizeniID, CasZapisu, Overeno)
    VALUES (@id, @p, @typ, @t, @a, @r, @u, @z, ISNULL(@c, SYSDATETIME()), @o)`,
  { id, p: pacientId, typ: String(typ).slice(0, 30), t: String(text).slice(0, 4000), a: String(autor).slice(0, 150), r: String(role).slice(0, 10), u: uzivatelId, z: zarizeniId, c: cas, o: overeno });
  return { uuid: id, novy: n > 0 };
}

/** Další kód průkazu P-0001, P-0002 … (v rámci tenanta). */
export async function dalsiKod(q) {
  const r = await q.one(`SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(KodPrukazu, 3, 10) AS int)), 0) + 1 AS n FROM dbo.A_KP_Pacient WITH (UPDLOCK, HOLDLOCK)`);
  return 'P-' + String(r.n).padStart(4, '0');
}

export async function planAktualni(q, pacientId) {
  const p = await q.one(`SELECT TOP 1 PlanVerzeID, Verze, Data, CONVERT(char(10), PlatnostDo, 23) AS PlatnostDo, PodepsalUzivatelID, PodepsalJmeno, Typ,
      CONVERT(char(16), Vytvoreno, 120) AS Vytvoreno FROM dbo.A_KP_PlanVerze WHERE PacientID = @p ORDER BY Verze DESC`, { p: pacientId });
  if (!p) return null;
  let data = {}; try { data = JSON.parse(p.Data); } catch { /* */ }
  return { verze: p.Verze, data, platnostDo: p.PlatnostDo, podepsal: p.PodepsalJmeno, podepsalId: p.PodepsalUzivatelID, typ: p.Typ, vytvoreno: p.Vytvoreno };
}

export async function garant(q, pacientId) {
  // 0.11.87: lékař garanta = odborný zástupce pracoviště (je-li vyplněný), jinak lékař, který garanci převzal
  return q.one(`SELECT TOP 1 g.GaranceID, g.PoskytovatelID, ps.Nazev AS Poskytovatel, ps.Typ, ps.Telefon24, g.LekarUzivatelID,
      COALESCE(NULLIF(LTRIM(RTRIM(ps.OdbornyZastupce)), N''), u.Jmeno) AS Lekar, NULLIF(LTRIM(RTRIM(ps.OdbornyZastupce)), N'') AS OdbornyZastupce,
      CONVERT(char(16), g.Od, 120) AS Od
    FROM dbo.A_KP_Garance g JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = g.PoskytovatelID
    LEFT JOIN dbo.A_KP_Uzivatel u ON u.UzivatelID = g.LekarUzivatelID
    WHERE g.PacientID = @p AND g.Stav = 'PLATNA'`, { p: pacientId });
}

/** Oprávnění uživatele k pacientovi: { vidi, lekar (mění plán), garant (správa průkazu), zapis (deník) } */
export async function opravneni(q, s, pacientId) {
  const pac = await q.one(`SELECT PacientID, Stav FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: pacientId });
  if (!pac) throw chyba('Pacient nenalezen', 404);
  const tym = await q.all(`SELECT Role FROM dbo.A_KP_Tym WHERE PacientID = @p AND PoskytovatelID = @ps AND Aktivni = 1`, { p: pacientId, ps: s.poskytovatelId });
  const g = await garant(q, pacientId);
  const navrh = await q.one(`SELECT TOP 1 GaranceID FROM dbo.A_KP_Garance WHERE PacientID = @p AND PoskytovatelID = @ps AND Stav = 'NAVRZENO'`, { p: pacientId, ps: s.poskytovatelId });
  const admin = s.role.includes('admin');
  const jeLekar = s.role.includes('lekar');
  const vTymu = tym.length > 0;
  const jeGarant = !!g && g.PoskytovatelID === s.poskytovatelId;
  const vidi = admin || vTymu || !!navrh;
  if (!vidi) throw chyba('K tomuto pacientovi nemáte přístup (vaše pracoviště není v týmu kolem pacienta)', 403);
  const aktivni = pac.Stav === 'AKTIVNI';
  // 0.11.111: jednoduchý režim organizace – kdo v týmu zapisuje (lékař i sestra, ne „jen čtení“ ani host), smí vše, co lékař:
  // diagnózy, léky, alergie a plán (nová verze, v plánu je uvedeno, kdo ji uložil) a předání pacientovi do Průkazu pacienta
  const jednoduse = !!s.jednoduchy && aktivni && tym.some((t) => t.Role !== 'HOST') && s.role.some((r) => r !== 'ctenar');
  return {
    vidi: true,
    aktivni,
    jednoduchy: !!s.jednoduchy,
    lekar: (aktivni && jeLekar && (jeGarant || tym.some((t) => ['GARANT', 'LEKAR'].includes(t.Role)))) || jednoduse,
    garant: (aktivni && ((jeGarant && (jeLekar || admin)) || admin)) || jednoduse,
    // host v týmu (např. nemocnice při hospitalizaci) jen čte – zapisuje garant, lékař a péče
    zapis: aktivni && (tym.some((t) => t.Role !== 'HOST') || admin) && !s.role.every((r) => r === 'ctenar'),
    prijmoutGaranci: aktivni && !!navrh && jeLekar,
    navrhGaranceId: navrh ? navrh.GaranceID : null,
  };
}

/** Balík dat pro telefon (vše, co průkaz zobrazuje offline). */
export async function balikProZarizeni(q, pacientId, { rezim = 'ZAPUJCENY' } = {}) {
  const p = await q.one(`SELECT PacientID, KodPrukazu, Jmeno, Prijmeni, RokNarozeni, CONVERT(char(10), DatumNarozeni, 23) AS DatumNarozeni, Pohlavi, Pobyt, Stav, PdKlientID
    FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: pacientId });
  if (!p) return null;
  const plan = await planAktualni(q, pacientId);
  const g = await garant(q, pacientId);
  const kontakty = await q.all(`SELECT KontaktID AS id, Jmeno AS jmeno, Telefon AS tel, LOWER(Skupina) AS skupina, Poznamka AS pozn
    FROM dbo.A_KP_Kontakt WHERE PacientID = @p AND Aktivni = 1 ORDER BY Poradi, KontaktID`, { p: pacientId });
  const tym = await q.all(`SELECT ps.Nazev AS nazev, ps.Typ AS typ, t.Role AS role, ps.Telefon24 AS tel FROM dbo.A_KP_Tym t
    JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = t.PoskytovatelID WHERE t.PacientID = @p AND t.Aktivni = 1`, { p: pacientId });
  const piny = await q.all(`SELECT PinID AS id, Jmeno AS jmeno, LOWER(Role) AS role, Salt AS salt, Hash AS hash, Iterace AS iterace
    FROM dbo.A_KP_Pin WHERE PacientID = @p AND Aktivni = 1`, { p: pacientId });
  // lidé pracovišť přiřazení k pacientovi – osobní PIN platí u všech jejich pacientů
  const lide = await q.all(`SELECT 'o' + CAST(o.OsobaID AS varchar(12)) AS id, o.Jmeno AS jmeno, LOWER(o.Role) AS role, o.Salt AS salt, o.Hash AS hash, o.Iterace AS iterace
    FROM dbo.A_KP_PacientOsoba po JOIN dbo.A_KP_Osoba o ON o.OsobaID = po.OsobaID
    WHERE po.PacientID = @p AND po.Aktivni = 1 AND o.Aktivni = 1 AND o.Hash IS NOT NULL`, { p: pacientId });
  piny.push(...lide);
  const pacientuv = rezim === 'PACIENT';
  // 0.11.53: členové týmu u pacienta s telefonem – dlaždice Videohovor nabídne zavolat / poslat SMS (jen karta týmu, po odemknutí PINem)
  const clenove = pacientuv ? [] : await q.all(`SELECT o.OsobaID AS id, o.Jmeno AS jmeno, LOWER(o.Role) AS role, o.Telefon AS tel, ps.Nazev AS poskytovatel, o.Tym AS tym
    FROM dbo.A_KP_PacientOsoba po JOIN dbo.A_KP_Osoba o ON o.OsobaID = po.OsobaID JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = o.PoskytovatelID
    WHERE po.PacientID = @p AND po.Aktivni = 1 AND o.Aktivni = 1 ORDER BY ps.Nazev, o.Tym, o.Jmeno`, { p: pacientId });
  // co pacient sám poslal z Mého průkazu (A_KP_Sdileni) – do karty týmu jen ke čtení (0.11.24); do telefonu pacienta se nevrací
  const odPacienta = pacientuv ? [] : (await q.all(`SELECT TOP 30 SdileniID AS id, CONVERT(char(16), Vytvoreno, 120) AS cas, Polozky AS polozky FROM dbo.A_KP_Sdileni WHERE PacientID = @p ORDER BY SdileniID DESC`, { p: pacientId }))
    .flatMap((x) => { let pol = []; try { pol = JSON.parse(x.polozky) || []; } catch { /* poškozený záznam přeskočit */ } return pol.map((p) => ({ druh: p.druh, nazev: p.nazev, obsah: p.obsah, puvod: p.puvod, aktualizovano: p.aktualizovano, cas: x.cas })); });
  // z PéčeDoma (je-li pacient propojený): aktivní léky a nejbližší plánovaná návštěva – jen k zobrazení vedle plánu
  const pd = await stavSync(q, pacientId);
  // chat PéčeDoma: telefon smí psát týmu, když je pacient propojený a propojení nastavené (zprávy jdou přes server Karty, nikdy přímo)
  const chat = !!p.PdKlientID && (await nastaveniPd(q)).nastaveno;
  const denik = pacientuv ? [] : await q.all(`SELECT TOP 100 LOWER(CONVERT(varchar(36), UUID)) AS uuid, Typ AS typ, Text AS text, Autor AS autor, Role AS role,
      CONVERT(char(16), CasZapisu, 120) AS cas, Overeno AS overeno FROM dbo.A_KP_Denik WHERE PacientID = @p ORDER BY CasZapisu DESC, DenikID DESC`, { p: pacientId });
  const dgPopisy = await popisyDiagnoz(q, plan && plan.data && plan.data.dg);   // 0.11.92: popisy kódů diagnóz (číselník CLB1)
  // 0.11.118: dokumenty předané pacientovi do Průkazu – jen metadata a otisk, obsah jen přes GET /api/d/dokument/:id
  const dokumenty = pacientuv ? await dokumentyProPrukaz(q, pacientId, g ? g.Poskytovatel : null) : undefined;
  return {
    dgPopisy,
    pacient: { kod: p.KodPrukazu, jmeno: p.Jmeno, prijmeni: p.Prijmeni, rok: p.RokNarozeni || (p.DatumNarozeni ? Number(p.DatumNarozeni.slice(0, 4)) : null), pohlavi: p.Pohlavi, pobyt: p.Pobyt, stav: p.Stav },
    plan,
    garant: g ? { poskytovatel: g.Poskytovatel, typ: g.Typ, telefon24: g.Telefon24, lekar: g.Lekar, odbornyZastupce: g.OdbornyZastupce || null } : null,
    // vlastní telefon pacienta: odemyká jen pacient svým PINem (PINy týmu ani rodiny do něj nepatří) a deník týmu
    // zůstává v centrále – pacient dostává plán, kontakty a tým, tedy to, co mu lékař zpřístupnil
    kontakty, tym, piny: pacientuv ? [] : piny, denik: denik.reverse(), odPacienta, lide: clenove,
    rezim,
    ...(dokumenty ? { dokumenty } : {}),
    pecedoma: pd || chat ? { sos: pd ? pd.sos : [], opioidy: pd ? pd.opioidy : [], medikace: pd ? pd.medikace : [], pristiNavsteva: pd ? pd.pristiNavsteva : null, pristiKdo: pd ? pd.pristiKdo : null, pristiPozn: pd ? pd.pristiPozn : null, aktualizovano: pd ? pd.aktualizovano : null, chat, propojeno: !!p.PdKlientID } : null,
    serverCas: new Date().toISOString(),
  };
}

/**
 * Doklad k limitacím (§ 36 zákona o zdravotních službách): DVP s písemným poučením lékařem a úředně ověřeným podpisem,
 * nebo DVP sepsané při přijetí u konkrétního poskytovatele (platí jen u něj), jinak rozhodnutí lékaře podle zprávy.
 * Vyplnění v aplikaci samo DVP nevytváří – evidujeme jen, jaký doklad existuje a kde je originál.
 */
export function normalizujDoklad(k = {}) {
  k = k || {};
  const dvp = !!k.dvp;
  return {
    dvp,
    datum: String(k.datum || '').trim().slice(0, 10),
    original: String(k.original || '').trim().slice(0, 200),
    zprava: String(k.zprava || '').trim().slice(0, 300),
    pouceni: dvp && !!k.pouceni,
    overenyPodpis: dvp && !!k.overenyPodpis,
    prijeti: dvp ? String(k.prijeti || '').trim().slice(0, 200) : '',
  };
}

/** Normalizace dat plánu z formuláře / AI. */
/* 0.11.113: co přesně Karta předala do Průkazu pacienta – snímek z balíku pro telefon pacienta (A_KP_Predani, Historie předání).
   Léky stejně jako KP.leky: u pacienta propojeného s PéčeDoma (s načtenými léky) z PéčeDoma, jinak z plánu. */
/* 0.11.118: dokumenty pro Průkaz pacienta – předané (ProPacienta), s přiloženým souborem, nejnovější první, nejvýš 50 */
export const MIME_PRO_PACIENTA = ['application/pdf', 'image/jpeg', 'image/png'];
export async function dokumentyProPrukaz(q, pacientId, garantNazev = null) {
  return (await q.all(`SELECT TOP 50 DokumentID AS id, Nazev AS nazev, Typ AS typ, CONVERT(char(10), ISNULL(DatumDokumentu, CAST(Vytvoreno AS date)), 23) AS datum,
      Pracoviste AS pracoviste, MimeType AS mime, Velikost AS velikost, Sha256 AS sha256
    FROM dbo.A_KP_Dokument WHERE PacientID = @p AND ProPacienta = 1 AND Obsah IS NOT NULL ORDER BY DokumentID DESC`, { p: pacientId }))
    .map((d) => ({ ...d, pracoviste: d.pracoviste || garantNazev || null, sha256: d.sha256 ? String(d.sha256).trim().toLowerCase() : null }));
}
/* 0.11.118: stažení dokumentu do Průkazu – zařízení PACIENT ve stavu SPAROVANO a jen dokument JEHO pacienta s ProPacienta = 1,
   ověřeno v jednom dotazu (DokumentID + PacientID + ProPacienta); jinak null (route vrací 404, ať nejde zkoušet, co existuje) */
export async function dokumentProZarizeni(q, z, dokumentId) {
  const did = Number(dokumentId);
  if (!z || z.Rezim !== 'PACIENT' || z.Stav !== 'SPAROVANO' || !Number.isInteger(did) || did <= 0) return null;
  return q.one(`SELECT DokumentID AS id, Nazev AS nazev, MimeType AS mime, Obsah AS obsah, Sha256 AS sha256 FROM dbo.A_KP_Dokument
    WHERE DokumentID = @d AND PacientID = @p AND ProPacienta = 1 AND Obsah IS NOT NULL`, { d: did, p: z.PacientID });
}
export function obsahPredani(b) {
  const p = (b.plan && b.plan.data) || {}, pd = b.pecedoma, g = b.garant || {};
  const zPd = !!(pd && pd.propojeno && pd.aktualizovano);
  const lk = zPd ? pd : p;
  return {
    plan: b.plan ? { verze: b.plan.verze, platnostDo: b.plan.platnostDo || null, podepsal: b.plan.podepsal || null, cil: p.cil || null, kpr: p.kpr || null, limity: p.limity || [],
      dvp: !!(p.doklad && p.doklad.dvp), dvpDatum: (p.doklad && p.doklad.datum) || '', dvpOriginal: (p.doklad && p.doklad.original) || '' } : null,
    dg: p.dg || '', dgPopisy: b.dgPopisy || {}, alergie: p.alergie || '', funkce: p.funkce || '',
    // 0.11.132: parenterální léky z plánu (pacient bez PéčeDoma) jdou do Průkazu také; klíč jen když nějaké jsou – starší snímky se nemění
    leky: { zdroj: zPd ? 'PéčeDoma' : 'plán péče', sos: lk.sos || [], opioidy: lk.opioidy || [], medikace: lk.medikace || [], ...(!zPd && (p.parenteralni || []).length ? { parenteralni: p.parenteralni } : {}) },
    kontakty: (b.kontakty || []).map((k) => ({ jmeno: k.jmeno, tel: k.tel, skupina: k.skupina })),
    tym: (b.tym || []).map((t) => ({ nazev: t.nazev, tel: t.tel })),
    garant: { poskytovatel: g.poskytovatel || null, lekar: g.lekar || null, telefon24: g.telefon24 || null },
    // 0.11.118: nový nebo nově předaný dokument přepne aktualizaci v Průkazu (klíč jen když nějaký je – starší snímky se nemění)
    ...((b.dokumenty || []).length ? { dokumenty: b.dokumenty.map((d) => ({ id: d.id, sha256: d.sha256, nazev: d.nazev, typ: d.typ, datum: d.datum })) } : {}),
  };
}
/* 0.11.114: má Průkaz pacienta aktuální údaje? – současný snímek proti poslednímu předání do daného telefonu (A_KP_Predani)
   a výzva k obnovení z centrály (log přístupů) novější než poslední předání. Vrací jen příznaky, žádná zdravotní data. */
export const VYZVA_OBNOVIT = 'výzva k obnovení údajů';
export async function stavPredani(q, pacientId, zarizeniIds, balik = null) {
  const out = {};
  if (!zarizeniIds.length) return out;
  // popisy diagnóz se neporovnávají – načítají se z PéčeDoma a při jeho výpadku by vypadaly jako změna
  const bezPopisu = (o) => { try { const x = typeof o === 'string' ? JSON.parse(o) : { ...o }; delete x.dgPopisy; return JSON.stringify(x); } catch { return ''; } };
  const ted = bezPopisu(obsahPredani(balik || await balikProZarizeni(q, pacientId, { rezim: 'PACIENT' })));
  for (const zid of zarizeniIds) {
    const s = await q.one(`SELECT TOP 1 Obsah AS obsah, CONVERT(char(19), Cas, 120) AS cas FROM dbo.A_KP_Predani WHERE PacientID = @p AND ZarizeniID = @z ORDER BY PredaniID DESC`, { p: pacientId, z: zid });
    const v = await q.one(`SELECT TOP 1 CONVERT(char(19), Cas, 120) AS cas FROM dbo.A_KP_AuditLog WHERE PacientID = @p AND ZarizeniID = @z AND Akce = @a ORDER BY AuditID DESC`, { p: pacientId, z: zid, a: VYZVA_OBNOVIT });
    const zmena = s ? bezPopisu(s.obsah) !== ted : null;   // null = předáno před 0.11.113, nedá se porovnat
    const vyzva = !!(v && (!s || v.cas > s.cas));
    out[zid] = { posledniPredani: s ? s.cas.slice(0, 16) : null, zmena, vyzva, vyzvaOd: vyzva ? v.cas.slice(0, 16) : null, aktualizace: zmena === true || vyzva };
  }
  return out;
}
export async function zapisPredani(q, { pacientId, zarizeniId, akce, balik }) {
  const o = obsahPredani(balik);
  await q.exec(`INSERT INTO dbo.A_KP_Predani (PacientID, ZarizeniID, Akce, VerzePlanu, Obsah) VALUES (@p, @z, @a, @v, @o)`,
    { p: pacientId, z: zarizeniId, a: akce, v: o.plan ? o.plan.verze : null, o: JSON.stringify(o) });
}

export function normalizujPlan(d = {}) {
  const pole = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
  const cil = ['symptom', 'limited', 'full'].includes(d.cil) ? d.cil : 'symptom';
  // 0.11.92: limitace péče = jedna ze dvou možností – „KPR neuvedeno“ (pacient nemá podepsané DVP) nebo „dříve vyslovené přání
  // (living will)“; seznam, co si pacient nepřeje, jen u DVP. Starší plány bez `kpr` zůstávají, jak byly (verze se nemění).
  const kpr = ['neuvedeno', 'dvp'].includes(d.kpr) ? d.kpr : null;
  const doklad = normalizujDoklad(d.doklad);
  if (kpr) doklad.dvp = kpr === 'dvp';
  return {
    cil,
    ...(kpr ? { kpr } : {}),
    limity: kpr === 'neuvedeno' ? [] : pole(d.limity).slice(0, 12),
    doklad,
    dg: String(d.dg || '').slice(0, 1000),
    funkce: String(d.funkce || '').slice(0, 1000),
    alergie: String(d.alergie || 'žádné známé').slice(0, 300),
    sos: pole(d.sos),
    opioidy: pole(d.opioidy),
    medikace: pole(d.medikace),
    parenteralni: pole(d.parenteralni),   // 0.11.131: stejné skupiny jako v PéčeDoma (SOS, opioidy, paliativní terapie, parenterálně)
    terapieNaKarte: d.terapieNaKarte === true,   // 0.11.92: na krizové kartě i paliativní terapie (jinak jen opioidy a SOS medikace)
  };
}

/**
 * 0.11.123: původ údajů plánu – u každé diagnózy, léku, funkčního stavu a alergií, odkud se vzaly. Počítá se z historie verzí
 * (verze jsou jen pro doplňování), takže platí i zpětně: položka „vznikla“ ve verzi, od které je v plánu bez přerušení.
 * verze = vzestupně [{ verze, typ, podepsal, vytvoreno, poznamka, data }], zalozeni = 'zprava' | 'pecedoma' | 'rucne' (jak vznikl průkaz).
 * Vrací { dg:[polozka], opioidy:[…], sos:[…], medikace:[…], funkce: polozka|null, alergie: polozka|null },
 * polozka = { text, verze, kdy, kdo, zdroj: 'zprava'|'zalozeni-zprava'|'zalozeni-pecedoma'|'zalozeni'|'pecedoma'|'rucne', dokument }.
 */
export const DG_RADKY = (dg) => String(dg || '').split(/\n|;\s*/).map((x) => x.trim()).filter(Boolean);
const klicDg = (x) => { const k = String(x).toUpperCase().match(/^[A-TV-Z]\d{2}(?:\.?\d{1,2})?/); return k ? 'K:' + k[0].replace('.', '') : 'T:' + String(x).toLowerCase().replace(/\s+/g, ' ').replace(/[.,;]$/, ''); };
const klicText = (x) => String(x).toLowerCase().replace(/\s+/g, ' ').trim();
export function zdrojVerze(v, zalozeni = 'rucne', zalozeniDokument = null) {
  const poz = String(v.poznamka || '');
  const z = poz.match(/^Doplněno z rozboru zprávy „(.+?)“/);
  if (z) return { zdroj: 'zprava', dokument: z[1] };
  if (v.typ === 'ZALOZENI') return { zdroj: zalozeni === 'zprava' ? 'zalozeni-zprava' : zalozeni === 'pecedoma' ? 'zalozeni-pecedoma' : 'zalozeni', dokument: zalozeni === 'zprava' ? zalozeniDokument || null : null };
  if (/^PéčeDoma:/.test(String(v.podepsal || ''))) return { zdroj: 'pecedoma', dokument: null };
  return { zdroj: 'rucne', dokument: null };
}
export function puvodPlanu(verze = [], zalozeni = 'rucne', zalozeniDokument = null) {
  const POLE = { dg: (d) => DG_RADKY(d.dg), opioidy: (d) => d.opioidy || [], sos: (d) => d.sos || [], medikace: (d) => d.medikace || [], parenteralni: (d) => d.parenteralni || [],
    funkce: (d) => (String(d.funkce || '').trim() ? [String(d.funkce).trim()] : []), alergie: (d) => (String(d.alergie || '').trim() ? [String(d.alergie).trim()] : []) };
  const puvod = {};   // pole → Map(klíč → původ)
  let posledni = {};
  for (const v of verze) {
    const d = v.data || {};
    const info = { verze: v.verze, kdy: v.vytvoreno, kdo: v.podepsal, ...zdrojVerze(v, zalozeni, zalozeniDokument) };
    for (const [pole, fn] of Object.entries(POLE)) {
      const klic = pole === 'dg' ? klicDg : klicText;
      const dosud = puvod[pole] || new Map(), nove = new Map();
      for (const t of fn(d)) { const k = klic(t); nove.set(k, dosud.get(k) || info); }
      puvod[pole] = nove;
    }
    posledni = d;
  }
  const ven = {};
  for (const [pole, fn] of Object.entries(POLE)) {
    const klic = pole === 'dg' ? klicDg : klicText;
    const r = fn(posledni).map((t) => ({ text: t, ...((puvod[pole] && puvod[pole].get(klic(t))) || {}) }));
    ven[pole] = pole === 'funkce' || pole === 'alergie' ? r[0] || null : r;
  }
  return ven;
}

/** 0.11.111: kdo verzi plánu uložil – v jednoduchém režimu ji smí uložit i sestra, u jména je pak „(sestra)“ */
export const kdoPlan = (s) => (s.role && !s.role.includes('lekar') && s.role.includes('sestra') ? `${s.jmeno} (sestra)` : s.jmeno);
export async function ulozPlan(q, { pacientId, data, platnostDo, s, typ = 'ZMENA', poznamka = null }) {
  const r = await q.one(`SELECT ISNULL(MAX(Verze), 0) + 1 AS v FROM dbo.A_KP_PlanVerze WITH (UPDLOCK, HOLDLOCK) WHERE PacientID = @p`, { p: pacientId });
  await q.exec(`INSERT INTO dbo.A_KP_PlanVerze (PacientID, Verze, Data, PlatnostDo, PodepsalUzivatelID, PodepsalJmeno, Typ, Poznamka)
    VALUES (@p, @v, @d, @pl, @u, @j, @t, @poz)`, { p: pacientId, v: r.v, d: JSON.stringify(normalizujPlan(data)), pl: platnostDo || null, u: s.uzivatelId, j: kdoPlan(s), t: typ, poz: poznamka });
  return r.v;
}

export const LIMITY = ['KPR', 'Umělá plicní ventilace', 'Hospitalizace', 'Antibiotika i.v.', 'Infuze / i.v. výživa', 'Sonda / PEG', 'Dialýza', 'Transfuze'];
export const CILE = { symptom: 'Symptomatická (úleva od obtíží)', limited: 'Omezená (léčba bez resuscitace a intenzivní péče)', full: 'Plná léčba' };
