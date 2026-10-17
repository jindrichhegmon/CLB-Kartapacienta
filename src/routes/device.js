/**
 * Telefon u pacienta – /api/d/*
 *   POST /parovat  { tenant, kod }                 → { token, tajemstvi, balik }
 *   POST /sync     Authorization: Device <token>   { fronta:[…], verzePlanu, baterie, verzeAplikace }
 *                                                  → { potvrzeno:[uuid], balik } | { prikaz:'smazat' }
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
