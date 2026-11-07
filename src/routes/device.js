/**
 * Telefon u pacienta – /api/d/*
 *   POST /parovat  { tenant, kod }                 → { token, tajemstvi, balik }
 *   POST /sync     Authorization: Device <token>   { fronta:[…], verzePlanu, baterie, verzeAplikace }
 *                                                  → { potvrzeno:[uuid], balik } | { prikaz:'smazat' }
 *   POST /prenos/zahajit|prevzit|stav               → hromadná výměna telefonu (viz src/prenos.js)
 * Token zařízení = "<IDTENANT>.<ZarizeniID>.<náhodných 32 B>", v DB je jen jeho SHA-256.
 * Synchronizace je idempotentní: zápis se pozná podle UUID z telefonu, opakované odeslání se ignoruje.
 * Plán péče posílá jen server – telefon ho nikdy nemění.
 */
import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { vTenantu } from '../db.js';
import { h, chyba, omez, ip, bearer, text } from '../http.js';
import { nahodny, sha256, zasifruj } from '../crypto.js';
import { audit, zapisDenik, balikProZarizeni } from '../kp.js';
import { config } from '../config.js';
import { zalozPrenos, vezmiPrenos, dokonciPrenos, stavPrenosu, zrusPrenos, normalizujKod, formatujKod, PRENOS_KOD_RE } from '../prenos.js';

export const device = Router();
const tenantRe = /^[A-Z0-9]{16}$/;

// co smí telefon zapsat (podle toho, kdo je na telefonu odemčený)
const POVOLENE = {
  zzs: ['Výjezd ZZS'],
  rodina: ['Pozorování rodiny', 'Podán SOS lék', 'Změna stavu', 'Telefonát', 'Zhoršení stavu', 'Stav stabilizován'],
  sestra: ['Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Návštěva hospice', 'Telefonát', 'Pozorování rodiny', 'Zhoršení stavu', 'Stav stabilizován'],
  hospic: ['Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Návštěva hospice', 'Telefonát', 'Zhoršení stavu', 'Stav stabilizován'],
  pl: ['Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Telefonát', 'Zhoršení stavu', 'Stav stabilizován'],
  lekar: ['Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Návštěva hospice', 'Telefonát', 'Zhoršení stavu', 'Stav stabilizován'],
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

device.post('/parovat', h(async (req) => {
  const tenant = String(req.body.tenant || '').toUpperCase().trim();
  const kod = String(req.body.kod || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!tenantRe.test(tenant) || kod.length !== 8) throw chyba('Neplatný párovací kód');
  omez('parovani:' + ip(req), 10);
  return vTenantu(tenant, async (q) => {
    const z = await q.one(`SELECT ZarizeniID, PacientID FROM dbo.A_KP_Zarizeni WHERE ParovaciKod = @k AND Stav = 'CEKA' AND ParovaciPlatnost > SYSDATETIME()`, { k: kod });
    if (!z) throw chyba('Kód je neplatný nebo vypršel – vygenerujte v centrální aplikaci nový', 404);
    const raw = nahodny(32);
    const tajemstvi = randomBytes(20).toString('hex');
    // předchozí telefon pacienta se zablokuje (při připojení se vymaže) – platí vždy jen jeden
    await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = 'ZABLOKOVANO' WHERE PacientID = @p AND Stav = 'SPAROVANO'`, { p: z.PacientID });
    await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = 'SPAROVANO', TokenHash = @th, Tajemstvi = @t, Sparovano = SYSDATETIME(), PosledniSync = SYSDATETIME(), ParovaciKod = NULL, ParovaciPlatnost = NULL
      WHERE ZarizeniID = @z`, { th: sha256(raw), t: zasifruj(tajemstvi), z: z.ZarizeniID });
    await zapisDenik(q, { pacientId: z.PacientID, typ: 'Systém', text: 'Průkaz nahrán do telefonu u pacienta.', autor: 'telefon ' + z.ZarizeniID, role: 'system', zarizeniId: z.ZarizeniID });
    await audit(q, { zarizeniId: z.ZarizeniID, kdo: 'telefon', pacientId: z.PacientID, akce: 'telefon spárován', ip: ip(req) });
    const balik = await balikProZarizeni(q, z.PacientID);
    return { token: `${tenant}.${z.ZarizeniID}.${raw}`, tajemstvi, zarizeniId: z.ZarizeniID, balik };
  });
}));

