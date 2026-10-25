/**
 * Centrální aplikace (garant a tým kolem pacienta) – /api/c/*
 * Session: { typ:'kp', tenant, uzivatelId } – role a pracoviště se při každém požadavku čtou znovu z DB.
 * Všechny dotazy jsou pevně na serveru a běží v kontextu tenanta (RLS); prohlížeč žádné SQL neposílá.
 */
import { Router } from 'express';
import { config } from '../config.js';
import { vTenantu } from '../db.js';
import { h, chyba, omez, omezReset, ip, bearer, text, cislo } from '../http.js';
import { podepis, overSession, hashHeslo, overHeslo, generujHeslo, zasifruj, desifruj, parovaciKod, novyPin, novyPinAsync, kodDne, konecDnePraha } from '../crypto.js';
import { audit, zapisDenik, dalsiKod, planAktualni, garant, opravneni, ulozPlan, normalizujPlan, roleSeznam, roleOsoby, ROLE_OSOBY, TYPY_POSKYTOVATELE, TYPY_DENIKU, LIMITY, CILE } from '../kp.js';
import { rozborZpravy } from '../ai.js';
import { normTel, hezkyTel, smsDostupne, smsDuvod, posliSms } from '../telefon.js';
import { nastaveniPd, pdVolej, synchronizujPacienta, stavSync, zpravyPd, posliZpravuPd, lekyPd, ulozLekPd, smazLekPd, uzivatelePd, PD_API_VYCHOZI } from '../pecedoma.js';

export const central = Router();

const TTL = 12 * 3600;
const tenantRe = /^[A-Z0-9]{16}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Přihlášený uživatel v kontextu tenanta: fn(q, s, req). */
function sUzivatelem(fn, { admin = false, lekar = false } = {}) {
  return h(async (req, res) => {
    const ses = overSession(bearer(req));
    if (!ses || ses.typ !== 'kp' || !tenantRe.test(ses.tenant || '')) throw chyba('Přihlášení vypršelo – přihlaste se prosím znovu', 401);
    return vTenantu(ses.tenant, async (q) => {
      const u = await q.one(`SELECT u.UzivatelID, u.Jmeno, u.Login, u.Role, u.Aktivni, u.PoskytovatelID, u.Telefon, u.MusiZmenitHeslo, p.Nazev AS Poskytovatel, p.Typ AS TypPoskytovatele, p.SmiBytGarant
        FROM dbo.A_KP_Uzivatel u JOIN dbo.A_KP_Poskytovatel p ON p.PoskytovatelID = u.PoskytovatelID WHERE u.UzivatelID = @u`, { u: ses.uzivatelId });
      if (!u || !u.Aktivni) throw chyba('Účet není aktivní', 401);
      const kp = await q.one(`SELECT Hodnota FROM dbo.A_KP_Nastaveni WHERE Klic = 'KP_AKTIVNI'`);
      if (!kp || kp.Hodnota !== '1') throw chyba('Karta pacienta je pro tuto organizaci vypnutá', 403);
      const s = { tenant: ses.tenant, uzivatelId: u.UzivatelID, jmeno: u.Jmeno, login: u.Login, role: roleSeznam(u.Role), poskytovatelId: u.PoskytovatelID,
        poskytovatel: u.Poskytovatel, typPoskytovatele: u.TypPoskytovatele, smiBytGarant: !!u.SmiBytGarant, telefon: u.Telefon, musiZmenitHeslo: !!u.MusiZmenitHeslo, ip: ip(req) };
      if (admin && !s.role.includes('admin')) throw chyba('Tuto akci smí jen správce organizace', 403);
      if (lekar && !s.role.includes('lekar')) throw chyba('Tuto akci smí jen lékař', 403);
      return fn(q, s, req, res);
    });
  });
}
const pid = (req) => { const n = cislo(req.params.id); if (!n) throw chyba('Chybí pacient'); return n; };

/* ---------------- přihlášení ---------------- */
central.post('/login', h(async (req) => {
  const tenant = String(req.body.tenant || '').toUpperCase().trim();
  const login = text(req.body.login, 100).toLowerCase();
  if (!tenantRe.test(tenant)) throw chyba('Neplatný kód organizace – použijte odkaz, který jste dostali');
  omez(`login:${ip(req)}:${tenant}:${login}`, 8);
  const r = await vTenantu(tenant, async (q) => {
    const kp = await q.one(`SELECT Hodnota FROM dbo.A_KP_Nastaveni WHERE Klic = 'KP_AKTIVNI'`);
    if (!kp || kp.Hodnota !== '1') throw chyba('Karta pacienta není pro tuto organizaci zapnutá', 403);
    const u = await q.one(`SELECT UzivatelID, Jmeno, HesloHash, Aktivni, MusiZmenitHeslo FROM dbo.A_KP_Uzivatel WHERE Login = @l`, { l: login });
    if (!u || !u.Aktivni || !overHeslo(req.body.heslo, u.HesloHash)) {
      await audit(q, { uzivatelId: u ? u.UzivatelID : null, kdo: login, akce: 'neúspěšné přihlášení', detail: !u ? 'neznámý login' : !u.Aktivni ? 'účet neaktivní' : 'špatné heslo', ip: ip(req) });
      return { chyba: true };
    }
    await q.exec(`UPDATE dbo.A_KP_Uzivatel SET PosledniPrihlaseni = SYSDATETIME() WHERE UzivatelID = @u`, { u: u.UzivatelID });
    await audit(q, { uzivatelId: u.UzivatelID, kdo: u.Jmeno, akce: 'přihlášení', ip: ip(req) });
    return u;
  });
  if (r.chyba) throw chyba('Nesprávné přihlašovací jméno nebo heslo', 401);
  omezReset(`login:${ip(req)}:${tenant}:${login}`);
  return { session: podepis({ typ: 'kp', tenant, uzivatelId: r.UzivatelID }, TTL), musiZmenitHeslo: !!r.MusiZmenitHeslo };
}));

central.get('/ja', sUzivatelem(async (q, s) => {
  const n = await q.all(`SELECT Klic, Hodnota FROM dbo.A_KP_Nastaveni`);
  const nast = Object.fromEntries(n.map((x) => [x.Klic, x.Hodnota]));
  const pd = await nastaveniPd(q);
  return { ja: s, nazevSite: nast.NAZEV_SITE || '', nastaveni: { intervalRevize: Number(nast.INTERVAL_REVIZE || 3) },
    // token PéčeDoma se do prohlížeče neposílá – jen zda je vyplněný
    pecedoma: { odkaz: pd.odkaz, api: pd.api, apiVychozi: PD_API_VYCHOZI, tokenNastaven: !!pd.token, sync: pd.sync, nastaveno: pd.nastaveno, partnerKlic: !!config.partnerKlic }, ciselniky: { limity: LIMITY, cile: CILE, typyPoskytovatele: TYPY_POSKYTOVATELE, typyDeniku: TYPY_DENIKU }, verejnaAdresa: config.verejnaAdresa, verze: config.verze, ai: !!config.ai.apiKey };
}));

central.post('/heslo', sUzivatelem(async (q, s, req) => {
  const u = await q.one(`SELECT HesloHash FROM dbo.A_KP_Uzivatel WHERE UzivatelID = @u`, { u: s.uzivatelId });
  if (!overHeslo(req.body.stare, u.HesloHash)) throw chyba('Současné heslo nesouhlasí', 400);
  if (String(req.body.nove || '').length < 10) throw chyba('Nové heslo musí mít aspoň 10 znaků');
  await q.exec(`UPDATE dbo.A_KP_Uzivatel SET HesloHash = @h, HesloPrvni = NULL, MusiZmenitHeslo = 0 WHERE UzivatelID = @u`, { h: hashHeslo(req.body.nove), u: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: 'změna hesla', ip: s.ip });
}));

/* ---------------- přehled pacientů a upozornění ---------------- */
const VIDITELNI = `(@admin = 1 OR EXISTS (SELECT 1 FROM dbo.A_KP_Tym t WHERE t.PacientID = p.PacientID AND t.PoskytovatelID = @ps AND t.Aktivni = 1)
  OR EXISTS (SELECT 1 FROM dbo.A_KP_Garance g2 WHERE g2.PacientID = p.PacientID AND g2.PoskytovatelID = @ps AND g2.Stav = 'NAVRZENO'))`;

central.get('/prehled', sUzivatelem(async (q, s, req) => {
  const stav = req.query.stav === 'UZAVRENY' ? 'UZAVRENY' : 'AKTIVNI';
  const pacienti = await q.all(`
    SELECT p.PacientID AS id, p.KodPrukazu AS kod, p.Jmeno AS jmeno, p.Prijmeni AS prijmeni, ISNULL(p.RokNarozeni, YEAR(p.DatumNarozeni)) AS rok, p.Pobyt AS pobyt, p.Stav AS stav,
      CONVERT(char(16), p.Zalozeno, 120) AS zalozeno, CONVERT(char(16), p.Uzavreno, 120) AS uzavreno,
      pv.Verze AS verze, CONVERT(char(10), pv.PlatnostDo, 23) AS platnostDo, JSON_VALUE(pv.Data, '$.cil') AS cil,
      g.PoskytovatelID AS garantId, gp.Nazev AS garant, gp.Typ AS garantTyp, CONVERT(char(16), g.Od, 120) AS garantOd,
      (SELECT TOP 1 CONVERT(char(16), z.PosledniSync, 120) FROM dbo.A_KP_Zarizeni z WHERE z.PacientID = p.PacientID AND z.Stav = 'SPAROVANO' AND z.Rezim = 'ZAPUJCENY' ORDER BY z.PosledniSync DESC) AS sync,
      (SELECT TOP 1 z.Baterie FROM dbo.A_KP_Zarizeni z WHERE z.PacientID = p.PacientID AND z.Stav = 'SPAROVANO' AND z.Rezim = 'ZAPUJCENY' ORDER BY z.PosledniSync DESC) AS baterie,
      (SELECT COUNT(*) FROM dbo.A_KP_Zarizeni z WHERE z.PacientID = p.PacientID AND z.Stav = 'SPAROVANO' AND z.Rezim = 'ZAPUJCENY') AS telefonu,
      (SELECT TOP 1 d.Typ FROM dbo.A_KP_Denik d WHERE d.PacientID = p.PacientID AND d.Typ IN ('Zhoršení stavu','Stav stabilizován','Výjezd ZZS') ORDER BY d.CasZapisu DESC, d.DenikID DESC) AS posledniKrize,
      (SELECT TOP 1 CONVERT(char(16), d.CasZapisu, 120) FROM dbo.A_KP_Denik d WHERE d.PacientID = p.PacientID ORDER BY d.CasZapisu DESC, d.DenikID DESC) AS posledniZapis,
      (SELECT TOP 1 CONVERT(char(16), g3.Navrzeno, 120) FROM dbo.A_KP_Garance g3 WHERE g3.PacientID = p.PacientID AND g3.Stav = 'NAVRZENO') AS predavaSe,
      (SELECT TOP 1 g4.PoskytovatelID FROM dbo.A_KP_Garance g4 WHERE g4.PacientID = p.PacientID AND g4.Stav = 'NAVRZENO') AS predavaSeKomu
    FROM dbo.A_KP_Pacient p
    OUTER APPLY (SELECT TOP 1 * FROM dbo.A_KP_PlanVerze v WHERE v.PacientID = p.PacientID ORDER BY v.Verze DESC) pv
    LEFT JOIN dbo.A_KP_Garance g ON g.PacientID = p.PacientID AND g.Stav = 'PLATNA'
    LEFT JOIN dbo.A_KP_Poskytovatel gp ON gp.PoskytovatelID = g.PoskytovatelID
    WHERE p.Stav = @stav AND ${VIDITELNI}
    ORDER BY p.Prijmeni, p.Jmeno`, { stav, admin: s.role.includes('admin'), ps: s.poskytovatelId });

  const dnes = new Date(); const d = (x) => (x ? new Date(x.replace(' ', 'T')) : null);
  const upozorneni = [];
  for (const p of pacienti) {
    if (p.stav !== 'AKTIVNI') continue;
    const jm = `${p.prijmeni} ${p.jmeno}`;
    if (p.platnostDo) {
      const dni = Math.ceil((new Date(p.platnostDo) - dnes) / 864e5);
      if (dni < 0) upozorneni.push({ uroven: 'crit', pacientId: p.id, text: `${jm}: plán je po platnosti (${p.platnostDo}) – čeká na revizi` });
      else if (dni <= 14) upozorneni.push({ uroven: 'warn', pacientId: p.id, text: `${jm}: revize plánu do ${dni} dní` });
    } else upozorneni.push({ uroven: 'warn', pacientId: p.id, text: `${jm}: chybí plán péče` });
    if (p.posledniKrize === 'Zhoršení stavu') upozorneni.push({ uroven: 'crit', pacientId: p.id, text: `${jm}: probíhá zhoršení stavu` });
    if (p.telefonu > 0 && p.sync && (dnes - d(p.sync)) > 12 * 3600e3) upozorneni.push({ uroven: 'warn', pacientId: p.id, text: `${jm}: telefon se nepřipojil od ${p.sync}` });
    if (p.telefonu > 0 && p.baterie != null && p.baterie < 20) upozorneni.push({ uroven: 'warn', pacientId: p.id, text: `${jm}: baterie telefonu ${p.baterie} %` });
    if (p.telefonu === 0) upozorneni.push({ uroven: 'info', pacientId: p.id, text: `${jm}: průkaz zatím není v žádném telefonu` });
    if (p.predavaSe) {
      const hod = (dnes - d(p.predavaSe)) / 3600e3;
      if (p.predavaSeKomu === s.poskytovatelId) upozorneni.push({ uroven: 'crit', pacientId: p.id, text: `${jm}: čeká na vaše převzetí garance` });
      else if (hod > 72) upozorneni.push({ uroven: 'warn', pacientId: p.id, text: `${jm}: předání garance čeká na potvrzení déle než 72 h` });
    }
    if (p.garantTyp === 'NEMOCNICE' && p.garantOd && (dnes - d(p.garantOd)) > 30 * 864e5) upozorneni.push({ uroven: 'warn', pacientId: p.id, text: `${jm}: nemocnice je garantem déle než 30 dní – předejte garanci` });
    if (!p.garant) upozorneni.push({ uroven: 'crit', pacientId: p.id, text: `${jm}: pacient nemá garanta` });
  }
  const poradi = { crit: 0, warn: 1, info: 2 };
  upozorneni.sort((a, b) => poradi[a.uroven] - poradi[b.uroven]);
  return { pacienti, upozorneni };
}));

/* ---------------- poskytovatelé (výběr pro tým a předání) ---------------- */
central.get('/poskytovatele', sUzivatelem(async (q) => ({
  poskytovatele: await q.all(`SELECT PoskytovatelID AS id, Nazev AS nazev, ICO AS ico, ICP AS icp, Typ AS typ, SmiBytGarant AS smiBytGarant, Telefon24 AS telefon24, Adresa AS adresa, Aktivni AS aktivni
    FROM dbo.A_KP_Poskytovatel ORDER BY Aktivni DESC, Nazev`),
})));

