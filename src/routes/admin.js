/**
 * Správa tenantů (aplikace „Tenanti“) – jen pro provozovatele platformy (heslo KP_ADMIN_HESLO).
 *
 * Tenant = organizace, která provozuje síť karet pacientů (např. Nadace Most k domovu Zlín pro kraj,
 * nebo jeden poskytovatel). Používá se SDÍLENÁ tabulka dbo.Tenants z Péče doma Plus:
 *   - existující tenant (stejné IČO) se jen „zapne“ pro kartu pacienta,
 *   - nový tenant dostane IDTENANT = IČO (8) + 8 písmen z názvu (stejně jako 75187868HEGMONJI).
 * Založení = jeden formulář: IČO (název a adresa z ARES), typ prvního pracoviště, jméno a login
 * správce → vznikne tenant, první poskytovatel, administrátor s vygenerovaným heslem a odkaz pro přihlášení.
 */
import { Router } from 'express';
import { timingSafeEqual, createHash, randomInt } from 'node:crypto';
import { config } from '../config.js';
import { vTenantu } from '../db.js';
import { h, chyba, omez, omezReset, ip, bearer, text } from '../http.js';
import { podepis, overSession, hashHeslo, generujHeslo, zasifruj, desifruj } from '../crypto.js';
import { TYPY_POSKYTOVATELE, audit } from '../kp.js';
import { naplnDemo } from '../demo.js';

export const admin = Router();

const vyzadujAdmina = (req) => {
  const s = overSession(bearer(req));
  if (!s || s.typ !== 'superadmin') throw chyba('Přihlášení do správy tenantů vypršelo', 401);
  return s;
};

admin.post('/login', h(async (req) => {
  omez('admin:' + ip(req), 6);
  const a = createHash('sha256').update(String(req.body.heslo || '')).digest();
  const b = createHash('sha256').update(config.adminHeslo).digest();
  if (!config.adminHeslo || !timingSafeEqual(a, b)) throw chyba('Nesprávné heslo', 401);
  omezReset('admin:' + ip(req));
  return { session: podepis({ typ: 'superadmin' }, 8 * 3600) };
}));

/* ---------- ARES ---------- */
async function ares(ico) {
  const i = String(ico || '').replace(/\D/g, '').padStart(8, '0');
  if (!/^\d{8}$/.test(i)) throw chyba('IČO musí mít 8 číslic');
  try {
    const r = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${i}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return { ico: i, nalezeno: false };
    if (!r.ok) return { ico: i, nalezeno: false, chyba: `ARES ${r.status}` };
    const d = await r.json();
    return { ico: i, nalezeno: true, nazev: d.obchodniJmeno || '', adresa: (d.sidlo && d.sidlo.textovaAdresa) || '' };
  } catch (e) {
    return { ico: i, nalezeno: false, chyba: 'ARES nedostupný' };
  }
}
admin.post('/ares', h(async (req) => { vyzadujAdmina(req); return ares(req.body.ico); }));

/* ---------- IDTENANT: IČO + 8 písmen z názvu ---------- */
export function navrhniIdTenanta(ico, nazev) {
  const pismena = String(nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/\b(S\.?\s?R\.?\s?O\.?|A\.?\s?S\.?|Z\.?\s?U\.?|O\.?\s?P\.?\s?S\.?|SPOL\.?|V\.?\s?O\.?\s?S\.?|K\.?\s?S\.?|Z\.?\s?S\.?|ING\.?|MUDR\.?)\b/g, '')
    .replace(/[^A-Z]/g, '');
  let suf = pismena.slice(0, 8);
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  while (suf.length < 8) suf += abc[randomInt(26)];
  return String(ico).padStart(8, '0') + suf;
}

