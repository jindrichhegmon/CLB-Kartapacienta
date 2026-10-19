/**
 * Centrální aplikace (garant a tým kolem pacienta) – /api/c/*
 * Session: { typ:'kp', tenant, uzivatelId } – role a pracoviště se při každém požadavku čtou znovu z DB.
 * Všechny dotazy jsou pevně na serveru a běží v kontextu tenanta (RLS); prohlížeč žádné SQL neposílá.
 */
import { Router } from 'express';
import { config } from '../config.js';
import { vTenantu } from '../db.js';
import { h, chyba, omez, omezReset, ip, bearer, text, cislo } from '../http.js';
import { podepis, overSession, hashHeslo, overHeslo, generujHeslo, zasifruj, desifruj, parovaciKod, novyPin, totp, TOTP_KROK } from '../crypto.js';
import { audit, zapisDenik, dalsiKod, planAktualni, garant, opravneni, ulozPlan, normalizujPlan, roleSeznam, TYPY_POSKYTOVATELE, TYPY_DENIKU, LIMITY, CILE } from '../kp.js';
import { rozborZpravy } from '../ai.js';
import { normTel, hezkyTel, smsDostupne, posliSms } from '../telefon.js';

export const central = Router();

const TTL = 12 * 3600;
const tenantRe = /^[A-Z0-9]{16}$/;

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
  return { ja: s, nazevSite: nast.NAZEV_SITE || '', nastaveni: { intervalRevize: Number(nast.INTERVAL_REVIZE || 3) }, ciselniky: { limity: LIMITY, cile: CILE, typyPoskytovatele: TYPY_POSKYTOVATELE, typyDeniku: TYPY_DENIKU }, verejnaAdresa: config.verejnaAdresa, verze: config.verze, ai: !!config.ai.apiKey };
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
      (SELECT TOP 1 CONVERT(char(16), z.PosledniSync, 120) FROM dbo.A_KP_Zarizeni z WHERE z.PacientID = p.PacientID AND z.Stav = 'SPAROVANO' ORDER BY z.PosledniSync DESC) AS sync,
      (SELECT TOP 1 z.Baterie FROM dbo.A_KP_Zarizeni z WHERE z.PacientID = p.PacientID AND z.Stav = 'SPAROVANO' ORDER BY z.PosledniSync DESC) AS baterie,
      (SELECT COUNT(*) FROM dbo.A_KP_Zarizeni z WHERE z.PacientID = p.PacientID AND z.Stav = 'SPAROVANO') AS telefonu,
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
  const pac = await q.one(`INSERT INTO dbo.A_KP_Pacient (KodPrukazu, Jmeno, Prijmeni, RodneCislo, DatumNarozeni, RokNarozeni, Pohlavi, Pojistovna, Adresa, Pobyt, TelefonKarty, ZalozilUzivatelID)
    OUTPUT inserted.PacientID VALUES (@k, @j, @p, @rc, @dn, @r, @po, @poj, @a, @pb, @tk, @u)`,
  { k: kod, j: jmeno, p: prijmeni.toUpperCase(), rc, dn: datum, r: rok, po: text(pa.pohlavi, 10) || null, poj: text(pa.pojistovna, 3) || null, a: text(pa.adresa, 300) || null, pb: text(pa.pobyt, 200) || null, tk: telKarty, u: s.uzivatelId });
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
  return { id, kod };
}, { lekar: true }));