/* ---------------- nový pacient ---------------- */
central.post('/pacient', sUzivatelem(async (q, s, req) => {
  const b = req.body || {};
  const pa = b.pacient || {};
  const jmeno = text(pa.jmeno, 80), prijmeni = text(pa.prijmeni, 80);
  if (!jmeno || !prijmeni) throw chyba('Vyplňte jméno a příjmení');
  const rc = text(pa.rc, 11).replace(/\s/g, '') || null;
  if (rc && !/^\d{6}\/?\d{3,4}$/.test(rc)) throw chyba('Rodné číslo má tvar 123456/7890');
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(pa.datumNarozeni || '') ? pa.datumNarozeni : null;
  const rok = cislo(pa.rok) || (datum ? Number(datum.slice(0, 4)) : null);
  if (!rok || rok < 1900 || rok > new Date().getFullYear()) throw chyba('Vyplňte rok nebo datum narození');
  const telKarty = normTel(pa.telefonKarty);
  if (!telKarty) throw chyba('Vyplňte číslo telefonu, na kterém bude karta (např. +420 777 123 456) – na žádném jiném telefonu karta nebude');
  if (rc) {
    const dup = await q.one(`SELECT KodPrukazu FROM dbo.A_KP_Pacient WHERE RodneCislo = @rc AND Stav = 'AKTIVNI'`, { rc });
    if (dup) throw chyba(`Pacient s tímto rodným číslem už má aktivní průkaz ${dup.KodPrukazu}`, 409);
  }
  const garantId = cislo(b.garantPoskytovatelId) || s.poskytovatelId;
  const gp = await q.one(`SELECT PoskytovatelID, Nazev, SmiBytGarant FROM dbo.A_KP_Poskytovatel WHERE PoskytovatelID = @p AND Aktivni = 1`, { p: garantId });
  if (!gp) throw chyba('Garantující pracoviště nenalezeno');
  if (!gp.SmiBytGarant) throw chyba(`${gp.Nazev} nemůže být garantem (garantem je nemocnice, hospic, paliativní ambulance nebo praktický lékař)`);

  const kod = await dalsiKod(q);
  const pac = await q.one(`INSERT INTO dbo.A_KP_Pacient (KodPrukazu, Jmeno, Prijmeni, RodneCislo, DatumNarozeni, RokNarozeni, Pohlavi, Pojistovna, Adresa, Pobyt, TelefonKarty, Email, ZalozilUzivatelID)
    OUTPUT inserted.PacientID VALUES (@k, @j, @p, @rc, @dn, @r, @po, @poj, @a, @pb, @tk, @em, @u)`,
  { k: kod, j: jmeno, p: prijmeni.toUpperCase(), rc, dn: datum, r: rok, po: text(pa.pohlavi, 10) || null, poj: text(pa.pojistovna, 3) || null, a: text(pa.adresa, 300) || null, pb: text(pa.pobyt, 200) || null, tk: telKarty, em: text(pa.email, 150) || null, u: s.uzivatelId });
  const id = pac.PacientID;
  await q.exec(`INSERT INTO dbo.A_KP_Garance (PacientID, PoskytovatelID, LekarUzivatelID, Stav, Od, NavrhlUzivatelID) VALUES (@p, @ps, @l, 'PLATNA', SYSDATETIME(), @u)`,
    { p: id, ps: garantId, l: garantId === s.poskytovatelId ? s.uzivatelId : null, u: s.uzivatelId });
  const tym = new Set([garantId, s.poskytovatelId, ...(Array.isArray(b.tym) ? b.tym.map(Number).filter(Boolean) : [])]);
  for (const t of tym) await q.exec(`INSERT INTO dbo.A_KP_Tym (PacientID, PoskytovatelID, Role) SELECT @p, @ps, @r WHERE EXISTS (SELECT 1 FROM dbo.A_KP_Poskytovatel WHERE PoskytovatelID = @ps)`,
    { p: id, ps: t, r: t === garantId ? 'GARANT' : (t === s.poskytovatelId ? 'LEKAR' : 'PECE') });
  const platnost = /^\d{4}-\d{2}-\d{2}$/.test(b.platnostDo || '') ? b.platnostDo : new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  await ulozPlan(q, { pacientId: id, data: b.plan || {}, platnostDo: platnost, s, typ: 'ZALOZENI' });
  let i = 0;
  for (const k of (b.kontakty || []).slice(0, 30)) {
    const sk = String(k.skupina || 'INFORMOVAT').toUpperCase();
    if (!text(k.jmeno) || !text(k.tel)) continue;
    await q.exec(`INSERT INTO dbo.A_KP_Kontakt (PacientID, Jmeno, Telefon, Skupina, Poznamka, Poradi) VALUES (@p, @j, @t, @s, @poz, @o)`,
      { p: id, j: text(k.jmeno, 150), t: text(k.tel, 40), s: ['ROZHODUJE', 'INFORMOVAT', 'PECUJE'].includes(sk) ? sk : 'INFORMOVAT', poz: text(k.pozn, 200) || null, o: (i += 10) });
  }
  await zapisDenik(q, { pacientId: id, typ: 'Založení', text: b.aiPouzito ? 'Průkaz založen z propouštěcí zprávy (anonymní AI rozbor potvrzen lékařem).' : 'Průkaz založen po rozhovoru o cílech péče.', autor: s.jmeno, role: s.role.includes('lekar') ? 'lekar' : 'sestra', uzivatelId: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'založení průkazu', detail: kod, ip: s.ip });
  // pacient z PéčeDoma (výběr klienta nebo soubor Export pro Kartu pacienta): zapamatovat klienta a rovnou stáhnout léky a návštěvu
  const pdId = String((b.pecedoma || {}).klientId || '').toLowerCase();
  if (UUID_RE.test(pdId)) {
    await q.exec(`UPDATE dbo.A_KP_Pacient SET PdKlientID = @k, PdPortalKlientID = @pk WHERE PacientID = @p`, { k: pdId, pk: cislo((b.pecedoma || {}).portalKlientId) || null, p: id });
    try { const nast = await nastaveniPd(q); if (nast.nastaveno) await synchronizujPacienta(q, nast, id, pdId); } catch { /* bez synchronizace – doplní se automaticky nebo tlačítkem */ }
  }
  return { id, kod };
}, { lekar: true }));

/* ---------------- detail pacienta ---------------- */
central.get('/pacient/:id', sUzivatelem(async (q, s, req) => {
  const id = pid(req);
  const op = await opravneni(q, s, id);
  const pacient = await q.one(`SELECT PacientID AS id, KodPrukazu AS kod, Jmeno AS jmeno, Prijmeni AS prijmeni, RodneCislo AS rc, CONVERT(char(10), DatumNarozeni, 23) AS datumNarozeni,
      RokNarozeni AS rok, Pohlavi AS pohlavi, Pojistovna AS pojistovna, Adresa AS adresa, Pobyt AS pobyt, TelefonKarty AS telefonKarty, Email AS email, Stav AS stav, Souhlas AS souhlas,
      LOWER(CONVERT(char(36), PdKlientID)) AS pdKlientId, PdPortalKlientID AS pdPortalKlientId,
      CONVERT(char(16), Zalozeno, 120) AS zalozeno, CONVERT(char(16), Uzavreno, 120) AS uzavreno, DuvodUzavreni AS duvodUzavreni
    FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: id });
  const plan = await planAktualni(q, id);
  const verze = await q.all(`SELECT Verze AS verze, Typ AS typ, PodepsalJmeno AS podepsal, CONVERT(char(16), Vytvoreno, 120) AS vytvoreno, CONVERT(char(10), PlatnostDo, 23) AS platnostDo, Poznamka AS poznamka
    FROM dbo.A_KP_PlanVerze WHERE PacientID = @p ORDER BY Verze DESC`, { p: id });
  const kontakty = await q.all(`SELECT KontaktID AS id, Jmeno AS jmeno, Telefon AS tel, Skupina AS skupina, Poznamka AS pozn, Poradi AS poradi FROM dbo.A_KP_Kontakt WHERE PacientID = @p AND Aktivni = 1 ORDER BY Poradi, KontaktID`, { p: id });
  const tym = await q.all(`SELECT t.TymID AS id, t.PoskytovatelID AS poskytovatelId, ps.Nazev AS nazev, ps.Typ AS typ, ps.Telefon24 AS telefon24, t.Role AS role, CONVERT(char(10), t.Od, 23) AS od
    FROM dbo.A_KP_Tym t JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = t.PoskytovatelID WHERE t.PacientID = @p AND t.Aktivni = 1 ORDER BY CASE t.Role WHEN 'GARANT' THEN 0 ELSE 1 END, ps.Nazev`, { p: id });
  const garance = await q.all(`SELECT g.GaranceID AS id, g.PoskytovatelID AS poskytovatelId, ps.Nazev AS nazev, g.Stav AS stav, u.Jmeno AS lekar, n.Jmeno AS navrhl,
      CONVERT(char(16), g.Navrzeno, 120) AS navrzeno, CONVERT(char(16), g.Od, 120) AS od, CONVERT(char(16), g.Do, 120) AS do, g.Poznamka AS poznamka
    FROM dbo.A_KP_Garance g JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = g.PoskytovatelID
    LEFT JOIN dbo.A_KP_Uzivatel u ON u.UzivatelID = g.LekarUzivatelID LEFT JOIN dbo.A_KP_Uzivatel n ON n.UzivatelID = g.NavrhlUzivatelID
    WHERE g.PacientID = @p ORDER BY g.GaranceID DESC`, { p: id });
  const zarizeni = await q.all(`SELECT ZarizeniID AS id, Stitek AS stitek, Stav AS stav, CONVERT(char(16), Sparovano, 120) AS sparovano, CONVERT(char(16), PosledniSync, 120) AS sync,
      Baterie AS baterie, VerzeAplikace AS verzeAplikace, DelkaFronty AS fronta, VerzePlanuVZarizeni AS verzePlanu, ParovaciKod AS kod, CONVERT(char(16), ParovaciPlatnost, 120) AS kodPlatnost, Telefon AS telefon, Rezim AS rezim
    FROM dbo.A_KP_Zarizeni WHERE PacientID = @p ORDER BY ZarizeniID DESC`, { p: id });
  const piny = await q.all(`SELECT PinID AS id, Jmeno AS jmeno, Role AS role, CONVERT(char(10), Vytvoreno, 23) AS vytvoreno FROM dbo.A_KP_Pin WHERE PacientID = @p AND Aktivni = 1 ORDER BY PinID`, { p: id });
  const lide = await q.all(`SELECT po.PacientOsobaID AS id, o.OsobaID AS osobaId, o.Jmeno AS jmeno, o.Role AS role, o.Tym AS tym, o.PoskytovatelID AS poskytovatelId, ps.Nazev AS poskytovatel,
      CONVERT(char(10), po.Od, 23) AS od, CASE WHEN o.Hash IS NULL THEN 0 ELSE 1 END AS maPin, po.TymLidiID AS tymId
    FROM dbo.A_KP_PacientOsoba po JOIN dbo.A_KP_Osoba o ON o.OsobaID = po.OsobaID JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = o.PoskytovatelID
    WHERE po.PacientID = @p AND po.Aktivni = 1 AND o.Aktivni = 1 ORDER BY ps.Nazev, o.Tym, o.Jmeno`, { p: id });
  // týmy lidí u pacienta (0.10.0): členové z agendy Lidé a týmy, u pacienta jde člena jen deaktivovat
  const tymyLidi = await q.all(`SELECT pt.PacientTymID AS id, t.TymLidiID AS tymId, t.Nazev AS nazev, t.Popis AS popis, t.PoskytovatelID AS poskytovatelId, ps.Nazev AS poskytovatel, CONVERT(char(10), pt.Od, 23) AS od
    FROM dbo.A_KP_PacientTym pt JOIN dbo.A_KP_TymLidi t ON t.TymLidiID = pt.TymLidiID JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = t.PoskytovatelID
    WHERE pt.PacientID = @p AND pt.Aktivni = 1 ORDER BY ps.Nazev, t.Nazev`, { p: id });
  for (const t of tymyLidi) {
    t.clenove = await q.all(`SELECT o.OsobaID AS osobaId, o.Jmeno AS jmeno, o.Role AS role, ps.Nazev AS poskytovatel, CASE WHEN o.Hash IS NULL THEN 0 ELSE 1 END AS maPin, ISNULL(x.Aktivni, 0) AS aktivni
      FROM dbo.A_KP_TymClen c JOIN dbo.A_KP_Osoba o ON o.OsobaID = c.OsobaID JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = o.PoskytovatelID
      OUTER APPLY (SELECT TOP 1 po.Aktivni FROM dbo.A_KP_PacientOsoba po WHERE po.PacientID = @p AND po.OsobaID = o.OsobaID ORDER BY po.Aktivni DESC, po.PacientOsobaID DESC) x
      WHERE c.TymLidiID = @t AND o.Aktivni = 1 ORDER BY ps.Nazev, o.Jmeno`, { p: id, t: t.tymId });
  }
  const vTymuPs = new Set(tym.map((t) => t.poskytovatelId));
  const tymyNabidka = await q.all(`SELECT t.TymLidiID AS id, t.Nazev AS nazev, t.Popis AS popis, t.PoskytovatelID AS poskytovatelId, ps.Nazev AS poskytovatel,
      (SELECT COUNT(*) FROM dbo.A_KP_TymClen c JOIN dbo.A_KP_Osoba o ON o.OsobaID = c.OsobaID WHERE c.TymLidiID = t.TymLidiID AND o.Aktivni = 1) AS clenu
    FROM dbo.A_KP_TymLidi t JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = t.PoskytovatelID
    WHERE t.Aktivni = 1 AND ps.Aktivni = 1 AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_PacientTym pt WHERE pt.PacientID = @p AND pt.TymLidiID = t.TymLidiID AND pt.Aktivni = 1)
    ORDER BY ps.Nazev, t.Nazev`, { p: id });
  for (const t of tymyNabidka) {   // pracoviště členů, která zatím nejsou v týmu kolem pacienta (přidáním týmu je garant přidá s rolí péče)
    const ps = await q.all(`SELECT DISTINCT p2.PoskytovatelID AS id, p2.Nazev AS nazev FROM dbo.A_KP_TymClen c JOIN dbo.A_KP_Osoba o ON o.OsobaID = c.OsobaID JOIN dbo.A_KP_Poskytovatel p2 ON p2.PoskytovatelID = o.PoskytovatelID WHERE c.TymLidiID = @t AND o.Aktivni = 1`, { t: t.id });
    t.mimoTym = ps.filter((x) => !vTymuPs.has(x.id)).map((x) => x.nazev);
  }
  const denik = await q.all(`SELECT TOP 300 LOWER(CONVERT(varchar(36), UUID)) AS uuid, Typ AS typ, Text AS text, Autor AS autor, Role AS role, CONVERT(char(16), CasZapisu, 120) AS cas,
      CONVERT(char(16), CasPrijeti, 120) AS prijato, Overeno AS overeno, ZarizeniID AS zarizeni FROM dbo.A_KP_Denik WHERE PacientID = @p ORDER BY CasZapisu DESC, DenikID DESC`, { p: id });
  const dokumenty = await q.all(`SELECT DokumentID AS id, Typ AS typ, Nazev AS nazev, KdeOriginal AS kdeOriginal, MimeType AS mime, Velikost AS velikost, CONVERT(char(16), Vytvoreno, 120) AS vytvoreno,
      CONVERT(char(10), DatumDokumentu, 23) AS datum, Pracoviste AS pracoviste
    FROM dbo.A_KP_Dokument WHERE PacientID = @p ORDER BY DokumentID DESC`, { p: id });
  // co pacient sám poslal z vlastního telefonu (údaje pacienta – odděleně od záznamů týmu)
  const odPacienta = (await q.all(`SELECT TOP 30 SdileniID AS id, CONVERT(char(16), Vytvoreno, 120) AS cas, Polozky AS polozky FROM dbo.A_KP_Sdileni WHERE PacientID = @p ORDER BY SdileniID DESC`, { p: id }))
    .map((x) => ({ ...x, polozky: (() => { try { return JSON.parse(x.polozky); } catch { return []; } })() }));
  const pristupy = op.garant || s.role.includes('admin') ? await q.all(`SELECT TOP 80 CONVERT(char(16), Cas, 120) AS cas, Kdo AS kdo, Akce AS akce, Detail AS detail FROM dbo.A_KP_AuditLog WHERE PacientID = @p ORDER BY AuditID DESC`, { p: id }) : [];
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'zobrazení průkazu', ip: s.ip });
  const pdNast = await nastaveniPd(q);
  const pecedoma = { klientId: pacient.pdKlientId, portalKlientId: pacient.pdPortalKlientId, odkaz: pdNast.odkaz, nastaveno: pdNast.nastaveno, autoSync: pdNast.sync, sync: pacient.pdKlientId ? await stavSync(q, id) : null };
  return { pacient, plan, verze, kontakty, tym, garance, zarizeni, piny, lide, tymyLidi, tymyNabidka, denik, dokumenty, odPacienta, pristupy, pecedoma, op, smsDostupne: smsDostupne() };
}));

central.get('/pacient/:id/plan/:verze', sUzivatelem(async (q, s, req) => {
  const id = pid(req);
  await opravneni(q, s, id);
  const v = await q.one(`SELECT Verze, Data, CONVERT(char(10), PlatnostDo, 23) AS PlatnostDo, PodepsalJmeno, Typ, CONVERT(char(16), Vytvoreno, 120) AS Vytvoreno FROM dbo.A_KP_PlanVerze WHERE PacientID = @p AND Verze = @v`, { p: id, v: Number(req.params.verze) });
  if (!v) throw chyba('Verze nenalezena', 404);
  return { verze: v.Verze, data: JSON.parse(v.Data), platnostDo: v.PlatnostDo, podepsal: v.PodepsalJmeno, typ: v.Typ, vytvoreno: v.Vytvoreno };
}));

/* ---------------- úpravy ---------------- */
central.post('/pacient/:id/udaje', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.lekar && !op.garant) throw chyba('Údaje pacienta upravuje lékař z týmu', 403);
  const pa = req.body || {};
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(pa.datumNarozeni || '') ? pa.datumNarozeni : null;
  const telKarty = normTel(pa.telefonKarty);
  if (!telKarty) throw chyba('Vyplňte číslo telefonu, na kterém je karta (např. +420 777 123 456)');
  const dosud = await q.one(`SELECT TelefonKarty FROM dbo.A_KP_Pacient WHERE PacientID = @id`, { id });
  await q.exec(`UPDATE dbo.A_KP_Pacient SET Jmeno = @j, Prijmeni = @p, RodneCislo = @rc, DatumNarozeni = @dn, RokNarozeni = @r, Pohlavi = @po, Pojistovna = @poj, Adresa = @a, Pobyt = @pb, TelefonKarty = @tk, Email = @em WHERE PacientID = @id`,
    { id, j: text(pa.jmeno, 80), p: text(pa.prijmeni, 80).toUpperCase(), rc: text(pa.rc, 11) || null, dn: datum, r: cislo(pa.rok) || (datum ? Number(datum.slice(0, 4)) : null), po: text(pa.pohlavi, 10) || null, poj: text(pa.pojistovna, 3) || null, a: text(pa.adresa, 300) || null, pb: text(pa.pobyt, 200) || null, tk: telKarty, em: text(pa.email, 150) || null });
  await zapisDenik(q, { pacientId: id, typ: 'Úprava údajů', text: 'Upraveny identifikační údaje nebo místo pobytu.', autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
  if (dosud && dosud.TelefonKarty !== telKarty) {
    // karta smí být jen na novém čísle: telefon spárovaný s jiným číslem se zablokuje (při připojení se vymaže), čekající kódy propadnou
    const n = await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = 'ZABLOKOVANO', ParovaciKod = NULL WHERE PacientID = @id AND Stav IN ('SPAROVANO', 'CEKA') AND Rezim = 'ZAPUJCENY' AND ISNULL(Telefon, N'') <> @tk`, { id, tk: telKarty });
    await zapisDenik(q, { pacientId: id, typ: 'Systém', text: `Číslo telefonu s kartou změněno na ${hezkyTel(telKarty)}.${n ? ' Telefon na předchozím čísle byl zablokován – při připojení se z něj karta smaže.' : ''}`, autor: s.jmeno, role: 'system', uzivatelId: s.uzivatelId });
  }
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'úprava údajů', ip: s.ip });
}));