/* ---------- seznam tenantů ---------- */
admin.get('/tenanti', h(async (req) => {
  vyzadujAdmina(req);
  const tenanti = await vTenantu('*', (q) => q.all(`
    SELECT t.IDTENANT AS id, t.ICO AS ico, t.JmenoPoskytovatele AS nazev, t.Aktivni AS aktivni, CONVERT(char(16), t.Vytvoreno, 120) AS vytvoreno, t.Poznamka AS poznamka,
      (SELECT Hodnota FROM dbo.A_KP_Nastaveni n WHERE n.IDTENANT = t.IDTENANT AND n.Klic = 'KP_AKTIVNI') AS kp,
      (SELECT Hodnota FROM dbo.A_KP_Nastaveni n WHERE n.IDTENANT = t.IDTENANT AND n.Klic = 'NAZEV_SITE') AS nazevSite,
      (SELECT COUNT(*) FROM dbo.A_KP_Pacient p WHERE p.IDTENANT = t.IDTENANT AND p.Stav = 'AKTIVNI') AS pacientu,
      (SELECT COUNT(*) FROM dbo.A_KP_Poskytovatel p WHERE p.IDTENANT = t.IDTENANT AND p.Aktivni = 1) AS poskytovatelu,
      (SELECT COUNT(*) FROM dbo.A_KP_Uzivatel u WHERE u.IDTENANT = t.IDTENANT AND u.Aktivni = 1) AS uzivatelu,
      (SELECT COUNT(*) FROM dbo.A_KP_Zarizeni z WHERE z.IDTENANT = t.IDTENANT AND z.Stav = 'SPAROVANO') AS telefonu,
      (SELECT CONVERT(char(16), MAX(z.PosledniSync), 120) FROM dbo.A_KP_Zarizeni z WHERE z.IDTENANT = t.IDTENANT) AS posledniSync
    FROM dbo.Tenants t ORDER BY t.Vytvoreno`));
  return { tenanti: tenanti.map((t) => ({ ...t, kp: t.kp === '1', odkaz: `${config.verejnaAdresa}/centrala/?t=${t.id}` })), typy: TYPY_POSKYTOVATELE };
}));

/* ---------- založení tenanta / zapnutí karty pro existujícího ---------- */
admin.post('/zalozit', h(async (req) => {
  vyzadujAdmina(req);
  const b = req.body || {};
  const ico = String(b.ico || '').replace(/\D/g, '').padStart(8, '0');
  if (!/^\d{8}$/.test(ico) || ico === '00000000') throw chyba('Vyplňte IČO (8 číslic)');
  const typ = String(b.typ || 'HOSPIC').toUpperCase();
  if (!TYPY_POSKYTOVATELE[typ]) throw chyba('Neznámý typ pracoviště');
  const spravceJmeno = text(b.spravceJmeno, 150);
  const spravceLogin = text(b.spravceLogin, 100).toLowerCase();
  if (!spravceJmeno || !/^[a-z0-9._@-]{3,100}$/.test(spravceLogin)) throw chyba('Vyplňte jméno správce a login (malá písmena, číslice, tečka, @)');
  let nazev = text(b.nazev, 200);
  let adresa = text(b.adresa, 300);
  if (!nazev) { const a = await ares(ico); nazev = a.nazev || ''; adresa = adresa || a.adresa || ''; }
  if (!nazev) throw chyba('Vyplňte název organizace (ARES ho nenašel)');

  // 1) tenant ve sdílené dbo.Tenants (bez RLS) – existující podle IČO se použije
  const tenant = await vTenantu('*', async (q) => {
    const ex = await q.one(`SELECT IDTENANT FROM dbo.Tenants WHERE ICO = @ico`, { ico });
    if (ex) return { id: ex.IDTENANT, novy: false };
    let id = navrhniIdTenanta(ico, nazev);
    for (let i = 0; i < 5 && await q.one(`SELECT 1 AS x FROM dbo.Tenants WHERE IDTENANT = @id`, { id }); i++) id = navrhniIdTenanta(ico, '');
    await q.exec(`INSERT INTO dbo.Tenants (IDTENANT, ICO, JmenoPoskytovatele, Aktivni, Poznamka) VALUES (@id, @ico, @n, 1, @p)`,
      { id, ico, n: nazev, p: 'Založeno ze správy tenantů Karty pacienta' });
    return { id, novy: true };
  });

  // 2) karta pacienta v kontextu nového tenanta (DEFAULT IDTENANT ze SESSION_CONTEXT)
  const heslo = generujHeslo();
  const vysledek = await vTenantu(tenant.id, async (q) => {
    const uz = await q.one(`SELECT COUNT(*) AS n FROM dbo.A_KP_Uzivatel`);
    if (uz.n > 0 && !b.pridatSpravce) throw chyba('Tento tenant už má kartu pacienta zapnutou – nového správce přidejte přes „Reset správce“', 409);
    await q.exec(`MERGE dbo.A_KP_Nastaveni AS t USING (VALUES ('KP_AKTIVNI', '1'), ('NAZEV_SITE', @n), ('ZALOZENO', CONVERT(nvarchar(30), SYSDATETIME(), 120))) AS s(Klic, Hodnota)
      ON t.Klic = s.Klic WHEN MATCHED THEN UPDATE SET Hodnota = s.Hodnota, Zmeneno = SYSDATETIME() WHEN NOT MATCHED THEN INSERT (Klic, Hodnota) VALUES (s.Klic, s.Hodnota);`,
    { n: text(b.nazevSite, 200) || nazev });
    let posk = await q.one(`SELECT TOP 1 PoskytovatelID FROM dbo.A_KP_Poskytovatel WHERE ICO = @ico`, { ico });
    if (!posk) {
      posk = await q.one(`INSERT INTO dbo.A_KP_Poskytovatel (Nazev, ICO, Typ, Telefon24, Adresa) OUTPUT inserted.PoskytovatelID VALUES (@n, @ico, @t, @tel, @a)`,
        { n: nazev, ico, t: typ, tel: text(b.telefon24, 40) || null, a: adresa || null });
    }
    const role = ['admin', ...(b.spravceLekar ? ['lekar'] : [])].join(',');
    const u = await q.one(`INSERT INTO dbo.A_KP_Uzivatel (PoskytovatelID, Jmeno, Login, Email, Telefon, HesloHash, HesloPrvni, MusiZmenitHeslo, Role)
      OUTPUT inserted.UzivatelID VALUES (@p, @j, @l, @e, @tel, @hh, @hp, 1, @r)`,
    { p: posk.PoskytovatelID, j: spravceJmeno, l: spravceLogin, e: text(b.spravceEmail, 200) || null, tel: text(b.spravceTelefon, 40) || null, hh: hashHeslo(heslo), hp: zasifruj(heslo), r: role });
    await audit(q, { kdo: 'správa tenantů', akce: 'tenant zapnut', detail: `správce ${spravceLogin}`, ip: ip(req) });
    if (b.demo) await naplnDemo(q, { poskytovatelId: posk.PoskytovatelID, uzivatelId: u.UzivatelID, jmeno: spravceJmeno });
    return { poskytovatelId: posk.PoskytovatelID, uzivatelId: u.UzivatelID };
  });

  return {
    tenant: tenant.id, novyTenant: tenant.novy, nazev,
    login: spravceLogin, heslo,
    odkaz: `${config.verejnaAdresa}/centrala/?t=${tenant.id}`,
    ...vysledek,
  };
}));

