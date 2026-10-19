/**
 * Doménová logika karty pacienta (vše běží uvnitř vTenantu – RLS hlídá tenanta).
 * q = { all, one, exec } z db.js
 */
import { randomUUID } from 'node:crypto';
import { chyba } from './http.js';

export const ROLE_UZIVATELE = ['admin', 'lekar', 'sestra', 'ctenar'];
export const TYPY_POSKYTOVATELE = { NEMOCNICE: 'Nemocnice', HOSPIC: 'Mobilní hospic', AMBULANCE: 'Paliativní ambulance', PL: 'Praktický lékař', DOMOV: 'Domov / pobytová služba', ZZS: 'Záchranná služba', JINY: 'Jiný' };
export const TYPY_DENIKU = ['Založení', 'Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Návštěva hospice', 'Telefonát', 'Pozorování rodiny', 'Zhoršení stavu', 'Stav stabilizován', 'Výjezd ZZS', 'Revize', 'Úprava údajů', 'Předání garance', 'Ukončení', 'Systém'];

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
  return q.one(`SELECT TOP 1 g.GaranceID, g.PoskytovatelID, ps.Nazev AS Poskytovatel, ps.Typ, ps.Telefon24, g.LekarUzivatelID, u.Jmeno AS Lekar, u.Telefon AS LekarTelefon,
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
  return {
    vidi: true,
    aktivni,
    lekar: aktivni && jeLekar && (jeGarant || tym.some((t) => ['GARANT', 'LEKAR'].includes(t.Role))),
    garant: aktivni && ((jeGarant && (jeLekar || admin)) || admin),
    // host v týmu (např. nemocnice při hospitalizaci) jen čte – zapisuje garant, lékař a péče
    zapis: aktivni && (tym.some((t) => t.Role !== 'HOST') || admin) && !s.role.every((r) => r === 'ctenar'),
    prijmoutGaranci: aktivni && !!navrh && jeLekar,
    navrhGaranceId: navrh ? navrh.GaranceID : null,
  };
}

/** Balík dat pro telefon (vše, co průkaz zobrazuje offline). */
export async function balikProZarizeni(q, pacientId) {
  const p = await q.one(`SELECT PacientID, KodPrukazu, Jmeno, Prijmeni, RokNarozeni, CONVERT(char(10), DatumNarozeni, 23) AS DatumNarozeni, Pohlavi, Pobyt, Stav
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
  const denik = await q.all(`SELECT TOP 100 LOWER(CONVERT(varchar(36), UUID)) AS uuid, Typ AS typ, Text AS text, Autor AS autor, Role AS role,
      CONVERT(char(16), CasZapisu, 120) AS cas, Overeno AS overeno FROM dbo.A_KP_Denik WHERE PacientID = @p ORDER BY CasZapisu DESC, DenikID DESC`, { p: pacientId });
  return {
    pacient: { kod: p.KodPrukazu, jmeno: p.Jmeno, prijmeni: p.Prijmeni, rok: p.RokNarozeni || (p.DatumNarozeni ? Number(p.DatumNarozeni.slice(0, 4)) : null), pohlavi: p.Pohlavi, pobyt: p.Pobyt, stav: p.Stav },
    plan,
    garant: g ? { poskytovatel: g.Poskytovatel, typ: g.Typ, telefon24: g.Telefon24, lekar: g.Lekar, lekarTelefon: g.LekarTelefon } : null,
    kontakty, tym, piny, denik: denik.reverse(),
    serverCas: new Date().toISOString(),
  };
}

/** Normalizace dat plánu z formuláře / AI. */
export function normalizujPlan(d = {}) {
  const pole = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
  const cil = ['symptom', 'limited', 'full'].includes(d.cil) ? d.cil : 'symptom';
  return {
    cil,
    limity: pole(d.limity).slice(0, 12),
    doklad: { dvp: !!(d.doklad && d.doklad.dvp), datum: String((d.doklad && d.doklad.datum) || '').slice(0, 10), original: String((d.doklad && d.doklad.original) || '').slice(0, 200), zprava: String((d.doklad && d.doklad.zprava) || '').slice(0, 300) },
    dg: String(d.dg || '').slice(0, 1000),
    funkce: String(d.funkce || '').slice(0, 1000),
    alergie: String(d.alergie || 'žádné známé').slice(0, 300),
    sos: pole(d.sos),
    medikace: pole(d.medikace),
  };
}

export async function ulozPlan(q, { pacientId, data, platnostDo, s, typ = 'ZMENA', poznamka = null }) {
  const r = await q.one(`SELECT ISNULL(MAX(Verze), 0) + 1 AS v FROM dbo.A_KP_PlanVerze WITH (UPDLOCK, HOLDLOCK) WHERE PacientID = @p`, { p: pacientId });
  await q.exec(`INSERT INTO dbo.A_KP_PlanVerze (PacientID, Verze, Data, PlatnostDo, PodepsalUzivatelID, PodepsalJmeno, Typ, Poznamka)
    VALUES (@p, @v, @d, @pl, @u, @j, @t, @poz)`, { p: pacientId, v: r.v, d: JSON.stringify(normalizujPlan(data)), pl: platnostDo || null, u: s.uzivatelId, j: s.jmeno, t: typ, poz: poznamka });
  return r.v;
}

export const LIMITY = ['KPR', 'Umělá plicní ventilace', 'Hospitalizace', 'Antibiotika i.v.', 'Infuze / i.v. výživa', 'Sonda / PEG', 'Dialýza', 'Transfuze'];
export const CILE = { symptom: 'Symptomatická (úleva od obtíží)', limited: 'Omezená (léčba bez resuscitace a intenzivní péče)', full: 'Plná léčba' };