central.post('/pacient/:id/plan', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.lekar) throw chyba('Plán péče mění jen lékař garanta nebo lékař v týmu', 403);
  const b = req.body || {};
  const typ = b.typ === 'REVIZE' ? 'REVIZE' : 'ZMENA';
  let data = b.data;
  if (typ === 'REVIZE' && !data) { const p = await planAktualni(q, id); data = p ? p.data : {}; }
  const platnost = /^\d{4}-\d{2}-\d{2}$/.test(b.platnostDo || '') ? b.platnostDo : null;
  const v = await ulozPlan(q, { pacientId: id, data, platnostDo: platnost, s, typ, poznamka: text(b.poznamka, 500) || null });
  await zapisDenik(q, { pacientId: id, typ: 'Revize', text: typ === 'REVIZE' ? `Plán péče revidován beze změny, platnost do ${platnost || '—'}.${b.poznamka ? ' ' + text(b.poznamka, 300) : ''}` : `Plán péče upraven (verze ${v}).${b.poznamka ? ' ' + text(b.poznamka, 300) : ''}`, autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: typ === 'REVIZE' ? 'revize plánu' : 'změna plánu', detail: `verze ${v}`, ip: s.ip });
  return { verze: v };
}));

central.post('/pacient/:id/kontakt', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.zapis) throw chyba('Kontakty upravuje tým kolem pacienta', 403);
  const b = req.body || {};
  const sk = String(b.skupina || 'INFORMOVAT').toUpperCase();
  if (!['ROZHODUJE', 'INFORMOVAT', 'PECUJE'].includes(sk)) throw chyba('Neznámá skupina kontaktu');
  const kid = cislo(b.id);
  const poradi = text(b.poradi) === '' ? null : cislo(b.poradi);   // prázdné = beze změny (Number('') by bylo 0)
  if (kid) {
    const k = await q.one(`SELECT Skupina FROM dbo.A_KP_Kontakt WHERE KontaktID = @k AND PacientID = @p AND Aktivni = 1`, { k: kid, p: id });
    if (!k) throw chyba('Kontakt nenalezen', 404);
    if (b.jenPoradi) {   // přeřazení šipkami: jen pořadí, bez zápisu do deníku (pořadí smí měnit celý tým, i u skupiny „rozhoduje“)
      if (poradi === null) throw chyba('Chybí pořadí');
      await q.exec(`UPDATE dbo.A_KP_Kontakt SET Poradi = @o, Zmeneno = SYSDATETIME() WHERE KontaktID = @k`, { k: kid, o: poradi });
      return;
    }
    if ((k.Skupina === 'ROZHODUJE' || sk === 'ROZHODUJE') && !op.lekar) throw chyba('Kontakt „rozhoduje“ mění jen lékař (na základě dokladu)', 403);
    if (b.smazat) await q.exec(`UPDATE dbo.A_KP_Kontakt SET Aktivni = 0, Zmeneno = SYSDATETIME() WHERE KontaktID = @k`, { k: kid });
    else {
      if (!text(b.jmeno) || !text(b.tel)) throw chyba('Vyplňte jméno i telefon');
      await q.exec(`UPDATE dbo.A_KP_Kontakt SET Jmeno = @j, Telefon = @t, Skupina = @s, Poznamka = @poz, Poradi = ISNULL(@o, Poradi), Zmeneno = SYSDATETIME() WHERE KontaktID = @k`,
        { k: kid, j: text(b.jmeno, 150), t: text(b.tel, 40), s: sk, poz: text(b.pozn, 200) || null, o: poradi });
    }
  } else {
    if (sk === 'ROZHODUJE' && !op.lekar) throw chyba('Kontakt „rozhoduje“ přidává jen lékař (na základě dokladu)', 403);
    if (!text(b.jmeno) || !text(b.tel)) throw chyba('Vyplňte jméno i telefon');
    await q.exec(`INSERT INTO dbo.A_KP_Kontakt (PacientID, Jmeno, Telefon, Skupina, Poznamka, Poradi) VALUES (@p, @j, @t, @s, @poz, ISNULL(@o, 100))`,
      { p: id, j: text(b.jmeno, 150), t: text(b.tel, 40), s: sk, poz: text(b.pozn, 200) || null, o: poradi });
  }
  await zapisDenik(q, { pacientId: id, typ: 'Úprava údajů', text: `${b.smazat ? 'Odebrán' : kid ? 'Upraven' : 'Přidán'} kontakt ${text(b.jmeno, 150)} (${sk.toLowerCase()}).`, autor: s.jmeno, role: s.role.includes('lekar') ? 'lekar' : 'sestra', uzivatelId: s.uzivatelId });
}));

central.post('/pacient/:id/denik', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.zapis) throw chyba('Do deníku zapisuje tým kolem pacienta', 403);
  const typ = TYPY_DENIKU.includes(req.body.typ) ? req.body.typ : 'Změna stavu';
  const t = text(req.body.text, 4000);
  if (!t) throw chyba('Napište text zápisu');
  await zapisDenik(q, { pacientId: id, typ, text: t, autor: s.jmeno, role: s.role.includes('lekar') ? 'lekar' : 'sestra', uzivatelId: s.uzivatelId });
}));

central.post('/pacient/:id/souhlas', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.lekar && !op.garant) throw chyba('Potvrzuje lékař', 403);
  const t = `${new Date().toISOString().slice(0, 10)} · ${s.jmeno}`;
  await q.exec(`UPDATE dbo.A_KP_Pacient SET Souhlas = @t WHERE PacientID = @p`, { t, p: id });
  await zapisDenik(q, { pacientId: id, typ: 'Úprava údajů', text: 'Pacient / zástupce podepsal informaci o vedení průkazu.', autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
}));

/* ---------------- tým a garance ---------------- */
central.post('/pacient/:id/tym', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.garant) throw chyba('Tým kolem pacienta spravuje garant', 403);
  const b = req.body || {};
  if (b.odebratId) {
    const t = await q.one(`SELECT Role, PoskytovatelID FROM dbo.A_KP_Tym WHERE TymID = @t AND PacientID = @p AND Aktivni = 1`, { t: cislo(b.odebratId), p: id });
    if (!t) throw chyba('Člen týmu nenalezen', 404);
    if (t.Role === 'GARANT') throw chyba('Garanta nelze odebrat – nejdřív předejte garanci');
    await q.exec(`UPDATE dbo.A_KP_Tym SET Aktivni = 0, Do = SYSDATETIME() WHERE TymID = @t`, { t: cislo(b.odebratId) });
    // PINy jeho personálu přestanou platit
    await q.exec(`UPDATE dbo.A_KP_Pin SET Aktivni = 0 WHERE PacientID = @p AND PoskytovatelID = @ps`, { p: id, ps: t.PoskytovatelID });
    await q.exec(`UPDATE po SET Aktivni = 0, Do = SYSDATETIME() FROM dbo.A_KP_PacientOsoba po JOIN dbo.A_KP_Osoba o ON o.OsobaID = po.OsobaID
      WHERE po.PacientID = @p AND po.Aktivni = 1 AND o.PoskytovatelID = @ps`, { p: id, ps: t.PoskytovatelID });
    await q.exec(`UPDATE pt SET Aktivni = 0, Do = SYSDATETIME() FROM dbo.A_KP_PacientTym pt JOIN dbo.A_KP_TymLidi tl ON tl.TymLidiID = pt.TymLidiID
      WHERE pt.PacientID = @p AND pt.Aktivni = 1 AND tl.PoskytovatelID = @ps`, { p: id, ps: t.PoskytovatelID });
    await zapisDenik(q, { pacientId: id, typ: 'Úprava údajů', text: 'Pracoviště odebráno z týmu kolem pacienta; jeho lidé a PINy už kartu neodemknou.', autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
    return {};
  }
  const ps = cislo(b.poskytovatelId);
  const role = ['PECE', 'LEKAR', 'HOST'].includes(b.role) ? b.role : 'PECE';
  const p = await q.one(`SELECT Nazev FROM dbo.A_KP_Poskytovatel WHERE PoskytovatelID = @ps AND Aktivni = 1`, { ps });
  if (!p) throw chyba('Pracoviště nenalezeno');
  const ex = await q.one(`SELECT TymID FROM dbo.A_KP_Tym WHERE PacientID = @p AND PoskytovatelID = @ps AND Aktivni = 1`, { p: id, ps });
  if (ex) await q.exec(`UPDATE dbo.A_KP_Tym SET Role = CASE WHEN Role = 'GARANT' THEN Role ELSE @r END WHERE TymID = @t`, { r: role, t: ex.TymID });
  else await q.exec(`INSERT INTO dbo.A_KP_Tym (PacientID, PoskytovatelID, Role) VALUES (@p, @ps, @r)`, { p: id, ps, r: role });
  await zapisDenik(q, { pacientId: id, typ: 'Úprava údajů', text: `Do týmu kolem pacienta přidáno: ${p.Nazev} (${role.toLowerCase()}).`, autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
}));

central.post('/pacient/:id/predat', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.garant) throw chyba('Garanci předává dosavadní garant', 403);
  const ps = cislo(req.body.poskytovatelId);
  const p = await q.one(`SELECT Nazev, SmiBytGarant FROM dbo.A_KP_Poskytovatel WHERE PoskytovatelID = @ps AND Aktivni = 1`, { ps });
  if (!p) throw chyba('Pracoviště nenalezeno');
  if (!p.SmiBytGarant) throw chyba(`${p.Nazev} nemůže být garantem (domov ani ZZS garantem nejsou)`);
  const g = await garant(q, id);
  if (g && g.PoskytovatelID === ps) throw chyba('Toto pracoviště už je garantem');
  await q.exec(`UPDATE dbo.A_KP_Garance SET Stav = 'ODMITNUTO', Poznamka = ISNULL(Poznamka, '') + ' (nahrazeno novým návrhem)' WHERE PacientID = @p AND Stav = 'NAVRZENO'`, { p: id });
  await q.exec(`INSERT INTO dbo.A_KP_Garance (PacientID, PoskytovatelID, Stav, NavrhlUzivatelID, Poznamka) VALUES (@p, @ps, 'NAVRZENO', @u, @poz)`, { p: id, ps, u: s.uzivatelId, poz: text(req.body.poznamka, 500) || null });
  await q.exec(`IF NOT EXISTS (SELECT 1 FROM dbo.A_KP_Tym WHERE PacientID = @p AND PoskytovatelID = @ps AND Aktivni = 1)
    INSERT INTO dbo.A_KP_Tym (PacientID, PoskytovatelID, Role) VALUES (@p, @ps, 'PECE')`, { p: id, ps });
  await zapisDenik(q, { pacientId: id, typ: 'Předání garance', text: `Navrženo předání garance: ${p.Nazev}. Do potvrzení zůstává garantem ${g ? g.Poskytovatel : '—'}.`, autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'návrh předání garance', detail: p.Nazev, ip: s.ip });
}));