/* ---------------- detail pacienta ---------------- */
central.get('/pacient/:id', sUzivatelem(async (q, s, req) => {
  const id = pid(req);
  const op = await opravneni(q, s, id);
  const pacient = await q.one(`SELECT PacientID AS id, KodPrukazu AS kod, Jmeno AS jmeno, Prijmeni AS prijmeni, RodneCislo AS rc, CONVERT(char(10), DatumNarozeni, 23) AS datumNarozeni,
      RokNarozeni AS rok, Pohlavi AS pohlavi, Pojistovna AS pojistovna, Adresa AS adresa, Pobyt AS pobyt, TelefonKarty AS telefonKarty, Stav AS stav, Souhlas AS souhlas,
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
      Baterie AS baterie, VerzeAplikace AS verzeAplikace, DelkaFronty AS fronta, VerzePlanuVZarizeni AS verzePlanu, ParovaciKod AS kod, CONVERT(char(16), ParovaciPlatnost, 120) AS kodPlatnost, Telefon AS telefon
    FROM dbo.A_KP_Zarizeni WHERE PacientID = @p ORDER BY ZarizeniID DESC`, { p: id });
  const piny = await q.all(`SELECT PinID AS id, Jmeno AS jmeno, Role AS role, CONVERT(char(10), Vytvoreno, 23) AS vytvoreno FROM dbo.A_KP_Pin WHERE PacientID = @p AND Aktivni = 1 ORDER BY PinID`, { p: id });
  const denik = await q.all(`SELECT TOP 300 LOWER(CONVERT(varchar(36), UUID)) AS uuid, Typ AS typ, Text AS text, Autor AS autor, Role AS role, CONVERT(char(16), CasZapisu, 120) AS cas,
      CONVERT(char(16), CasPrijeti, 120) AS prijato, Overeno AS overeno, ZarizeniID AS zarizeni FROM dbo.A_KP_Denik WHERE PacientID = @p ORDER BY CasZapisu DESC, DenikID DESC`, { p: id });
  const dokumenty = await q.all(`SELECT DokumentID AS id, Typ AS typ, Nazev AS nazev, KdeOriginal AS kdeOriginal, MimeType AS mime, Velikost AS velikost, CONVERT(char(16), Vytvoreno, 120) AS vytvoreno
    FROM dbo.A_KP_Dokument WHERE PacientID = @p ORDER BY DokumentID DESC`, { p: id });
  const pristupy = op.garant || s.role.includes('admin') ? await q.all(`SELECT TOP 80 CONVERT(char(16), Cas, 120) AS cas, Kdo AS kdo, Akce AS akce, Detail AS detail FROM dbo.A_KP_AuditLog WHERE PacientID = @p ORDER BY AuditID DESC`, { p: id }) : [];
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, akce: 'zobrazení průkazu', ip: s.ip });
  return { pacient, plan, verze, kontakty, tym, garance, zarizeni, piny, denik, dokumenty, pristupy, op, smsDostupne: smsDostupne() };
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
  await q.exec(`UPDATE dbo.A_KP_Pacient SET Jmeno = @j, Prijmeni = @p, RodneCislo = @rc, DatumNarozeni = @dn, RokNarozeni = @r, Pohlavi = @po, Pojistovna = @poj, Adresa = @a, Pobyt = @pb, TelefonKarty = @tk WHERE PacientID = @id`,
    { id, j: text(pa.jmeno, 80), p: text(pa.prijmeni, 80).toUpperCase(), rc: text(pa.rc, 11) || null, dn: datum, r: cislo(pa.rok) || (datum ? Number(datum.slice(0, 4)) : null), po: text(pa.pohlavi, 10) || null, poj: text(pa.pojistovna, 3) || null, a: text(pa.adresa, 300) || null, pb: text(pa.pobyt, 200) || null, tk: telKarty });
  await zapisDenik(q, { pacientId: id, typ: 'Úprava údajů', text: 'Upraveny identifikační údaje nebo místo pobytu.', autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
  if (dosud && dosud.TelefonKarty !== telKarty) {
    // karta smí být jen na novém čísle: telefon spárovaný s jiným číslem se zablokuje (při připojení se vymaže), čekající kódy propadnou
    const n = await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = 'ZABLOKOVANO', ParovaciKod = NULL WHERE PacientID = @id AND Stav IN ('SPAROVANO', 'CEKA') AND ISNULL(Telefon, N'') <> @tk`, { id, tk: telKarty });
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
  if (kid) {
    const k = await q.one(`SELECT Skupina FROM dbo.A_KP_Kontakt WHERE KontaktID = @k AND PacientID = @p`, { k: kid, p: id });
    if (!k) throw chyba('Kontakt nenalezen', 404);
    if ((k.Skupina === 'ROZHODUJE' || sk === 'ROZHODUJE') && !op.lekar) throw chyba('Kontakt „rozhoduje“ mění jen lékař (na základě dokladu)', 403);
    if (b.smazat) await q.exec(`UPDATE dbo.A_KP_Kontakt SET Aktivni = 0, Zmeneno = SYSDATETIME() WHERE KontaktID = @k`, { k: kid });
    else await q.exec(`UPDATE dbo.A_KP_Kontakt SET Jmeno = @j, Telefon = @t, Skupina = @s, Poznamka = @poz, Poradi = ISNULL(@o, Poradi), Zmeneno = SYSDATETIME() WHERE KontaktID = @k`,
      { k: kid, j: text(b.jmeno, 150), t: text(b.tel, 40), s: sk, poz: text(b.pozn, 200) || null, o: cislo(b.poradi) });
  } else {
    if (sk === 'ROZHODUJE' && !op.lekar) throw chyba('Kontakt „rozhoduje“ přidává jen lékař (na základě dokladu)', 403);
    if (!text(b.jmeno) || !text(b.tel)) throw chyba('Vyplňte jméno i telefon');
    await q.exec(`INSERT INTO dbo.A_KP_Kontakt (PacientID, Jmeno, Telefon, Skupina, Poznamka, Poradi) VALUES (@p, @j, @t, @s, @poz, ISNULL(@o, 100))`,
      { p: id, j: text(b.jmeno, 150), t: text(b.tel, 40), s: sk, poz: text(b.pozn, 200) || null, o: cislo(b.poradi) });
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
    await zapisDenik(q, { pacientId: id, typ: 'Úprava údajů', text: 'Pracoviště odebráno z týmu kolem pacienta; jeho PINy zneplatněny.', autor: s.jmeno, role: 'lekar', uzivatelId: s.uzivatelId });
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
  const z = await q.one(`SELECT TOP 1 ZarizeniID FROM dbo.A_KP_Zarizeni WHERE PacientID = @p AND Stav = 'CEKA' ORDER BY ZarizeniID DESC`, { p: id });
  let zid;
  if (z) { zid = z.ZarizeniID; await q.exec(`UPDATE dbo.A_KP_Zarizeni SET ParovaciKod = @k, ParovaciPlatnost = @pl, Stitek = ISNULL(@st, Stitek) WHERE ZarizeniID = @z`, { k: kod, pl: platnost, st: text(req.body.stitek, 60) || null, z: zid }); }
  else zid = (await q.one(`INSERT INTO dbo.A_KP_Zarizeni (PacientID, Stitek, ParovaciKod, ParovaciPlatnost) OUTPUT inserted.ZarizeniID VALUES (@p, @st, @k, @pl)`, { p: id, st: text(req.body.stitek, 60) || null, k: kod, pl: platnost })).ZarizeniID;
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, zarizeniId: zid, akce: 'párovací kód vydán', ip: s.ip });
  const odkaz = `${config.verejnaAdresa}/karta/#p=${s.tenant}.${kod}`;
  let sms = null;
  if (req.body.sms) {   // odkaz SMS na číslo s kartou – dostane ho jen tento telefon
    try { await posliSms(telKarty, `Karta pacienta: otevřete odkaz v tomto telefonu a potvrďte jeho číslo. ${odkaz} (platí 15 minut)`); sms = { ok: true };
      await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, zarizeniId: zid, akce: 'párovací odkaz poslán SMS', detail: hezkyTel(telKarty), ip: s.ip });
    } catch (e) { sms = { ok: false, chyba: e.message }; }
  }
  return { zarizeniId: zid, kod, tenant: s.tenant, platnost: platnost.toISOString(), odkaz, telefonKarty: hezkyTel(telKarty), smsDostupne: smsDostupne(), sms };
}));

