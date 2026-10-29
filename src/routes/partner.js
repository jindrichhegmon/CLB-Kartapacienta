/**
 * Partnerské API – pro PéčeDoma (jhn-apps na stejném VPS), ne pro prohlížeč:
 *   GET /api/partner/kod-dne?tenant=<IDTENANT>&rc=<rodné číslo>&kdo=<jméno lékaře>
 *       hlavička x-partner-klic = KP_PARTNER_KLIC
 *       → { kod, platiDo, pacient: { kod, jmeno, prijmeni } }   kód lékaře dne k zapůjčenému telefonu pacienta
 *       → { nemaKartu: true, duvod }                              pacient v Kartě není nebo nemá spárovaný telefon
 * Zobrazení kódu se zapíše do logu přístupů pacienta (kdo = „PéčeDoma: <jméno>“).
 *   POST /api/partner/vstupenka  { tenant, rc, kdo, lekar }   (0.11.65) → { odkaz, pacient: { kod, jmeno, prijmeni } } – odkaz na stránku /pd/
 *       s podepsanou vstupenkou (30 min): náhled pasivní karty a pro lékaře (lekar: true – role ověřuje server PéčeDoma) zápis
 *       nové verze plánu péče; → { nemaKartu: true, duvod }, když pacient v Kartě aktivní průkaz nemá
 */
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { vTenantu } from '../db.js';
import { h, chyba, omez, ip, text } from '../http.js';
import { desifruj, kodDne, konecDnePraha, podepis } from '../crypto.js';
import { audit } from '../kp.js';

export const partner = Router();
const tenantRe = /^[A-Z0-9]{16}$/;

function overKlic(req) {
  const k = String(req.headers['x-partner-klic'] || '');
  if (!config.partnerKlic || config.partnerKlic.length < 24) throw chyba('Partnerské API není na serveru zapnuté (KP_PARTNER_KLIC)', 503);
  if (k.length !== config.partnerKlic.length || !timingSafeEqual(Buffer.from(k), Buffer.from(config.partnerKlic))) throw chyba('Neplatný partnerský klíč', 401);
}

partner.get('/kod-dne', h(async (req) => {
  overKlic(req);
  omez('partner:' + ip(req), 300, 3600e3);
  const tenant = String(req.query.tenant || '').toUpperCase().trim();
  const rc = String(req.query.rc || '').replace(/\D/g, '');
  const kdo = 'PéčeDoma: ' + (text(req.query.kdo, 100) || 'lékař');
  if (!tenantRe.test(tenant)) throw chyba('Chybí nebo je neplatný tenant');
  if (rc.length < 9 || rc.length > 10) throw chyba('Chybí rodné číslo pacienta');
  return vTenantu(tenant, async (q) => {
    const p = await q.one(`SELECT TOP 1 PacientID, KodPrukazu, Jmeno, Prijmeni FROM dbo.A_KP_Pacient WHERE REPLACE(RodneCislo, '/', '') = @rc AND Stav = 'AKTIVNI' ORDER BY PacientID DESC`, { rc });
    if (!p) return { nemaKartu: true, duvod: 'Pacient nemá v Kartě pacienta aktivní průkaz' };
    const z = await q.one(`SELECT TOP 1 ZarizeniID, Tajemstvi FROM dbo.A_KP_Zarizeni WHERE PacientID = @p AND Stav = 'SPAROVANO' AND Rezim = 'ZAPUJCENY' ORDER BY Sparovano DESC`, { p: p.PacientID });
    if (!z) return { nemaKartu: true, duvod: 'Pacient má průkaz, ale zatím žádný spárovaný telefon' };
    const t = desifruj(z.Tajemstvi);
    if (!t) throw chyba('Tajemství telefonu nelze přečíst – telefon je potřeba spárovat znovu', 500);
    await audit(q, { kdo, pacientId: p.PacientID, zarizeniId: z.ZarizeniID, akce: 'kód lékaře zobrazen v PéčeDoma', ip: ip(req) });
    return { kod: kodDne(t), platiDo: konecDnePraha(), pacient: { kod: p.KodPrukazu, jmeno: p.Jmeno, prijmeni: p.Prijmeni } };
  });
}));

partner.post('/vstupenka', h(async (req) => {
  overKlic(req);
  omez('partner:' + ip(req), 300, 3600e3);
  const b = req.body || {};
  const tenant = String(b.tenant || '').toUpperCase().trim();
  const rc = String(b.rc || '').replace(/\D/g, '');
  const kdo = text(b.kdo, 100) || 'lékař';
  const lekar = b.lekar === true;
  if (!tenantRe.test(tenant)) throw chyba('Chybí nebo je neplatný tenant');
  if (rc.length < 9 || rc.length > 10) throw chyba('Chybí rodné číslo pacienta');
  return vTenantu(tenant, async (q) => {
    const p = await q.one(`SELECT TOP 1 PacientID, KodPrukazu, Jmeno, Prijmeni FROM dbo.A_KP_Pacient WHERE REPLACE(RodneCislo, '/', '') = @rc AND Stav = 'AKTIVNI' ORDER BY PacientID DESC`, { rc });
    if (!p) return { nemaKartu: true, duvod: 'Pacient nemá v Kartě pacienta aktivní průkaz' };
    const v = podepis({ typ: 'pd', tenant, pacientId: p.PacientID, kdo, lekar }, 30 * 60);
    await audit(q, { kdo: 'PéčeDoma: ' + kdo, pacientId: p.PacientID, akce: 'otevření karty z PéčeDoma', detail: lekar ? 'lékař – může zapsat plán' : 'náhled', ip: ip(req) });
    return { odkaz: `${config.verejnaAdresa.replace(/\/+$/, '')}/pd/#v=${v}`, pacient: { kod: p.KodPrukazu, jmeno: p.Jmeno, prijmeni: p.Prijmeni } };
  });
}));