central.post('/pacient/:id/prevzit', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.prijmoutGaranci) throw chyba('Garanci přebírá lékař navrženého pracoviště', 403);
  const prijmout = req.body.prijmout !== false;
  const stary = await garant(q, id);
  if (prijmout) {
    await q.exec(`UPDATE dbo.A_KP_Garance SET Stav = 'UKONCENA', Do = SYSDATETIME() WHERE PacientID = @p AND Stav = 'PLATNA'`, { p: id });
    await q.exec(`UPDATE dbo.A_KP_Garance SET Stav = 'PLATNA', Od = SYSDATETIME(), LekarUzivatelID = @u WHERE GaranceID = @g`, { g: op.navrhGaranceId, u: s.uzivatelId });
    await q.exec(`UPDATE dbo.A_KP_Tym SET Role = CASE WHEN PoskytovatelID = @ps THEN 'GARANT' WHEN Role = 'GARANT' THEN 'PECE' ELSE Role END WHERE PacientID = @p AND Aktivni = 1`, { p: id, ps: s.poskytovatelId });
    await zapisDenik(q, { pacientId: id, typ: 'Předání garance', text: `Garanci převzal(a) ${s.jmeno}, ${s.poskytovatel}${stary ? ` (dosud ${stary.Poskytovatel})` : ''}.`, autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
  } else {
    await q.exec(`UPDATE dbo.A_KP_Garance SET Stav = 'ODMITNUTO', Do = SYSDATETIME(), Poznamka = @poz WHERE GaranceID = @g`, { g: op.navrhGaranceId, poz: text(req.body.duvod, 400) || 'odmítnuto' });
    await zapisDenik(q, { pacientId: id, typ: 'Předání garance', text: `Převzetí garance odmítl(a) ${s.jmeno}, ${s.poskytovatel}. Garantem zůstává ${stary ? stary.Poskytovatel : '—'}.`, autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
  }
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: prijmout ? 'převzetí garance' : 'odmítnutí garance', ip: s.ip });
}));

/* ---------------- telefon: párování, PINy, kód lékaře ---------------- */
central.post('/pacient/:id/parovat', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.garant && !op.lekar) throw chyba('Telefon páruje garant nebo lékař v týmu', 403);
  const pac = await q.one(`SELECT TelefonKarty FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: id });
  const telKarty = normTel(pac && pac.TelefonKarty);
  if (!telKarty) throw chyba('Nejdřív u pacienta vyplňte číslo telefonu, na kterém bude karta (záložka Údaje) – karta jde nahrát jen do telefonu s tímto číslem');
  const kod = parovaciKod();
  const platnost = new Date(Date.now() + 15 * 60e3);
  // čekající nespárovaný telefon pacienta se použije znovu, jinak nový záznam
  const z = await q.one(`SELECT TOP 1 ZarizeniID FROM dbo.A_KP_Zarizeni WHERE PacientID = @p AND Stav = 'CEKA' AND Rezim = 'ZAPUJCENY' ORDER BY ZarizeniID DESC`, { p: id });
  let zid;
  if (z) { zid = z.ZarizeniID; await q.exec(`UPDATE dbo.A_KP_Zarizeni SET ParovaciKod = @k, ParovaciPlatnost = @pl, Stitek = ISNULL(@st, Stitek) WHERE ZarizeniID = @z`, { k: kod, pl: platnost, st: text(req.body.stitek, 60) || null, z: zid }); }
  else zid = (await q.one(`INSERT INTO dbo.A_KP_Zarizeni (PacientID, Stitek, ParovaciKod, ParovaciPlatnost) OUTPUT inserted.ZarizeniID VALUES (@p, @st, @k, @pl)`, { p: id, st: text(req.body.stitek, 60) || null, k: kod, pl: platnost })).ZarizeniID;
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, zarizeniId: zid, akce: 'párovací kód vydán', ip: s.ip });
  const odkaz = `${config.verejnaAdresa}/karta/#p=${s.tenant}.${kod}.T${telKarty.replace(/\D/g, '')}`;   // .T<číslo> = předvyplnění čísla v telefonu
  let sms = null;
  if (req.body.sms) {   // odkaz SMS na číslo s kartou – dostane ho jen tento telefon
    try { await posliSms(telKarty, `Karta pacienta: otevřete odkaz v tomto telefonu a potvrďte jeho číslo. ${odkaz} (platí 15 minut)`); sms = { ok: true };
      await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, zarizeniId: zid, akce: 'párovací odkaz poslán SMS', detail: hezkyTel(telKarty), ip: s.ip });
    } catch (e) { sms = { ok: false, chyba: e.message }; }
  }
  // jeden telefon pro více pacientů (domov seniorů, 0.11.0): průkazy ostatních pacientů na stejném čísle v telefonu zůstanou, nový se přidá
  const dalsi = await q.all(`SELECT DISTINCT p.Prijmeni + ' ' + p.Jmeno AS jmeno FROM dbo.A_KP_Zarizeni z JOIN dbo.A_KP_Pacient p ON p.PacientID = z.PacientID
    WHERE z.Stav = 'SPAROVANO' AND z.Rezim = 'ZAPUJCENY' AND z.PacientID <> @p AND p.Stav = 'AKTIVNI' AND z.Telefon = @tel ORDER BY jmeno`, { p: id, tel: telKarty });
  return { zarizeniId: zid, kod, tenant: s.tenant, platnost: platnost.toISOString(), odkaz, telefonKarty: hezkyTel(telKarty), smsDostupne: smsDostupne(), smsDuvod: smsDuvod(), sms, dalsiNaTelefonu: dalsi.map((x) => x.jmeno) };
}));

/* vlastní telefon pacienta („Můj průkaz“): kód jen pro číslo pacienta, SMS na něj, nebo QR v ordinaci; platí 3 dny */
central.post('/pacient/:id/pacientovi', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.garant && !op.lekar) throw chyba('Průkaz pacientovi zpřístupňuje garant nebo lékař v týmu', 403);
  if (!op.aktivni) throw chyba('Průkaz je uzavřený');
  const tel = normTel(req.body.telefon);
  if (!tel) throw chyba('Zadejte číslo mobilu pacienta (např. +420 777 123 456) – kód půjde použít jen s ním');
  const kod = parovaciKod();
  const platnost = new Date(Date.now() + 72 * 3600e3);
  const z = await q.one(`SELECT TOP 1 ZarizeniID FROM dbo.A_KP_Zarizeni WHERE PacientID = @p AND Stav = 'CEKA' AND Rezim = 'PACIENT' ORDER BY ZarizeniID DESC`, { p: id });
  let zid;
  if (z) { zid = z.ZarizeniID; await q.exec(`UPDATE dbo.A_KP_Zarizeni SET ParovaciKod = @k, ParovaciPlatnost = @pl, Telefon = @t WHERE ZarizeniID = @z`, { k: kod, pl: platnost, t: tel, z: zid }); }
  else zid = (await q.one(`INSERT INTO dbo.A_KP_Zarizeni (PacientID, Stitek, ParovaciKod, ParovaciPlatnost, Telefon, Rezim) OUTPUT inserted.ZarizeniID VALUES (@p, N'telefon pacienta', @k, @pl, @t, 'PACIENT')`,
    { p: id, k: kod, pl: platnost, t: tel })).ZarizeniID;
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, zarizeniId: zid, akce: 'kód pro vlastní telefon pacienta vydán', detail: hezkyTel(tel), ip: s.ip });
  const odkaz = `${config.verejnaAdresa}/pacient/#p=${s.tenant}.${kod}.T${tel.replace(/\D/g, '')}`;   // .T<číslo> = pacient číslo jen potvrdí
  let sms = null;
  if (req.body.sms) {
    try { await posliSms(tel, `Můj průkaz: lékař vám zpřístupnil váš paliativní průkaz. Otevřete odkaz v tomto telefonu: ${odkaz} (platí 3 dny)`); sms = { ok: true };
      await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, zarizeniId: zid, akce: 'odkaz pro vlastní telefon poslán SMS', detail: hezkyTel(tel), ip: s.ip });
    } catch (e) { sms = { ok: false, chyba: e.message }; }
  }
  return { zarizeniId: zid, kod, tenant: s.tenant, platnost: platnost.toISOString(), odkaz, telefon: hezkyTel(tel), smsDostupne: smsDostupne(), smsDuvod: smsDuvod(), sms };
}));

central.post('/pacient/:id/zarizeni', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.garant && !s.role.includes('admin')) throw chyba('Telefony spravuje garant', 403);
  const zid = cislo(req.body.zarizeniId);
  const akce = req.body.akce;
  const stav = { zablokovat: 'ZABLOKOVANO', vratit: 'VRACENO' }[akce];
  if (!stav) throw chyba('Neznámá akce');
  const z = await q.one(`SELECT Rezim FROM dbo.A_KP_Zarizeni WHERE ZarizeniID = @z AND PacientID = @p`, { z: zid, p: id });
  if (!z) throw chyba('Telefon nenalezen', 404);
  await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = @s, TokenHash = CASE WHEN @s = 'VRACENO' THEN NULL ELSE TokenHash END, ParovaciKod = NULL WHERE ZarizeniID = @z AND PacientID = @p`, { s: stav, z: zid, p: id });
  const pacientuv = z.Rezim === 'PACIENT';
  await zapisDenik(q, { pacientId: id, typ: 'Systém', text: pacientuv
    ? (akce === 'zablokovat' ? 'Přístup ve vlastním telefonu pacienta ukončen – data od lékaře se v něm přestanou aktualizovat (co už pacient má, zůstává jeho kopií).' : 'Vlastní telefon pacienta odebrán ze seznamu.')
    : (akce === 'zablokovat' ? 'Telefon zablokován – při příštím připojení se data v něm smažou.' : 'Telefon vrácen provozovateli.'), autor: s.jmeno, role: 'system', uzivatelId: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, zarizeniId: zid, akce: `telefon: ${akce}`, ip: s.ip });
}));

central.post('/pacient/:id/pin', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.garant && !op.lekar) throw chyba('PINy vydává garant nebo lékař v týmu', 403);
  if (req.body.zrusitId) {
    await q.exec(`UPDATE dbo.A_KP_Pin SET Aktivni = 0 WHERE PinID = @i AND PacientID = @p`, { i: cislo(req.body.zrusitId), p: id });
    await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'PIN zrušen', ip: s.ip });
    return {};
  }
  const jmeno = text(req.body.jmeno, 150);
  const role = String(req.body.role || 'RODINA').toUpperCase();
  if (!jmeno) throw chyba('Vyplňte jméno držitele PINu');
  if (!['SESTRA', 'RODINA', 'HOSPIC', 'PL'].includes(role)) throw chyba('Neznámá role');
  const ps = cislo(req.body.poskytovatelId);
  const n = novyPin();
  await q.exec(`INSERT INTO dbo.A_KP_Pin (PacientID, Jmeno, Role, PoskytovatelID, Salt, Hash, Iterace, VytvorilUzivatelID) VALUES (@p, @j, @r, @ps, @s, @h, @i, @u)`,
    { p: id, j: jmeno, r: role, ps, s: n.salt, h: n.hash, i: n.iterace, u: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'PIN vydán', detail: `${jmeno} (${role.toLowerCase()})`, ip: s.ip });
  return { pin: n.pin };
}));

central.get('/pacient/:id/kod-lekare', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!s.role.includes('lekar') || !(op.lekar || op.garant)) throw chyba('Kód pro odemčení telefonu dostane jen lékař z týmu', 403);
  const z = await q.one(`SELECT TOP 1 ZarizeniID, Tajemstvi FROM dbo.A_KP_Zarizeni WHERE PacientID = @p AND Stav = 'SPAROVANO' AND Rezim = 'ZAPUJCENY' ORDER BY Sparovano DESC`, { p: id });
  if (!z) throw chyba('Pacient nemá spárovaný telefon');
  const t = desifruj(z.Tajemstvi);
  if (!t) throw chyba('Tajemství telefonu nelze přečíst – spárujte telefon znovu', 500);
  // kód dne: celý kalendářní den stejný (najde ho i lékař v PéčeDoma – /api/partner/kod-dne)
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, zarizeniId: z.ZarizeniID, akce: 'kód lékaře vydán', ip: s.ip });
  return { kod: kodDne(t), platiDo: konecDnePraha(), lekar: s.jmeno };
}));

/* ---------------- PéčeDoma: výběr klienta, propojení pacienta, synchronizace ---------------- */
central.get('/pecedoma/klienti', sUzivatelem(async (q, s, req) => {
  const nast = await nastaveniPd(q);
  const filtr = String(req.query.filtr || '').split(',').map((x) => x.trim()).filter((x) => ['hospic', 't720', 'lpp'].includes(x)).join(',');
  const r = await pdVolej(nast, 'klienti', { q: text(req.query.q, 100), filtr });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: 'PéčeDoma: hledání klienta', detail: [text(req.query.q, 100), filtr].filter(Boolean).join(' · ') || null, ip: s.ip });
  return { klienti: Array.isArray(r.klienti) ? r.klienti : [], skupiny: r.skupiny || null };
}, { lekar: true }));

central.get('/pecedoma/klient/:id', sUzivatelem(async (q, s, req) => {
  const kid = String(req.params.id || '').toLowerCase();
  if (!UUID_RE.test(kid)) throw chyba('Neplatný klient');
  const nast = await nastaveniPd(q);
  const r = await pdVolej(nast, 'klient', { klientId: kid });
  if (!r.karta) throw chyba('PéčeDoma nevrátilo údaje klienta', 502);
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: 'PéčeDoma: načtení klienta', detail: kid, ip: s.ip });
  return { karta: r.karta, klientId: kid };
}, { lekar: true }));

/* propojit / odpojit existujícího pacienta s klientem PéčeDoma (lékař nebo garant) */
central.post('/pacient/:id/pecedoma', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.lekar && !op.garant) throw chyba('Propojení s PéčeDoma mění lékař nebo garant', 403);
  const kid = String(req.body.klientId || '').toLowerCase();
  if (req.body.odpojit) {
    await q.exec(`UPDATE dbo.A_KP_Pacient SET PdKlientID = NULL, PdPortalKlientID = NULL WHERE PacientID = @p`, { p: id });
    await q.exec(`DELETE FROM dbo.A_KP_PdSync WHERE PacientID = @p`, { p: id });
    await zapisDenik(q, { pacientId: id, typ: 'Systém', text: 'Propojení s klientem PéčeDoma zrušeno.', autor: s.jmeno, role: 'system', uzivatelId: s.uzivatelId });
    await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'PéčeDoma: odpojení', ip: s.ip });
    return {};
  }
  if (!UUID_RE.test(kid)) throw chyba('Vyberte klienta PéčeDoma');
  await q.exec(`UPDATE dbo.A_KP_Pacient SET PdKlientID = @k, PdPortalKlientID = NULL WHERE PacientID = @p`, { k: kid, p: id });
  await zapisDenik(q, { pacientId: id, typ: 'Systém', text: 'Pacient propojen s klientem PéčeDoma – léky a plánované návštěvy se přebírají z PéčeDoma.', autor: s.jmeno, role: 'system', uzivatelId: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'PéčeDoma: propojení', detail: kid, ip: s.ip });
  const nast = await nastaveniPd(q);
  let sync = null, chybaSync = null;
  try { await synchronizujPacienta(q, nast, id, kid); sync = await stavSync(q, id); } catch (e) { chybaSync = e.message; }
  return { sync, chyba: chybaSync };
}));

/* chat PéčeDoma s klientem (od 0.8.0): zprávy A_MSPPP_Zprava portálu – tým kolem pacienta čte a píše jako „Tým“ se značkou [Karta · jméno] */
async function pdKlientPacienta(q, id) {
  const p = await q.one(`SELECT LOWER(CONVERT(char(36), PdKlientID)) AS pd FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: id });
  if (!p || !p.pd) throw chyba('Pacient není propojený s klientem PéčeDoma');
  return p.pd;
}
central.get('/pacient/:id/pecedoma/zpravy', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.zapis) throw chyba('Chat PéčeDoma vidí tým kolem pacienta', 403);
  const r = await zpravyPd(await nastaveniPd(q), await pdKlientPacienta(q, id));
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'PéčeDoma: chat zobrazen', detail: `${r.zpravy.length} zpráv`, ip: s.ip });
  return r;
}));
central.post('/pacient/:id/pecedoma/zprava', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.zapis || !op.aktivni) throw chyba('Zprávu do PéčeDoma píše tým kolem pacienta u aktivního průkazu', 403);
  omez('pdchat:' + s.uzivatelId, 60, 3600e3);
  const r = await posliZpravuPd(await nastaveniPd(q), await pdKlientPacienta(q, id), { text: text(req.body.text, 4000), smer: 'OD_TYMU', kdo: s.jmeno });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'PéčeDoma: zpráva odeslána', ip: s.ip });
  return r;
}));