central.post('/pacient/:id/zarizeni', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.garant && !s.role.includes('admin')) throw chyba('Telefony spravuje garant', 403);
  const zid = cislo(req.body.zarizeniId);
  const akce = req.body.akce;
  const stav = { zablokovat: 'ZABLOKOVANO', vratit: 'VRACENO' }[akce];
  if (!stav) throw chyba('Neznámá akce');
  const n = await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = @s, TokenHash = CASE WHEN @s = 'VRACENO' THEN NULL ELSE TokenHash END, ParovaciKod = NULL WHERE ZarizeniID = @z AND PacientID = @p`, { s: stav, z: zid, p: id });
  if (!n) throw chyba('Telefon nenalezen', 404);
  await zapisDenik(q, { pacientId: id, typ: 'Systém', text: akce === 'zablokovat' ? 'Telefon zablokován – při příštím připojení se data v něm smažou.' : 'Telefon vrácen provozovateli.', autor: s.jmeno, role: 'system', uzivatelId: s.uzivatelId });
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
  const z = await q.one(`SELECT TOP 1 ZarizeniID, Tajemstvi FROM dbo.A_KP_Zarizeni WHERE PacientID = @p AND Stav = 'SPAROVANO' ORDER BY Sparovano DESC`, { p: id });
  if (!z) throw chyba('Pacient nemá spárovaný telefon');
  const t = desifruj(z.Tajemstvi);
  if (!t) throw chyba('Tajemství telefonu nelze přečíst – spárujte telefon znovu', 500);
  const ted = Date.now();
  const platiDo = new Date((Math.floor(ted / 1000 / TOTP_KROK) + 1) * TOTP_KROK * 1000);
  await audit(q, { uzivatelId: s.uzivatelId, kdo: s.jmeno, pacientId: id, zarizeniId: z.ZarizeniID, akce: 'kód lékaře vydán', ip: s.ip });
  return { kod: totp(t, ted), platiDo: platiDo.toISOString(), lekar: s.jmeno };
}));

/* ---------------- dokumenty ---------------- */
central.post('/pacient/:id/dokument', sUzivatelem(async (q, s, req) => {
  const id = pid(req); const op = await opravneni(q, s, id);
  if (!op.lekar && !op.garant) throw chyba('Dokumenty vkládá lékař', 403);
  const b = req.body || {};
  const data = b.data ? Buffer.from(String(b.data), 'base64') : null;
  if (data && data.length > 8 * 1024 * 1024) throw chyba('Soubor je větší než 8 MB');
  const typ = ['DVP', 'ZPRAVA', 'SOUHLAS', 'JINY'].includes(b.typ) ? b.typ : 'JINY';
  await q.exec(`INSERT INTO dbo.A_KP_Dokument (PacientID, Typ, Nazev, KdeOriginal, MimeType, Obsah, Velikost, VlozilUzivatelID) VALUES (@p, @t, @n, @k, @m, @o, @v, @u)`,
    { p: id, t: typ, n: text(b.nazev, 200) || 'dokument', k: text(b.kdeOriginal, 200) || null, m: text(b.mime, 80) || null, o: data, v: data ? data.length : null, u: s.uzivatelId });
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
      CONVERT(char(16), z.PosledniSync, 120) AS sync, z.Baterie AS baterie, z.VerzeAplikace AS verze, z.DelkaFronty AS fronta, z.VerzePlanuVZarizeni AS verzePlanu
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
  for (const [k, v] of zmeny) {
    await q.exec(`MERGE dbo.A_KP_Nastaveni AS t USING (VALUES (@k, @v)) AS s(Klic, Hodnota) ON t.Klic = s.Klic
      WHEN MATCHED THEN UPDATE SET Hodnota = s.Hodnota, Zmeneno = SYSDATETIME() WHEN NOT MATCHED THEN INSERT (Klic, Hodnota) VALUES (s.Klic, s.Hodnota);`, { k, v });
  }
}, { admin: true }));