/* ---------- zapnout / vypnout kartu pacienta pro tenanta ---------- */
admin.post('/aktivni', h(async (req) => {
  vyzadujAdmina(req);
  const id = String(req.body.tenant || '');
  const zap = req.body.aktivni ? '1' : '0';
  await vTenantu(id, async (q) => {
    await q.exec(`MERGE dbo.A_KP_Nastaveni AS t USING (VALUES ('KP_AKTIVNI', @v)) AS s(Klic, Hodnota) ON t.Klic = s.Klic
      WHEN MATCHED THEN UPDATE SET Hodnota = s.Hodnota, Zmeneno = SYSDATETIME() WHEN NOT MATCHED THEN INSERT (Klic, Hodnota) VALUES (s.Klic, s.Hodnota);`, { v: zap });
    await audit(q, { kdo: 'správa tenantů', akce: zap === '1' ? 'tenant zapnut' : 'tenant vypnut', ip: ip(req) });
  });
  return {};
}));

/* ---------- správci tenanta + reset hesla ---------- */
admin.post('/spravci', h(async (req) => {
  vyzadujAdmina(req);
  const rows = await vTenantu(String(req.body.tenant || ''), (q) => q.all(`SELECT u.UzivatelID AS id, u.Jmeno AS jmeno, u.Login AS login, u.Role AS role, u.Aktivni AS aktivni,
      u.MusiZmenitHeslo AS musiZmenit, u.HesloPrvni AS hp, CONVERT(char(16), u.PosledniPrihlaseni, 120) AS posledni, p.Nazev AS poskytovatel
    FROM dbo.A_KP_Uzivatel u JOIN dbo.A_KP_Poskytovatel p ON p.PoskytovatelID = u.PoskytovatelID ORDER BY u.UzivatelID`));
  return { uzivatele: rows.map(({ hp, ...u }) => ({ ...u, prvniHeslo: u.musiZmenit ? desifruj(hp) : '' })) };
}));

admin.post('/reset-hesla', h(async (req) => {
  vyzadujAdmina(req);
  const heslo = generujHeslo();
  const n = await vTenantu(String(req.body.tenant || ''), async (q) => {
    const n = await q.exec(`UPDATE dbo.A_KP_Uzivatel SET HesloHash = @hh, HesloPrvni = @hp, MusiZmenitHeslo = 1, Aktivni = 1 WHERE UzivatelID = @u`,
      { hh: hashHeslo(heslo), hp: zasifruj(heslo), u: Number(req.body.uzivatelId) });
    await audit(q, { kdo: 'správa tenantů', akce: 'reset hesla', detail: `uživatel ${req.body.uzivatelId}`, ip: ip(req) });
    return n;
  });
  if (!n) throw chyba('Uživatel nenalezen', 404);
  return { heslo };
}));