/* Léky – jedna agenda (od 0.9.0). Propojený pacient: léky jsou v PéčeDoma (A_MSPPP_Medikace) a Karta je tam čte i mění, pak hned
   synchronizuje (A_KP_PdSync → karta, telefon, Můj průkaz). Nepropojený pacient: léky jsou součást plánu (nová verze přes /plan). */
central.get('/pacient/:id/leky', sUzivatelem(async (q, s, req) => {
  const id = pid(req); await opravneni(q, s, id);
  const p = await q.one(`SELECT LOWER(CONVERT(char(36), PdKlientID)) AS pd FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: id });
  if (!p || !p.pd) return { zdroj: 'plan' };
  const r = await lekyPd(await nastaveniPd(q), p.pd);
  return { zdroj: 'pecedoma', leky: r.leky };
}));
async function lekPd(q, s, req, akce) {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.zapis || !op.aktivni) throw chyba('Léky upravuje tým kolem pacienta u aktivního průkazu', 403);
  const pd = await pdKlientPacienta(q, id);
  const nast = await nastaveniPd(q);
  const b = req.body || {};
  let r, detail;
  if (akce === 'uloz') {
    const lek = { id: b.id ? String(b.id) : undefined, typ: text(b.typ, 15), nazev: text(b.nazev, 200), davka: text(b.davka, 200), instr: text(b.instr, 500), popis: text(b.popis, 300) };
    if (!lek.nazev) throw chyba('Vyplňte název léku');
    r = await ulozLekPd(nast, pd, lek, s.jmeno);
    detail = `${lek.id ? 'upraven' : 'přidán'} ${lek.typ === 'ZACHRANNA' ? 'SOS lék' : 'lék'} ${lek.nazev}${lek.davka ? ' ' + lek.davka : ''}`;
  } else {
    if (!b.id) throw chyba('Chybí lék');
    r = await smazLekPd(nast, pd, b.id, s.jmeno);
    detail = `vyřazen lék ${text(b.nazev, 200) || '#' + b.id}`;
  }
  let sync = null;
  try { await synchronizujPacienta(q, nast, id, pd); sync = await stavSync(q, id); } catch (e) { /* léky jsou uložené v PéčeDoma, synchronizace doběhne automaticky */ }
  await zapisDenik(q, { pacientId: id, typ: 'Úprava léků', text: `Léky (PéčeDoma): ${detail}.`, autor: s.jmeno, role: 'tym', uzivatelId: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'PéčeDoma: úprava léků', detail, ip: s.ip });
  return { leky: r.leky, sync };
}
central.post('/pacient/:id/leky', sUzivatelem((q, s, req) => lekPd(q, s, req, 'uloz')));
central.post('/pacient/:id/leky/smaz', sUzivatelem((q, s, req) => lekPd(q, s, req, 'smaz')));

central.post('/pacient/:id/pecedoma/sync', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.zapis) throw chyba('Synchronizaci spouští tým kolem pacienta', 403);
  const p = await q.one(`SELECT LOWER(CONVERT(char(36), PdKlientID)) AS pd FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: id });
  if (!p || !p.pd) throw chyba('Pacient není propojený s klientem PéčeDoma');
  const nast = await nastaveniPd(q);
  const v = await synchronizujPacienta(q, nast, id, p.pd);
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'PéčeDoma: synchronizace', detail: `${v.medikace.length + v.sos.length} léků${v.pristiNavsteva ? ', návštěva ' + v.pristiNavsteva : ''}`, ip: s.ip });
  return { sync: await stavSync(q, id) };
}));

/* ---------------- dokumenty ---------------- */
central.post('/pacient/:id/dokument', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.lekar && !op.garant) throw chyba('Dokumenty vkládá lékař', 403);
  const b = req.body || {};
  const data = b.data ? Buffer.from(String(b.data), 'base64') : null;
  if (data && data.length > 8 * 1024 * 1024) throw chyba('Soubor je větší než 8 MB');
  const typ = ['DVP', 'ZPRAVA', 'SOUHLAS', 'JINY'].includes(b.typ) ? b.typ : 'JINY';
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(b.datum || '') ? b.datum : null;
  await q.exec(`INSERT INTO dbo.A_KP_Dokument (PacientID, Typ, Nazev, KdeOriginal, MimeType, Obsah, Velikost, VlozilUzivatelID, DatumDokumentu, Pracoviste) VALUES (@p, @t, @n, @k, @m, @o, @v, @u, @d, @pr)`,
    { p: id, t: typ, n: text(b.nazev, 200) || 'dokument', k: text(b.kdeOriginal, 200) || null, m: text(b.mime, 80) || null, o: data, v: data ? data.length : null, u: s.uzivatelId, d: datum, pr: text(b.pracoviste, 200) || null });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'vložen dokument', detail: text(b.nazev, 200), ip: s.ip });
}));

central.get('/pacient/:id/dokument/:did', sUzivatelem(async (q, s, req, res) => {
  const id = pid(req); await opravneni(q, s, id);
  const d = await q.one(`SELECT Nazev, MimeType, Obsah FROM dbo.A_KP_Dokument WHERE DokumentID = @d AND PacientID = @p`, { d: cislo(req.params.did), p: id });
  if (!d || !d.Obsah) throw chyba('Dokument nemá přiložený soubor', 404);
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'stažen dokument', detail: d.Nazev, ip: s.ip });
  res.setHeader('Content-Type', d.MimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(d.Nazev)}`);
  res.end(d.Obsah);
}));

/* ---------------- výpis a ukončení ---------------- */
central.post('/pacient/:id/vypis', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!s.role.includes('lekar') && !op.garant) throw chyba('Výpis pořizuje lékař', 403);
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'pořízen výpis', ip: s.ip });
}));

central.post('/pacient/:id/uzavrit', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.garant) throw chyba('Průkaz uzavírá garant', 403);
  const duvod = text(req.body.duvod, 200) || 'ukončení péče';
  await q.exec(`UPDATE dbo.A_KP_Pacient SET Stav = 'UZAVRENY', Uzavreno = SYSDATETIME(), DuvodUzavreni = @d WHERE PacientID = @p`, { d: duvod, p: id });
  await q.exec(`UPDATE dbo.A_KP_Garance SET Stav = CASE WHEN Stav = 'PLATNA' THEN 'UKONCENA' ELSE 'ODMITNUTO' END, Do = SYSDATETIME() WHERE PacientID = @p AND Stav IN ('PLATNA', 'NAVRZENO')`, { p: id });
  await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = 'ZABLOKOVANO', ParovaciKod = NULL WHERE PacientID = @p AND Stav IN ('SPAROVANO', 'CEKA')`, { p: id });
  await q.exec(`UPDATE dbo.A_KP_Pin SET Aktivni = 0 WHERE PacientID = @p`, { p: id });
  await zapisDenik(q, { pacientId: id, typ: 'Ukončení', text: `Průkaz uzavřen: ${duvod}. Telefon se při příštím připojení vymaže.`, autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'uzavření průkazu', detail: duvod, ip: s.ip });
}));