device.post('/sync', h(async (req) => {
  const [tenant, zidS, raw] = bearer(req, 'Device').split('.');
  const zid = Number(zidS);
  if (!tenantRe.test(tenant || '') || !zid || !raw) throw chyba('Telefon není spárovaný', 401);
  omez('sync:' + zid, 120, 3600e3);
  const b = req.body || {};
  return vTenantu(tenant, async (q) => {
    const z = await q.one(`SELECT ZarizeniID, PacientID, Stav, TokenHash FROM dbo.A_KP_Zarizeni WHERE ZarizeniID = @z`, { z: zid });
    const ok = z && z.TokenHash && timingSafeEqual(Buffer.from(z.TokenHash), Buffer.from(sha256(raw)));
    if (!ok) throw chyba('Telefon není spárovaný', 401);
    if (z.Stav !== 'SPAROVANO') {
      await audit(q, { zarizeniId: zid, kdo: 'telefon', pacientId: z.PacientID, akce: 'telefon vymazán na pokyn serveru', ip: ip(req) });
      await q.exec(`UPDATE dbo.A_KP_Zarizeni SET TokenHash = NULL, PosledniSync = SYSDATETIME() WHERE ZarizeniID = @z`, { z: zid });
      return { prikaz: 'smazat' };
    }
    const pac = await q.one(`SELECT Stav FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: z.PacientID });
    const potvrzeno = [];
    const odmitnuto = [];
    for (const e of (Array.isArray(b.fronta) ? b.fronta : []).slice(0, 200)) {
      const uuid = String(e.uuid || '');
      if (!UUID_RE.test(uuid)) continue;
      const role = String(e.role || '').toLowerCase();
      const typ = String(e.typ || '');
      if (!POVOLENE[role] || !POVOLENE[role].includes(typ) || pac.Stav !== 'AKTIVNI') { odmitnuto.push(uuid); continue; }
      const cas = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(e.cas || '') ? new Date(e.cas) : null;
      const casOk = cas && !isNaN(cas) && cas.getTime() < Date.now() + 10 * 60e3 && cas.getTime() > Date.now() - 60 * 864e5 ? cas : null;
      await zapisDenik(q, {
        pacientId: z.PacientID, typ, text: text(e.text, 4000) || '(bez textu)', autor: text(e.autor, 150) || (role === 'zzs' ? 'posádka ZZS' : 'neuvedeno'),
        role, zarizeniId: zid, cas: casOk, uuid, overeno: role !== 'zzs' && !!e.overeno,
      });
      potvrzeno.push(uuid);
    }
    if (potvrzeno.length) await audit(q, { zarizeniId: zid, kdo: 'telefon', pacientId: z.PacientID, akce: 'synchronizace zápisů', detail: `${potvrzeno.length} zápisů`, ip: ip(req) });
    const baterie = Number.isFinite(Number(b.baterie)) && b.baterie !== null ? Math.max(0, Math.min(100, Math.round(Number(b.baterie)))) : null;
    const balik = await balikProZarizeni(q, z.PacientID);
    await q.exec(`UPDATE dbo.A_KP_Zarizeni SET PosledniSync = SYSDATETIME(), Baterie = ISNULL(@b, Baterie), VerzeAplikace = @v, DelkaFronty = @f, VerzePlanuVZarizeni = @vp WHERE ZarizeniID = @z`,
      { b: baterie, v: text(b.verzeAplikace, 20) || null, f: Math.max(0, (Array.isArray(b.fronta) ? b.fronta.length : 0) - potvrzeno.length - odmitnuto.length), vp: balik.plan ? balik.plan.verze : null, z: zid });
    return { potvrzeno, odmitnuto, balik };
  });
}));

/* ---------------- hromadná výměna telefonu (A → B) ---------------- */
const MAX_KARET = 50;

/** Rozloží token zařízení "<tenant>.<id>.<raw>" (nebo null). */
function rozlozToken(t) {
  const [tenant, zidS, raw] = String(t || '').split('.');
  const zid = Number(zidS);
  return tenantRe.test(tenant || '') && Number.isInteger(zid) && zid > 0 && raw ? { tenant, zid, raw } : null;
}

// starý telefon: ověří všechny své tokeny a dostane jednorázový kód pro QR
device.post('/prenos/zahajit', h(async (req) => {
  omez('prenos-zahajit:' + ip(req), 10);
  const tokeny = [...new Set((Array.isArray(req.body.tokeny) ? req.body.tokeny : []).map(String))].slice(0, MAX_KARET);
  if (!tokeny.length) throw chyba('V telefonu nejsou žádné průkazy k přenosu');
  const karty = [];
  let neplatnych = 0;
  for (const t of tokeny) {
    const r = rozlozToken(t);
    if (!r) { neplatnych++; continue; }
    const ok = await vTenantu(r.tenant, async (q) => {
      const z = await q.one(`SELECT ZarizeniID, PacientID, Stav, TokenHash FROM dbo.A_KP_Zarizeni WHERE ZarizeniID = @z`, { z: r.zid });
      const sedi = z && z.TokenHash && z.Stav === 'SPAROVANO' && timingSafeEqual(Buffer.from(z.TokenHash), Buffer.from(sha256(r.raw)));
      if (!sedi) return false;
      await audit(q, { zarizeniId: r.zid, kdo: 'telefon', pacientId: z.PacientID, akce: 'výměna telefonu zahájena', detail: `${tokeny.length} průkazů v telefonu`, ip: ip(req) });
      return true;
    });
    if (ok) karty.push({ tenant: r.tenant, zarizeniId: r.zid, tokenHash: sha256(r.raw) });
    else neplatnych++;
  }
  if (!karty.length) throw chyba('Žádný průkaz v tomto telefonu už není platný – nelze ho přenést', 409);
  const { kod, platnost } = zalozPrenos(karty);
  return { kod, kodZobrazeni: formatujKod(kod), platnost: platnost.toISOString(), pocet: karty.length, neplatnych, odkaz: `${config.verejnaAdresa}/karta/#prenos=${kod}` };
}));

// nový telefon: naskenuje QR a převezme všechny průkazy (nové tokeny), starý se zablokuje
device.post('/prenos/prevzit', h(async (req) => {
  omez('prenos-prevzit:' + ip(req), 10);
  const kod = normalizujKod(req.body.kod);
  if (!PRENOS_KOD_RE.test(kod)) throw chyba('Neplatný kód pro výměnu telefonu');
  const p = vezmiPrenos(kod);
  if (!p) throw chyba('Kód je neplatný, už byl použit nebo vypršel – na starém telefonu vygenerujte nový', 404);
  const karty = [];
  let neprevzato = 0;
  for (const k of p.karty) {
    try {
      const v = await vTenantu(k.tenant, async (q) => {
        const z = await q.one(`SELECT ZarizeniID, PacientID, Stav, TokenHash, Stitek FROM dbo.A_KP_Zarizeni WHERE ZarizeniID = @z`, { z: k.zarizeniId });
        // mezitím mohl být starý telefon zablokován nebo průkaz nahrán jinam – pak se nepřenáší
        if (!z || z.Stav !== 'SPAROVANO' || z.TokenHash !== k.tokenHash) return null;
        const raw = nahodny(32);
        const tajemstvi = randomBytes(20).toString('hex');
        const nove = await q.one(`INSERT INTO dbo.A_KP_Zarizeni (PacientID, Stitek, Stav, TokenHash, Tajemstvi, Sparovano, PosledniSync)
          OUTPUT inserted.ZarizeniID VALUES (@p, @st, 'SPAROVANO', @th, @t, SYSDATETIME(), SYSDATETIME())`,
        { p: z.PacientID, st: z.Stitek, th: sha256(raw), t: zasifruj(tajemstvi) });
        await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = 'ZABLOKOVANO', ParovaciKod = NULL WHERE ZarizeniID = @z`, { z: z.ZarizeniID });
        await zapisDenik(q, { pacientId: z.PacientID, typ: 'Systém', text: `Výměna telefonu: průkaz přenesen z telefonu ${z.ZarizeniID} na nový telefon ${nove.ZarizeniID}. Starý telefon se při připojení vymaže.`, autor: 'telefon ' + nove.ZarizeniID, role: 'system', zarizeniId: nove.ZarizeniID });
        await audit(q, { zarizeniId: nove.ZarizeniID, kdo: 'telefon', pacientId: z.PacientID, akce: 'výměna telefonu: průkaz převzat', detail: `ze zařízení ${z.ZarizeniID}`, ip: ip(req) });
        await audit(q, { zarizeniId: z.ZarizeniID, kdo: 'telefon', pacientId: z.PacientID, akce: 'výměna telefonu: telefon zablokován', detail: `nahrazen zařízením ${nove.ZarizeniID}`, ip: ip(req) });
        const balik = await balikProZarizeni(q, z.PacientID);
        return { tenant: k.tenant, token: `${k.tenant}.${nove.ZarizeniID}.${raw}`, tajemstvi, zarizeniId: nove.ZarizeniID, balik };
      });
      if (v) karty.push(v); else neprevzato++;
    } catch (e) {
      console.error(new Date().toISOString(), 'výměna telefonu', k.tenant, k.zarizeniId, e);
      neprevzato++;
    }
  }
  dokonciPrenos(kod, karty.length);
  if (!karty.length) throw chyba('Žádný průkaz se nepodařilo převzít (starý telefon byl mezitím zablokován?)', 409);
  return { karty, neprevzato };
}));

// starý telefon se ptá, jestli už nový telefon průkazy převzal (zná jen kód, žádná data)
device.post('/prenos/stav', h(async (req) => {
  omez('prenos-stav:' + ip(req), 400);
  const kod = normalizujKod(req.body.kod);
  if (!PRENOS_KOD_RE.test(kod)) throw chyba('Neplatný kód');
  return stavPrenosu(kod);
}));

device.post('/prenos/zrusit', h(async (req) => {
  const kod = normalizujKod(req.body.kod);
  if (!PRENOS_KOD_RE.test(kod)) throw chyba('Neplatný kód');
  return { zruseno: zrusPrenos(kod) };
}));