/* ---------------- AI rozbor (anonymně) ---------------- */
central.post('/ai/rozbor', sUzivatelem(async (q, s, req) => {
  const t = String(req.body.text || '');
  if (t.trim().length < 40) throw chyba('Vložte text propouštěcí zprávy');
  if (t.length > 60000) throw chyba('Text je příliš dlouhý (max. 60 000 znaků)');
  const pa = req.body.znamo || {};
  const znamo = { jmeno: text(pa.jmeno, 80), prijmeni: text(pa.prijmeni, 80), rc: text(pa.rc, 11), datumNarozeni: pa.datumNarozeni, adresa: text(pa.adresa, 300), telefony: [], osoby: [] };
  const pacId = cislo(req.body.pacientId);
  if (pacId) {
    await opravneni(q, s, pacId);
    const p = await q.one(`SELECT Jmeno, Prijmeni, RodneCislo, CONVERT(char(10), DatumNarozeni, 23) AS DN, Adresa FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: pacId });
    Object.assign(znamo, { jmeno: p.Jmeno, prijmeni: p.Prijmeni, rc: p.RodneCislo, datumNarozeni: p.DN, adresa: p.Adresa });
    const k = await q.all(`SELECT Jmeno, Telefon FROM dbo.A_KP_Kontakt WHERE PacientID = @p`, { p: pacId });
    znamo.osoby = k.map((x) => x.Jmeno); znamo.telefony = k.map((x) => x.Telefon);
  }
  const r = await rozborZpravy(t, znamo);
  await q.exec(`INSERT INTO dbo.A_KP_AIDotaz (UzivatelID, Ucel, DelkaTextu, PocetNahrad, Blokovano, Model, Vysledek) VALUES (@u, N'rozbor zprávy', @d, @n, @b, @m, @v)`,
    { u: s.uzivatelId, d: t.length, n: r.pocetNahrad || 0, b: !!r.blokovano, m: r.model || null, v: r.blokovano ? 'BLOK' : (r.zdroj === 'ai' ? 'OK' : 'LOKALNE') });
  return r;
}, { lekar: true }));

/* ---------------- lidé a týmy pracovišť (zapíší se jednou, k pacientovi se přiřazují) ---------------- */
// správce organizace spravuje lidi všech pracovišť, ostatní (kromě „jen čtení“) lidi svého pracoviště – i partner, např. domov
const smiSpravovatLidi = (s, ps) => s.role.includes('admin') || (ps === s.poskytovatelId && s.role.some((r) => r !== 'ctenar'));
const TEXT_PIN = (pin) => `Karta pacienta – váš osobní PIN: ${pin}. Odemknete jím kartu na telefonu u pacientů, ke kterým jste přiřazen(a). PIN nikomu nesdělujte.`;
async function pinSms(telefon, pin) {
  if (!normTel(telefon)) return { ok: false, chyba: 'chybí platné číslo telefonu' };
  try { await posliSms(telefon, TEXT_PIN(pin)); return { ok: true }; } catch (e) { return { ok: false, chyba: e.message }; }
}
function ctiOsobu(b, typPracoviste) {
  const jmeno = text(b.jmeno, 150);
  if (jmeno.length < 3) throw chyba('Vyplňte jméno');
  const role = ROLE_OSOBY[b.role] ? b.role : roleOsoby(b.role, typPracoviste);
  if (!role) throw chyba(`Neznámá role u „${jmeno}“ – použijte lékař, praktický lékař, hospic nebo sestra DPS`);
  return { jmeno, role, tym: text(b.tym, 60) || null, telefon: text(b.telefon, 30) || null, email: text(b.email, 150) || null, pozn: text(b.pozn, 200) || null };
}
async function pracoviste(q, s, psId) {
  const ps = await q.one(`SELECT PoskytovatelID, Nazev, Typ, Aktivni FROM dbo.A_KP_Poskytovatel WHERE PoskytovatelID = @ps`, { ps: cislo(psId) });
  if (!ps) throw chyba('Pracoviště nenalezeno', 404);
  if (!smiSpravovatLidi(s, ps.PoskytovatelID)) throw chyba('Lidi tohoto pracoviště spravuje jeho pracovník nebo správce organizace', 403);
  return ps;
}

/* ---- týmy lidí (0.10.0): hlavička týmu v A_KP_TymLidi, členství = A_KP_Osoba.Tym; u pacientů se členové drží v A_KP_PacientOsoba (TymLidiID) ---- */
async function zajistiTymLidi(q, psId, nazev, uzivatelId) {
  const n = text(nazev, 60); if (!n) return null;
  const t = await q.one(`SELECT TymLidiID FROM dbo.A_KP_TymLidi WHERE PoskytovatelID = @ps AND Nazev = @n`, { ps: psId, n });
  if (t) { await q.exec(`UPDATE dbo.A_KP_TymLidi SET Aktivni = 1 WHERE TymLidiID = @t AND Aktivni = 0`, { t: t.TymLidiID }); return t.TymLidiID; }
  const r = await q.one(`INSERT INTO dbo.A_KP_TymLidi (PoskytovatelID, Nazev, VytvorilUzivatelID) OUTPUT inserted.TymLidiID VALUES (@ps, @n, @u)`, { ps: psId, n, u: uzivatelId });
  return r.TymLidiID;
}
/** Srovná A_KP_PacientOsoba podle aktuálních členů týmu u všech pacientů, kteří tým mají: nové členy přidá (pokud u pacienta z tohoto týmu
 *  ještě žádný záznam nemají – deaktivovaný člen se sám nevrátí), kdo už v týmu není nebo tým u pacienta skončil, ztratí přístup. */
async function synchronizujTymUPacientu(q, tymId, uzivatelId = null) {
  const t = await q.one(`SELECT TymLidiID, PoskytovatelID, Nazev, Aktivni FROM dbo.A_KP_TymLidi WHERE TymLidiID = @t`, { t: tymId });
  if (!t) return;
  const prm = { t: t.TymLidiID, ps: t.PoskytovatelID, n: t.Nazev, akt: t.Aktivni ? 1 : 0, u: uzivatelId };
  // pracoviště členů patří do týmu kolem pacienta (role péče) – tým schválil garant přidáním k pacientovi
  await q.exec(`INSERT INTO dbo.A_KP_Tym (PacientID, PoskytovatelID, Role)
    SELECT DISTINCT pt.PacientID, o.PoskytovatelID, 'PECE' FROM dbo.A_KP_PacientTym pt JOIN dbo.A_KP_TymClen c ON c.TymLidiID = pt.TymLidiID JOIN dbo.A_KP_Osoba o ON o.OsobaID = c.OsobaID
    WHERE pt.TymLidiID = @t AND pt.Aktivni = 1 AND @akt = 1 AND o.Aktivni = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_Tym x WHERE x.PacientID = pt.PacientID AND x.PoskytovatelID = o.PoskytovatelID AND x.Aktivni = 1)`, prm);
  // člověk je u pacienta aktivní nejvýš jednou (UX_A_KP_PacientOsoba_Aktivni), i když je ve více týmech u téhož pacienta:
  // nový člen se přidá, jen když u pacienta ještě není aktivní (přes jiný tým nebo jednotlivě) a z tohoto týmu nebyl deaktivován
  await q.exec(`INSERT INTO dbo.A_KP_PacientOsoba (PacientID, OsobaID, TymLidiID, PridalUzivatelID)
    SELECT pt.PacientID, o.OsobaID, @t, @u FROM dbo.A_KP_PacientTym pt JOIN dbo.A_KP_TymClen c ON c.TymLidiID = pt.TymLidiID JOIN dbo.A_KP_Osoba o ON o.OsobaID = c.OsobaID
    WHERE pt.TymLidiID = @t AND pt.Aktivni = 1 AND @akt = 1 AND o.Aktivni = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_PacientOsoba po WHERE po.PacientID = pt.PacientID AND po.OsobaID = o.OsobaID AND po.TymLidiID = @t)
      AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_PacientOsoba po WHERE po.PacientID = pt.PacientID AND po.OsobaID = o.OsobaID AND po.Aktivni = 1)`, prm);
  // kdo z tohoto týmu odchází (tým skončil, člověk vyřazen nebo z týmu odebrán), ale u pacienta zůstává přes jiný aktivní tým → jen přepsat původ
  const JINY_TYM = `SELECT TOP 1 pt2.TymLidiID FROM dbo.A_KP_PacientTym pt2 JOIN dbo.A_KP_TymLidi t2 ON t2.TymLidiID = pt2.TymLidiID JOIN dbo.A_KP_TymClen c2 ON c2.TymLidiID = pt2.TymLidiID
      WHERE pt2.PacientID = po.PacientID AND pt2.Aktivni = 1 AND t2.Aktivni = 1 AND pt2.TymLidiID <> @t AND c2.OsobaID = po.OsobaID ORDER BY pt2.TymLidiID`;
  const ODCHAZI = `po.TymLidiID = @t AND po.Aktivni = 1 AND (@akt = 0 OR o.Aktivni = 0
      OR NOT EXISTS (SELECT 1 FROM dbo.A_KP_TymClen c WHERE c.TymLidiID = @t AND c.OsobaID = o.OsobaID)
      OR NOT EXISTS (SELECT 1 FROM dbo.A_KP_PacientTym pt WHERE pt.PacientID = po.PacientID AND pt.TymLidiID = @t AND pt.Aktivni = 1))`;
  await q.exec(`UPDATE po SET TymLidiID = (${JINY_TYM}) FROM dbo.A_KP_PacientOsoba po JOIN dbo.A_KP_Osoba o ON o.OsobaID = po.OsobaID
    WHERE ${ODCHAZI} AND o.Aktivni = 1 AND EXISTS (${JINY_TYM})`, prm);
  await q.exec(`UPDATE po SET Aktivni = 0, Do = SYSDATETIME() FROM dbo.A_KP_PacientOsoba po JOIN dbo.A_KP_Osoba o ON o.OsobaID = po.OsobaID
    WHERE ${ODCHAZI}`, prm);
}
async function pridejClena(q, tymId, osobaId, uzivatelId = null) {
  if (!tymId || !osobaId) return;
  await q.exec(`INSERT INTO dbo.A_KP_TymClen (TymLidiID, OsobaID, PridalUzivatelID) SELECT @t, @o, @u WHERE NOT EXISTS (SELECT 1 FROM dbo.A_KP_TymClen WHERE TymLidiID = @t AND OsobaID = @o)`, { t: tymId, o: osobaId, u: uzivatelId });
  await synchronizujTymUPacientu(q, tymId, uzivatelId);
}
async function synchronizujTymyPracoviste(q, psId, uzivatelId = null) {
  for (const t of await q.all(`SELECT TymLidiID FROM dbo.A_KP_TymLidi WHERE PoskytovatelID = @ps`, { ps: psId })) await synchronizujTymUPacientu(q, t.TymLidiID, uzivatelId);
}
/** týmy, ve kterých je člověk (i týmy jiných pracovišť) – po změně člověka */
async function synchronizujTymyOsoby(q, osobaId, uzivatelId = null) {
  for (const t of await q.all(`SELECT TymLidiID FROM dbo.A_KP_TymClen WHERE OsobaID = @o`, { o: osobaId })) await synchronizujTymUPacientu(q, t.TymLidiID, uzivatelId);
}

/** tým lidí: založení / úprava (název, popis, aktivní) a členové – lidé kteréhokoli pracoviště organizace (i třetích stran); tým patří pracovišti, které ho založilo (garant) */
central.post('/tym-lidi', sUzivatelem(async (q, s, req) => {
  const b = req.body || {};
  const ps = await pracoviste(q, s, b.poskytovatelId);
  const nazev = text(b.nazev, 60); if (nazev.length < 2) throw chyba('Vyplňte název týmu');
  const popis = text(b.popis, 200) || null, aktivni = b.aktivni !== false;
  let id = cislo(b.id), puv = null;
  if (id) {
    puv = await q.one(`SELECT TymLidiID, PoskytovatelID, Nazev FROM dbo.A_KP_TymLidi WHERE TymLidiID = @t`, { t: id });
    if (!puv) throw chyba('Tým nenalezen', 404);
    if (puv.PoskytovatelID !== ps.PoskytovatelID) throw chyba('Tým patří jinému pracovišti');
  }
  const dup = await q.one(`SELECT TymLidiID FROM dbo.A_KP_TymLidi WHERE PoskytovatelID = @ps AND Nazev = @n AND TymLidiID <> @t`, { ps: ps.PoskytovatelID, n: nazev, t: id || 0 });
  if (dup) throw chyba(`Tým „${nazev}“ už v pracovišti je`);
  if (puv) {
    await q.exec(`UPDATE dbo.A_KP_TymLidi SET Nazev = @n, Popis = @p, Aktivni = @a WHERE TymLidiID = @t`, { n: nazev, p: popis, a: aktivni, t: id });
  } else {
    id = (await q.one(`INSERT INTO dbo.A_KP_TymLidi (PoskytovatelID, Nazev, Popis, Aktivni, VytvorilUzivatelID) OUTPUT inserted.TymLidiID VALUES (@ps, @n, @p, @a, @u)`,
      { ps: ps.PoskytovatelID, n: nazev, p: popis, a: aktivni, u: s.uzivatelId })).TymLidiID;
  }
  if (Array.isArray(b.clenove)) {
    const ids = b.clenove.map(cislo).filter(Boolean).slice(0, 500);
    const seznam = ids.length ? ids.join(',') : '0';
    await q.exec(`DELETE FROM dbo.A_KP_TymClen WHERE TymLidiID = @t AND OsobaID NOT IN (${seznam})`, { t: id });
    await q.exec(`INSERT INTO dbo.A_KP_TymClen (TymLidiID, OsobaID, PridalUzivatelID) SELECT @t, o.OsobaID, @u FROM dbo.A_KP_Osoba o
      WHERE o.OsobaID IN (${seznam}) AND o.Aktivni = 1 AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_TymClen c WHERE c.TymLidiID = @t AND c.OsobaID = o.OsobaID)`, { t: id, u: s.uzivatelId });
  }
  await synchronizujTymUPacientu(q, id, s.uzivatelId);
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: puv ? 'úprava týmu lidí' : 'nový tým lidí', detail: `${nazev} (${ps.Nazev})${aktivni ? '' : ' – zrušen'}`, ip: s.ip });
  return { id };
}));

/** smazání týmu (0.11.2): u pacientů ztratí členové přístup získaný tímto týmem (přes jiný tým zůstanou), tým zmizí z nabídky i přehledu */
central.post('/tym-lidi/:id/smazat', sUzivatelem(async (q, s, req) => {
  const t = await q.one(`SELECT t.TymLidiID, t.PoskytovatelID, t.Nazev, ps.Nazev AS Pracoviste FROM dbo.A_KP_TymLidi t JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = t.PoskytovatelID WHERE t.TymLidiID = @t`, { t: cislo(req.params.id) });
  if (!t) throw chyba('Tým nenalezen', 404);
  if (!smiSpravovatLidi(s, t.PoskytovatelID)) throw chyba('Tým maže pracoviště, které ho založilo, nebo správce organizace', 403);
  const pacientu = (await q.one(`SELECT COUNT(*) AS n FROM dbo.A_KP_PacientTym WHERE TymLidiID = @t AND Aktivni = 1`, { t: t.TymLidiID })).n;
  await q.exec(`UPDATE dbo.A_KP_TymLidi SET Aktivni = 0 WHERE TymLidiID = @t`, { t: t.TymLidiID });
  await synchronizujTymUPacientu(q, t.TymLidiID, s.uzivatelId);   // členové u pacientů: přepsat na jiný tým, nebo vyřadit
  await q.exec(`UPDATE dbo.A_KP_PacientOsoba SET TymLidiID = NULL WHERE TymLidiID = @t`, { t: t.TymLidiID });
  await q.exec(`DELETE FROM dbo.A_KP_PacientTym WHERE TymLidiID = @t`, { t: t.TymLidiID });
  await q.exec(`DELETE FROM dbo.A_KP_TymClen WHERE TymLidiID = @t`, { t: t.TymLidiID });
  await q.exec(`DELETE FROM dbo.A_KP_TymLidi WHERE TymLidiID = @t`, { t: t.TymLidiID });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: 'smazání týmu lidí', detail: `${t.Nazev} (${t.Pracoviste})${pacientu ? ` – odebrán u ${pacientu} pacientů` : ''}`, ip: s.ip });
  return { pacientu };
}));

central.get('/lide', sUzivatelem(async (q) => ({
  clenstvi: await q.all(`SELECT c.TymLidiID AS tymId, c.OsobaID AS osobaId FROM dbo.A_KP_TymClen c JOIN dbo.A_KP_Osoba o ON o.OsobaID = c.OsobaID WHERE o.Aktivni = 1`),
  tymy: await q.all(`SELECT t.TymLidiID AS id, t.PoskytovatelID AS poskytovatelId, p.Nazev AS poskytovatel, t.Nazev AS nazev, t.Popis AS popis, t.Aktivni AS aktivni,
      (SELECT COUNT(*) FROM dbo.A_KP_TymClen c JOIN dbo.A_KP_Osoba o ON o.OsobaID = c.OsobaID WHERE c.TymLidiID = t.TymLidiID AND o.Aktivni = 1) AS clenu,
      (SELECT COUNT(*) FROM dbo.A_KP_PacientTym pt JOIN dbo.A_KP_Pacient pa ON pa.PacientID = pt.PacientID WHERE pt.TymLidiID = t.TymLidiID AND pt.Aktivni = 1 AND pa.Stav = 'AKTIVNI') AS pacientu
    FROM dbo.A_KP_TymLidi t JOIN dbo.A_KP_Poskytovatel p ON p.PoskytovatelID = t.PoskytovatelID ORDER BY t.Aktivni DESC, p.Nazev, t.Nazev`),
  lide: await q.all(`SELECT o.OsobaID AS id, o.PoskytovatelID AS poskytovatelId, p.Nazev AS poskytovatel, p.Typ AS typPoskytovatele, o.Tym AS tym, o.Jmeno AS jmeno, o.Role AS role,
      o.Telefon AS telefon, o.Email AS email, o.Poznamka AS pozn, CASE WHEN o.Hash IS NULL THEN 0 ELSE 1 END AS maPin, CONVERT(char(16), o.PinVydan, 120) AS pinVydan,
      o.Zdroj AS zdroj, o.ExterniID AS externiId, o.Aktivni AS aktivni,
      (SELECT COUNT(*) FROM dbo.A_KP_PacientOsoba po JOIN dbo.A_KP_Pacient pa ON pa.PacientID = po.PacientID WHERE po.OsobaID = o.OsobaID AND po.Aktivni = 1 AND pa.Stav = 'AKTIVNI') AS pacientu
    FROM dbo.A_KP_Osoba o JOIN dbo.A_KP_Poskytovatel p ON p.PoskytovatelID = o.PoskytovatelID
    ORDER BY o.Aktivni DESC, p.Nazev, o.Tym, o.Jmeno`),
  role: ROLE_OSOBY, smsDostupne: smsDostupne(),
})));

central.post('/osoba', sUzivatelem(async (q, s, req) => {
  const b = req.body || {};
  const ps = await pracoviste(q, s, b.poskytovatelId);
  const o = ctiOsobu(b, ps.Typ);
  if (b.id) {
    const puv = await q.one(`SELECT OsobaID, PoskytovatelID, Aktivni FROM dbo.A_KP_Osoba WHERE OsobaID = @o`, { o: cislo(b.id) });
    if (!puv) throw chyba('Člověk nenalezen', 404);
    if (!smiSpravovatLidi(s, puv.PoskytovatelID)) throw chyba('Tohoto člověka spravuje jeho pracoviště', 403);
    const aktivni = b.aktivni !== false;
    await q.exec(`UPDATE dbo.A_KP_Osoba SET PoskytovatelID = @ps, Jmeno = @j, Role = @r, Telefon = @tel, Email = @e, Poznamka = @poz, Aktivni = @a WHERE OsobaID = @o`,
      { ps: ps.PoskytovatelID, j: o.jmeno, r: o.role, tel: o.telefon, e: o.email, poz: o.pozn, a: aktivni, o: puv.OsobaID });
    // jiné pracoviště nebo vyřazení → u pacientů už kartu neodemkne
    if (!aktivni || puv.PoskytovatelID !== ps.PoskytovatelID) await q.exec(`UPDATE dbo.A_KP_PacientOsoba SET Aktivni = 0, Do = SYSDATETIME() WHERE OsobaID = @o AND Aktivni = 1`, { o: puv.OsobaID });
    await synchronizujTymyOsoby(q, puv.OsobaID, s.uzivatelId);
    await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: 'úprava člověka pracoviště', detail: `${o.jmeno} (${ps.Nazev})${aktivni ? '' : ' – vyřazen'}`, ip: s.ip });
    return { id: puv.OsobaID };
  }
  const pin = await novyPinAsync();
  const r = await q.one(`INSERT INTO dbo.A_KP_Osoba (PoskytovatelID, Tym, Jmeno, Role, Telefon, Email, Poznamka, Salt, Hash, Iterace, PinVydan, Zdroj, VytvorilUzivatelID)
    OUTPUT inserted.OsobaID VALUES (@ps, @t, @j, @r, @tel, @e, @poz, @sa, @h, @i, SYSDATETIME(), 'RUCNE', @u)`,
    { ps: ps.PoskytovatelID, t: o.tym, j: o.jmeno, r: o.role, tel: o.telefon, e: o.email, poz: o.pozn, sa: pin.salt, h: pin.hash, i: pin.iterace, u: s.uzivatelId });
  if (o.tym) { const tid = await zajistiTymLidi(q, ps.PoskytovatelID, o.tym, s.uzivatelId); await pridejClena(q, tid, r.OsobaID, s.uzivatelId); }
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: 'nový člověk pracoviště', detail: `${o.jmeno} (${ps.Nazev})`, ip: s.ip });
  return { id: r.OsobaID, pin: pin.pin, sms: b.sms ? await pinSms(o.telefon, pin.pin) : null };
}));

central.post('/osoba/:id/pin', sUzivatelem(async (q, s, req) => {
  const o = await q.one(`SELECT OsobaID, PoskytovatelID, Jmeno, Telefon FROM dbo.A_KP_Osoba WHERE OsobaID = @o AND Aktivni = 1`, { o: cislo(req.params.id) });
  if (!o) throw chyba('Člověk nenalezen', 404);
  if (!smiSpravovatLidi(s, o.PoskytovatelID)) throw chyba('Tohoto člověka spravuje jeho pracoviště', 403);
  const pin = await novyPinAsync();
  await q.exec(`UPDATE dbo.A_KP_Osoba SET Salt = @sa, Hash = @h, Iterace = @i, PinVydan = SYSDATETIME() WHERE OsobaID = @o`, { sa: pin.salt, h: pin.hash, i: pin.iterace, o: o.OsobaID });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: 'nový osobní PIN', detail: o.Jmeno, ip: s.ip });
  return { pin: pin.pin, sms: req.body && req.body.sms ? await pinSms(o.Telefon, pin.pin) : null };
}));

/** hromadný import do jednoho pracoviště: CSV nebo tým z PéčeDoma; existující (stejné ExterniID, jinak stejné jméno) se jen aktualizují */
central.post('/lide/import', sUzivatelem(async (q, s, req) => {
  const b = req.body || {};
  const ps = await pracoviste(q, s, b.poskytovatelId);
  const zdroj = b.zdroj === 'PECEDOMA' ? 'PECEDOMA' : 'CSV';
  const radky = (Array.isArray(b.radky) ? b.radky : []).slice(0, 500);
  if (!radky.length) throw chyba('Žádní lidé k načtení');
  const stavajici = await q.all(`SELECT OsobaID, Jmeno, ExterniID FROM dbo.A_KP_Osoba WHERE PoskytovatelID = @ps`, { ps: ps.PoskytovatelID });
  const out = { pridano: 0, aktualizovano: 0, piny: [], chyby: [] };
  for (const rr of radky) {
    let o; try { o = ctiOsobu(rr, ps.Typ); } catch (e) { out.chyby.push(e.message); continue; }
    const ext = text(rr.externiId, 60) || null;
    const puv = stavajici.find((x) => (ext && x.ExterniID === ext) || x.Jmeno.toLowerCase() === o.jmeno.toLowerCase());
    const tymId = o.tym ? await zajistiTymLidi(q, ps.PoskytovatelID, o.tym, s.uzivatelId) : null;
    if (puv) {
      await q.exec(`UPDATE dbo.A_KP_Osoba SET Role = @r, Telefon = ISNULL(@tel, Telefon), Email = ISNULL(@e, Email), ExterniID = ISNULL(@x, ExterniID), Aktivni = 1 WHERE OsobaID = @o`,
        { r: o.role, tel: o.telefon, e: o.email, x: ext, o: puv.OsobaID });
      await pridejClena(q, tymId, puv.OsobaID, s.uzivatelId);
      out.aktualizovano++; continue;
    }
    const pin = await novyPinAsync();
    const novy = await q.one(`INSERT INTO dbo.A_KP_Osoba (PoskytovatelID, Jmeno, Role, Telefon, Email, Salt, Hash, Iterace, PinVydan, Zdroj, ExterniID, VytvorilUzivatelID)
      OUTPUT inserted.OsobaID VALUES (@ps, @j, @r, @tel, @e, @sa, @h, @i, SYSDATETIME(), @z, @x, @u)`,
      { ps: ps.PoskytovatelID, j: o.jmeno, r: o.role, tel: o.telefon, e: o.email, sa: pin.salt, h: pin.hash, i: pin.iterace, z: zdroj, x: ext, u: s.uzivatelId });
    await pridejClena(q, tymId, novy.OsobaID, s.uzivatelId);
    stavajici.push({ OsobaID: novy.OsobaID, Jmeno: o.jmeno, ExterniID: ext });
    out.pridano++;
    out.piny.push({ jmeno: o.jmeno, role: o.role, tym: o.tym, telefon: o.telefon, pin: pin.pin, sms: b.sms ? await pinSms(o.telefon, pin.pin) : null });
  }
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: `import lidí (${zdroj})`, detail: `${ps.Nazev}: +${out.pridano}, aktualizováno ${out.aktualizovano}`, ip: s.ip });
  return out;
}));

/** uživatelé portálu PéčeDoma: přes partnerské API (akce uzivatele – jediný zdroj s telefony), když propojení není nastavené, kopie tabulky ve stejné databázi */
async function uzivatelePortalu(q) {
  const nast = await nastaveniPd(q);
  if (nast.nastaveno) { try { return { rows: await uzivatelePd(nast), zdroj: 'api' }; } catch (e) { throw chyba('Uživatele z PéčeDoma se nepodařilo načíst: ' + e.message, 502); } }
  try {
    return { rows: await q.all(`SELECT UzivatelID AS id, Jmeno AS jmeno, ISNULL(Role, N'') AS role, ISNULL(Telefon, N'') AS telefon, ISNULL(Login, N'') AS login FROM dbo.A_MSPPP_UzivatelSestra WHERE Aktivni = 1 ORDER BY Jmeno`), zdroj: 'db' };
  } catch (e) { throw chyba('Tým z PéčeDoma se nepodařilo načíst (' + String(e.message).slice(0, 120) + ') – použijte soubor CSV', 502); }
}
/** tým z PéčeDoma – uživatelé portálu i s telefony */
central.get('/lide/pecedoma', sUzivatelem(async (q) => {
  const { rows } = await uzivatelePortalu(q);
  const nactene = new Set((await q.all(`SELECT ExterniID FROM dbo.A_KP_Osoba WHERE ExterniID LIKE 'pd:%'`)).map((x) => x.ExterniID));
  return { lide: rows.map((r) => ({ ...r, externiId: 'pd:' + r.id, nacteno: nactene.has('pd:' + r.id) })) };
}));

/** aktualizace lidí z PéčeDoma (0.11.3): jméno, role a telefon podle uživatele portálu (párování přes ExterniID pd:<UzivatelID>, jinak stejné jméno);
 *  PéčeDoma e-mail nevede – ten se vyplní u člověka ručně. { poskytovatelId } = celé pracoviště, { osobaId } = jeden člověk. PIN zůstává. */
central.post('/lide/pecedoma/aktualizovat', sUzivatelem(async (q, s, req) => {
  const b = req.body || {};
  let lide;
  if (cislo(b.osobaId)) {
    lide = await q.all(`SELECT OsobaID, PoskytovatelID, Jmeno, Telefon, ExterniID FROM dbo.A_KP_Osoba WHERE OsobaID = @o AND Aktivni = 1`, { o: cislo(b.osobaId) });
    if (!lide.length) throw chyba('Člověk nenalezen', 404);
    if (!smiSpravovatLidi(s, lide[0].PoskytovatelID)) throw chyba('Tohoto člověka spravuje jeho pracoviště', 403);
  } else {
    const ps = await pracoviste(q, s, b.poskytovatelId);
    lide = await q.all(`SELECT OsobaID, PoskytovatelID, Jmeno, Telefon, ExterniID FROM dbo.A_KP_Osoba WHERE PoskytovatelID = @ps AND Aktivni = 1`, { ps: ps.PoskytovatelID });
  }
  const { rows: pd, zdroj } = await uzivatelePortalu(q);
  const norm = (x) => String(x || '').trim().toLowerCase();
  const zmeny = [], bezTelefonu = [], neparovani = [];
  for (const o of lide) {
    const u = pd.find((x) => 'pd:' + x.id === o.ExterniID) || pd.find((x) => norm(x.jmeno) === norm(o.Jmeno));
    if (!u) { neparovani.push(o.Jmeno); continue; }
    const tel = text(u.telefon, 30) || null;
    const co = [];
    if (!o.ExterniID) co.push('propojeno s PéčeDoma');
    if (tel && normTel(tel) !== normTel(o.Telefon)) co.push(`telefon ${hezkyTel(o.Telefon) || '—'} → ${hezkyTel(tel)}`);
    if (!tel) bezTelefonu.push(o.Jmeno);
    if (!co.length) continue;
    await q.exec(`UPDATE dbo.A_KP_Osoba SET Telefon = ISNULL(@tel, Telefon), ExterniID = ISNULL(ExterniID, @x), Zdroj = CASE WHEN Zdroj = 'RUCNE' THEN 'PECEDOMA' ELSE Zdroj END WHERE OsobaID = @o`, { tel, x: 'pd:' + u.id, o: o.OsobaID });
    zmeny.push({ jmeno: o.Jmeno, co: co.join(', ') });
  }
  if (zmeny.length) await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: 'aktualizace lidí z PéčeDoma', detail: zmeny.map((z) => `${z.jmeno}: ${z.co}`).join('; ').slice(0, 400), ip: s.ip });
  return { zmeny, bezTelefonu, neparovani, celkem: lide.length, zdroj };
}));

/** týmy lidí u pacienta (0.10.0): { pridatTymId } | { odebratTymId } | { tymId, osobaId, aktivni } – lidé se přidávají jen po týmech z agendy Lidé a týmy,
 *  u pacienta jde člena jen deaktivovat (a zase aktivovat). Garant / lékař v týmu pro všechna pracoviště, ostatní členové týmu pro své pracoviště. */
central.post('/pacient/:id/tym-lidi', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.aktivni) throw chyba('Průkaz je uzavřený');
  const b = req.body || {};
  const smiPs = (psId) => op.garant || op.lekar || (op.zapis && psId === s.poskytovatelId);
  const tymId = cislo(b.pridatTymId || b.odebratTymId || b.tymId);
  const t = await q.one(`SELECT t.TymLidiID, t.PoskytovatelID, t.Nazev, t.Aktivni, ps.Nazev AS Pracoviste FROM dbo.A_KP_TymLidi t JOIN dbo.A_KP_Poskytovatel ps ON ps.PoskytovatelID = t.PoskytovatelID WHERE t.TymLidiID = @t`, { t: tymId });
  if (!t) throw chyba('Tým nenalezen', 404);
  if (!smiPs(t.PoskytovatelID)) throw chyba('Týmy u pacienta vybírá garant nebo lékař v týmu; ostatní jen týmy svého pracoviště', 403);
  if (b.pridatTymId) {
    if (!t.Aktivni) throw chyba('Tým je zrušený');
    const mimo = await q.all(`SELECT DISTINCT p2.PoskytovatelID AS id, p2.Nazev AS nazev FROM dbo.A_KP_TymClen c JOIN dbo.A_KP_Osoba o ON o.OsobaID = c.OsobaID JOIN dbo.A_KP_Poskytovatel p2 ON p2.PoskytovatelID = o.PoskytovatelID
      WHERE c.TymLidiID = @t AND o.Aktivni = 1 AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_Tym x WHERE x.PacientID = @p AND x.PoskytovatelID = p2.PoskytovatelID AND x.Aktivni = 1)`, { t: t.TymLidiID, p: id });
    if (mimo.length && !op.garant) throw chyba(`Pracoviště členů týmu (${mimo.map((x) => x.nazev).join(', ')}) nejsou v týmu kolem pacienta – tým přidá garant`);
    const vTymu = !mimo.length;
    const puv = await q.one(`SELECT PacientTymID, Aktivni FROM dbo.A_KP_PacientTym WHERE PacientID = @p AND TymLidiID = @t ORDER BY Aktivni DESC, PacientTymID DESC`, { p: id, t: t.TymLidiID });
    if (puv && puv.Aktivni) throw chyba('Tým už u pacienta je');
    if (puv) await q.exec(`UPDATE dbo.A_KP_PacientTym SET Aktivni = 1, Do = NULL, Od = SYSDATETIME(), PridalUzivatelID = @u WHERE PacientTymID = @i`, { i: puv.PacientTymID, u: s.uzivatelId });
    else await q.exec(`INSERT INTO dbo.A_KP_PacientTym (PacientID, TymLidiID, PridalUzivatelID) VALUES (@p, @t, @u)`, { p: id, t: t.TymLidiID, u: s.uzivatelId });
    // dřív deaktivovaní členové se po novém přidání týmu vrátí – tým se přidává celý
    await q.exec(`UPDATE po SET Aktivni = 1, Do = NULL FROM dbo.A_KP_PacientOsoba po WHERE po.PacientID = @p AND po.TymLidiID = @t AND po.Aktivni = 0
      AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_PacientOsoba x WHERE x.PacientID = po.PacientID AND x.OsobaID = po.OsobaID AND x.Aktivni = 1)
      AND po.PacientOsobaID = (SELECT MAX(y.PacientOsobaID) FROM dbo.A_KP_PacientOsoba y WHERE y.PacientID = po.PacientID AND y.OsobaID = po.OsobaID AND y.TymLidiID = @t)`, { p: id, t: t.TymLidiID });
    await synchronizujTymUPacientu(q, t.TymLidiID, s.uzivatelId);
    await zapisDenik(q, { pacientId: id, typ: 'Úprava údajů', text: `K pacientovi přiřazen tým ${t.Nazev} (${t.Pracoviste}).`, autor: s.jmeno, role: s.role.includes('lekar') ? 'lekar' : 'sestra', uzivatelId: s.uzivatelId });
    await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'přístup ke kartě (tým)', detail: `+ ${t.Nazev} (${t.Pracoviste})${vTymu ? '' : ' · do týmu kolem pacienta přidáno (péče): ' + mimo.map((x) => x.nazev).join(', ')}`, ip: s.ip });
    return { pracovistePridano: !vTymu };
  }
  if (b.odebratTymId) {
    const n = await q.exec(`UPDATE dbo.A_KP_PacientTym SET Aktivni = 0, Do = SYSDATETIME() WHERE PacientID = @p AND TymLidiID = @t AND Aktivni = 1`, { p: id, t: t.TymLidiID });
    if (!n) throw chyba('Tým u pacienta není', 404);
    await synchronizujTymUPacientu(q, t.TymLidiID, s.uzivatelId);
    await zapisDenik(q, { pacientId: id, typ: 'Úprava údajů', text: `Tým ${t.Nazev} (${t.Pracoviste}) odebrán; jeho členové už kartu neodemknou.`, autor: s.jmeno, role: s.role.includes('lekar') ? 'lekar' : 'sestra', uzivatelId: s.uzivatelId });
    await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'přístup ke kartě (tým)', detail: `− ${t.Nazev} (${t.Pracoviste})`, ip: s.ip });
    return {};
  }
  const oid = cislo(b.osobaId); if (!oid) throw chyba('Chybí člen týmu');
  const o = await q.one(`SELECT o.OsobaID, o.Jmeno FROM dbo.A_KP_TymClen c JOIN dbo.A_KP_Osoba o ON o.OsobaID = c.OsobaID WHERE c.TymLidiID = @t AND o.OsobaID = @o AND o.Aktivni = 1`, { t: t.TymLidiID, o: oid });
  if (!o) throw chyba('Člověk není členem tohoto týmu', 404);
  const maTym = await q.one(`SELECT 1 AS x FROM dbo.A_KP_PacientTym WHERE PacientID = @p AND TymLidiID = @t AND Aktivni = 1`, { p: id, t: t.TymLidiID });
  if (!maTym) throw chyba('Tým u pacienta není', 404);
  const aktivni = b.aktivni !== false;
  // deaktivace platí pro člověka u pacienta (ať je v kolika týmech), aktivace vrátí poslední záznam nebo založí nový z tohoto týmu
  const radek = await q.one(`SELECT TOP 1 PacientOsobaID, Aktivni FROM dbo.A_KP_PacientOsoba WHERE PacientID = @p AND OsobaID = @o ORDER BY Aktivni DESC, PacientOsobaID DESC`, { p: id, o: oid });
  if (!aktivni) { if (radek && radek.Aktivni) await q.exec(`UPDATE dbo.A_KP_PacientOsoba SET Aktivni = 0, Do = SYSDATETIME() WHERE PacientID = @p AND OsobaID = @o AND Aktivni = 1`, { p: id, o: oid }); }
  else if (radek && !radek.Aktivni) await q.exec(`UPDATE dbo.A_KP_PacientOsoba SET Aktivni = 1, Do = NULL, TymLidiID = ISNULL(TymLidiID, @t) WHERE PacientOsobaID = @i`, { i: radek.PacientOsobaID, t: t.TymLidiID });
  else if (!radek) await q.exec(`INSERT INTO dbo.A_KP_PacientOsoba (PacientID, OsobaID, TymLidiID, PridalUzivatelID) VALUES (@p, @o, @t, @u)`, { p: id, o: oid, t: t.TymLidiID, u: s.uzivatelId });
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'přístup ke kartě (člen týmu)', detail: `${aktivni ? '+' : '−'}${o.Jmeno} (${t.Nazev})`, ip: s.ip });
  return {};
}));

/** jednotlivé odebrání přístupu (záznamy z doby před týmy, 0.10.0 už lidi jednotlivě nepřidává – jen po týmech) */
central.post('/pacient/:id/lide', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.aktivni) throw chyba('Průkaz je uzavřený');
  if (Array.isArray(req.body.pridat) && req.body.pridat.length) throw chyba('Lidé se k pacientovi přiřazují po týmech – záložka Tým a garance → Týmy u pacienta; lidi a týmy spravuje agenda Lidé a týmy');
  const tymPs = new Set((await q.all(`SELECT PoskytovatelID FROM dbo.A_KP_Tym WHERE PacientID = @p AND Aktivni = 1`, { p: id })).map((x) => x.PoskytovatelID));
  const ids = (v) => (Array.isArray(v) ? v : []).map(cislo).filter(Boolean).slice(0, 300);
  const smi = (o) => op.garant || op.lekar || (op.zapis && o.PoskytovatelID === s.poskytovatelId);
  const zmeny = [];
  for (const oid of ids(req.body.pridat)) {
    const o = await q.one(`SELECT OsobaID, PoskytovatelID, Jmeno FROM dbo.A_KP_Osoba WHERE OsobaID = @o AND Aktivni = 1`, { o: oid });
    if (!o) continue;
    if (!tymPs.has(o.PoskytovatelID)) throw chyba(`${o.Jmeno}: jeho pracoviště není v týmu kolem pacienta – nejdřív ho přidejte v Týmu a garanci`);
    if (!smi(o)) throw chyba('Přiřadit smí garant nebo lékař v týmu; ostatní jen lidi svého pracoviště', 403);
    const je = await q.one(`SELECT 1 AS x FROM dbo.A_KP_PacientOsoba WHERE PacientID = @p AND OsobaID = @o AND Aktivni = 1`, { p: id, o: oid });
    if (je) continue;
    await q.exec(`INSERT INTO dbo.A_KP_PacientOsoba (PacientID, OsobaID, PridalUzivatelID) VALUES (@p, @o, @u)`, { p: id, o: oid, u: s.uzivatelId });
    zmeny.push('+' + o.Jmeno);
  }
  for (const oid of ids(req.body.odebrat)) {
    const o = await q.one(`SELECT OsobaID, PoskytovatelID, Jmeno FROM dbo.A_KP_Osoba WHERE OsobaID = @o`, { o: oid });
    if (!o) continue;
    if (!smi(o)) throw chyba('Odebrat smí garant nebo lékař v týmu; ostatní jen lidi svého pracoviště', 403);
    const r = await q.exec(`UPDATE dbo.A_KP_PacientOsoba SET Aktivni = 0, Do = SYSDATETIME() WHERE PacientID = @p AND OsobaID = @o AND Aktivni = 1`, { p: id, o: oid });
    if (r) zmeny.push('−' + o.Jmeno);
  }
  if (zmeny.length) await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'přístup ke kartě (lidé)', detail: zmeny.join(', ').slice(0, 400), ip: s.ip });
  return { zmeny: zmeny.length };
}));

/* ---------------- správa organizace (role admin) ---------------- */
central.post('/poskytovatel', sUzivatelem(async (q, s, req) => {
  const b = req.body || {};
  const typ = String(b.typ || '').toUpperCase();
  if (!TYPY_POSKYTOVATELE[typ]) throw chyba('Vyberte typ pracoviště');
  if (!text(b.nazev)) throw chyba('Vyplňte název');
  const par = { n: text(b.nazev, 200), ico: text(b.ico, 8) || null, icp: text(b.icp, 20) || null, t: typ, tel: text(b.telefon24, 40) || null, a: text(b.adresa, 300) || null, ak: b.aktivni !== false };
  if (cislo(b.id)) await q.exec(`UPDATE dbo.A_KP_Poskytovatel SET Nazev = @n, ICO = @ico, ICP = @icp, Typ = @t, Telefon24 = @tel, Adresa = @a, Aktivni = @ak WHERE PoskytovatelID = @id`, { ...par, id: cislo(b.id) });
  else await q.exec(`INSERT INTO dbo.A_KP_Poskytovatel (Nazev, ICO, ICP, Typ, Telefon24, Adresa, Aktivni) VALUES (@n, @ico, @icp, @t, @tel, @a, @ak)`, par);
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: cislo(b.id) ? 'úprava pracoviště' : 'nové pracoviště', detail: par.n, ip: s.ip });
}, { admin: true }));

central.get('/uzivatele', sUzivatelem(async (q) => {
  const rows = await q.all(`SELECT u.UzivatelID AS id, u.Jmeno AS jmeno, u.Login AS login, u.Email AS email, u.Telefon AS telefon, u.Role AS role, u.CisloCLK AS clk,
      u.Aktivni AS aktivni, u.MusiZmenitHeslo AS musiZmenit, u.HesloPrvni AS hp, CONVERT(char(16), u.PosledniPrihlaseni, 120) AS posledni, u.PoskytovatelID AS poskytovatelId, p.Nazev AS poskytovatel
    FROM dbo.A_KP_Uzivatel u JOIN dbo.A_KP_Poskytovatel p ON p.PoskytovatelID = u.PoskytovatelID ORDER BY u.Aktivni DESC, p.Nazev, u.Jmeno`);
  return { uzivatele: rows.map(({ hp, ...u }) => ({ ...u, role: roleSeznam(u.role), prvniHeslo: u.musiZmenit ? desifruj(hp) : '' })) };
}, { admin: true }));

central.post('/uzivatel', sUzivatelem(async (q, s, req) => {
  const b = req.body || {};
  const role = roleSeznam(Array.isArray(b.role) ? b.role.join(',') : b.role);
  if (!role.length) throw chyba('Vyberte aspoň jednu roli');
  const login = text(b.login, 100).toLowerCase();
  if (!/^[a-z0-9._@-]{3,100}$/.test(login)) throw chyba('Login: malá písmena, číslice, tečka, @ (min. 3 znaky)');
  if (!text(b.jmeno)) throw chyba('Vyplňte jméno');
  const ps = cislo(b.poskytovatelId);
  if (!(await q.one(`SELECT 1 AS x FROM dbo.A_KP_Poskytovatel WHERE PoskytovatelID = @p`, { p: ps }))) throw chyba('Vyberte pracoviště');
  const id = cislo(b.id);
  if (id === s.uzivatelId && !role.includes('admin')) throw chyba('Sám sobě roli správce odebrat nemůžete');
  const par = { j: text(b.jmeno, 150), l: login, e: text(b.email, 200) || null, t: text(b.telefon, 40) || null, r: role.join(','), c: text(b.clk, 20) || null, ak: b.aktivni !== false, ps };
  let heslo = '';
  const dup = await q.one(`SELECT UzivatelID FROM dbo.A_KP_Uzivatel WHERE Login = @l`, { l: login });
  if (dup && dup.UzivatelID !== id) throw chyba('Tento login už používá jiný uživatel', 409);
  if (id) {
    await q.exec(`UPDATE dbo.A_KP_Uzivatel SET Jmeno = @j, Login = @l, Email = @e, Telefon = @t, Role = @r, CisloCLK = @c, Aktivni = @ak, PoskytovatelID = @ps WHERE UzivatelID = @id`, { ...par, id });
    if (b.noveHeslo) {
      heslo = generujHeslo();
      await q.exec(`UPDATE dbo.A_KP_Uzivatel SET HesloHash = @h, HesloPrvni = @hp, MusiZmenitHeslo = 1 WHERE UzivatelID = @id`, { h: hashHeslo(heslo), hp: zasifruj(heslo), id });
    }
  } else {
    heslo = generujHeslo();
    await q.exec(`INSERT INTO dbo.A_KP_Uzivatel (PoskytovatelID, Jmeno, Login, Email, Telefon, Role, CisloCLK, Aktivni, HesloHash, HesloPrvni, MusiZmenitHeslo)
      VALUES (@ps, @j, @l, @e, @t, @r, @c, @ak, @h, @hp, 1)`, { ...par, h: hashHeslo(heslo), hp: zasifruj(heslo) });
  }
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, akce: id ? 'úprava uživatele' : 'nový uživatel', detail: login, ip: s.ip });
  return { heslo };
}, { admin: true }));

central.get('/zarizeni', sUzivatelem(async (q) => ({
  zarizeni: await q.all(`SELECT z.ZarizeniID AS id, z.Stitek AS stitek, z.Stav AS stav, p.KodPrukazu AS kod, p.PacientID AS pacientId, CONVERT(char(16), z.Sparovano, 120) AS sparovano,
      CONVERT(char(16), z.PosledniSync, 120) AS sync, z.Baterie AS baterie, z.VerzeAplikace AS verze, z.DelkaFronty AS fronta, z.VerzePlanuVZarizeni AS verzePlanu, z.Rezim AS rezim
    FROM dbo.A_KP_Zarizeni z LEFT JOIN dbo.A_KP_Pacient p ON p.PacientID = z.PacientID ORDER BY CASE z.Stav WHEN 'SPAROVANO' THEN 0 ELSE 1 END, z.PosledniSync DESC`),
}), { admin: true }));

central.get('/audit', sUzivatelem(async (q) => ({
  audit: await q.all(`SELECT TOP 300 CONVERT(char(19), a.Cas, 120) AS cas, a.Kdo AS kdo, p.KodPrukazu AS pacient, a.Akce AS akce, a.Detail AS detail, a.IP AS ip
    FROM dbo.A_KP_AuditLog a LEFT JOIN dbo.A_KP_Pacient p ON p.PacientID = a.PacientID ORDER BY a.AuditID DESC`),
  ai: await q.all(`SELECT TOP 100 CONVERT(char(16), Cas, 120) AS cas, Ucel AS ucel, DelkaTextu AS delka, PocetNahrad AS nahrad, Blokovano AS blok, Model AS model, Vysledek AS vysledek FROM dbo.A_KP_AIDotaz ORDER BY AIDotazID DESC`),
}), { admin: true }));

central.post('/nastaveni', sUzivatelem(async (q, s, req) => {
  const b = req.body || {};
  const zmeny = [];
  if (b.nazevSite != null) zmeny.push(['NAZEV_SITE', text(b.nazevSite, 200)]);
  if (b.intervalRevize != null) zmeny.push(['INTERVAL_REVIZE', String(Math.min(12, Math.max(1, Number(b.intervalRevize) || 3)))]);
  // propojení s PéčeDoma: odkaz na portál organizace, server jhn-apps, token aplikace (prázdný = nechat), automatická synchronizace
  if (b.pdOdkaz != null) { const v = text(b.pdOdkaz, 500); if (v && !/^https?:\/\//i.test(v)) throw chyba('Odkaz na PéčeDoma musí začínat https://'); zmeny.push(['PD_ODKAZ', v]); }
  if (b.pdApi != null) { const v = text(b.pdApi, 300).replace(/\/+$/, ''); if (v && !/^https?:\/\//i.test(v)) throw chyba('Adresa serveru PéčeDoma musí začínat https://'); zmeny.push(['PD_API', v]); }
  if (b.pdToken != null && text(b.pdToken, 200)) zmeny.push(['PD_TOKEN', text(b.pdToken, 200)]);
  if (b.pdTokenSmazat) zmeny.push(['PD_TOKEN', '']);
  if (b.pdSync != null) zmeny.push(['PD_SYNC', b.pdSync === true || b.pdSync === '1' || b.pdSync === 1 ? '1' : '0']);
  for (const [k, v] of zmeny) {
    await q.exec(`MERGE dbo.A_KP_Nastaveni AS t USING (VALUES (@k, @v)) AS s(Klic, Hodnota) ON t.Klic = s.Klic
      WHEN MATCHED THEN UPDATE SET Hodnota = s.Hodnota, Zmeneno = SYSDATETIME() WHEN NOT MATCHED THEN INSERT (Klic, Hodnota) VALUES (s.Klic, s.Hodnota);`, { k, v });
  }
}, { admin: true }));
