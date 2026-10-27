/**
 * Telefon u pacienta – /api/d/*
 *   POST /parovat  { tenant, kod, telefon, rezim } → { token, tajemstvi, balik }   telefon = číslo tohoto telefonu, musí se shodovat
 *                                                  s číslem karty u pacienta (A_KP_Pacient.TelefonKarty) – karta je jen v jednom telefonu;
 *                                                  rezim PACIENT = vlastní telefon pacienta („Můj průkaz“), číslo je u kódu (A_KP_Zarizeni.Telefon)
 *   POST /sync     Authorization: Device <token>   { fronta:[…], verzePlanu, baterie, verzeAplikace }
 *                                                  → { potvrzeno:[uuid], balik } | { prikaz:'smazat' } | { prikaz:'odpojit' } (vlastní telefon pacienta)
 *   POST /sdilet   Authorization: Device <token>   { polozky:[{druh, nazev, obsah, puvod, aktualizovano}] } – jen vlastní telefon pacienta;
 *                                                  pacient vybral, viděl náhled a potvrdil → A_KP_Sdileni + zápis do deníku
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
import { normTel, hezkyTel } from '../telefon.js';
import { videoServer, aktivniHovor, zahajHovor, prijmiHovor, ukonciHovor, odkazDoHovoru } from '../video.js';
import { nastaveniPd, zaznamyPd, DRUHY_PRO_PD, predejZhorseniPd, TYPY_ZHORSENI, zpravyPd, posliZpravuPd, lekyPd, ulozLekPd, smazLekPd, synchronizujPacienta } from '../pecedoma.js';

export const device = Router();
const tenantRe = /^[A-Z0-9]{16}$/;

// co smí telefon zapsat (podle toho, kdo je na telefonu odemčený)
export const POVOLENE = {
  zzs: ['Výjezd ZZS'],
  rodina: ['Pozorování rodiny', 'Podán SOS lék', 'Změna stavu', 'Telefonát', 'Zhoršení stavu', 'Stav stabilizován'],
  sestra: ['Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Návštěva hospice', 'Telefonát', 'Pozorování rodiny', 'Zhoršení stavu', 'Stav stabilizován'],
  hospic: ['Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Návštěva hospice', 'Telefonát', 'Zhoršení stavu', 'Stav stabilizován'],
  pl: ['Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Telefonát', 'Zhoršení stavu', 'Stav stabilizován'],
  lekar: ['Změna stavu', 'Podán SOS lék', 'Návštěva lékaře', 'Návštěva hospice', 'Telefonát', 'Zhoršení stavu', 'Stav stabilizován'],
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REZIM_NAZ = { ZAPUJCENY: 'Karta pacienta (zapůjčený telefon)', PACIENT: 'Můj průkaz (vlastní telefon pacienta)' };

/* Předvyplnění čísla při párování (od 0.8.5): k platnému kódu vrátí číslo, pro které byl vydán – odkaz z SMS přišel právě na něj,
   takže držitel ho zná; proti hádání kódů je limit na IP. Při samotném párování se číslo stále ověřuje. */
device.get('/parovaci-info', h(async (req) => {
  const tenant = String(req.query.tenant || '').toUpperCase().trim();
  const kod = String(req.query.kod || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!tenantRe.test(tenant) || kod.length !== 8) throw chyba('Neplatný párovací kód');
  omez('pinfo:' + ip(req), 30, 3600e3);
  return vTenantu(tenant, async (q) => {
    const z = await q.one(`SELECT z.Rezim, z.Telefon, p.TelefonKarty FROM dbo.A_KP_Zarizeni z JOIN dbo.A_KP_Pacient p ON p.PacientID = z.PacientID
      WHERE z.ParovaciKod = @k AND z.Stav IN ('CEKA', 'SPAROVANO') AND z.ParovaciPlatnost > SYSDATETIME()`, { k: kod });
    if (!z) throw chyba('Kód je neplatný nebo vypršel – vygenerujte v centrální aplikaci nový', 404);
    const t = normTel(z.Rezim === 'PACIENT' ? z.Telefon : z.TelefonKarty);
    return { rezim: z.Rezim, telefon: t ? hezkyTel(t) : '' };
  });
}));

device.post('/parovat', h(async (req) => {
  const rezim = req.body.rezim === 'PACIENT' ? 'PACIENT' : 'ZAPUJCENY';
  const tenant = String(req.body.tenant || '').toUpperCase().trim();
  const kod = String(req.body.kod || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!tenantRe.test(tenant) || kod.length !== 8) throw chyba('Neplatný párovací kód');
  const telefon = normTel(req.body.telefon);
  if (!telefon) throw chyba('Zadejte číslo tohoto telefonu (např. +420 777 123 456)');
  omez('parovani:' + ip(req), 10);
  return vTenantu(tenant, async (q) => {
    /* 0.11.10: kód platí po celou dobu platnosti i po spárování – stejný telefon (stejné číslo) ho smí použít znovu, typicky když se
       aplikace po spárování v Safari přidá na plochu iPhonu (aplikace na ploše má vlastní úložiště). Předchozí kopie tím ztratí přístup. */
    const z = await q.one(`SELECT z.ZarizeniID, z.PacientID, z.Rezim, z.Telefon, z.Stav, p.TelefonKarty FROM dbo.A_KP_Zarizeni z JOIN dbo.A_KP_Pacient p ON p.PacientID = z.PacientID
      WHERE z.ParovaciKod = @k AND z.Stav IN ('CEKA', 'SPAROVANO') AND z.ParovaciPlatnost > SYSDATETIME()`, { k: kod });
    if (!z) throw chyba('Kód je neplatný nebo vypršel – vygenerujte v centrální aplikaci nový', 404);
    if (z.Rezim !== rezim) throw chyba(`Tento kód patří do aplikace ${REZIM_NAZ[z.Rezim]} – otevřete odkaz z SMS nebo QR kód v ní`, 409);
    // karta je jen v telefonu s číslem uvedeným u pacienta (vlastní telefon pacienta: s číslem, na které lékař kód vydal)
    const ocekavane = normTel(rezim === 'PACIENT' ? z.Telefon : z.TelefonKarty);
    if (!ocekavane || ocekavane !== telefon) {
      throw chyba(rezim === 'PACIENT'
        ? 'Kód je vydaný pro jiné číslo telefonu – zadejte číslo, na které vám přišla SMS, nebo požádejte lékaře o nový kód'
        : 'Karta tohoto pacienta je určená pro jiné číslo telefonu – nahrát ji jde jen do telefonu s číslem uvedeným v centrální aplikaci', 403);
    }
    const raw = nahodny(32);
    const tajemstvi = randomBytes(20).toString('hex');
    // předchozí telefon pacienta téhož režimu se zablokuje – platí vždy jen jeden zapůjčený a jeden vlastní
    const znovu = z.Stav === 'SPAROVANO';
    // zapůjčený telefon: platí vždy jen jeden; vlastní telefony pacienta a rodiny (0.11.22): víc najednou, zablokuje se jen předchozí kopie se stejným číslem
    await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = 'ZABLOKOVANO', ParovaciKod = NULL WHERE PacientID = @p AND Stav = 'SPAROVANO' AND Rezim = @r AND ZarizeniID <> @z AND (@r = 'ZAPUJCENY' OR Telefon = @tel)`, { p: z.PacientID, r: rezim, z: z.ZarizeniID, tel: telefon });
    await q.exec(`UPDATE dbo.A_KP_Zarizeni SET Stav = 'SPAROVANO', TokenHash = @th, Tajemstvi = @t, Sparovano = SYSDATETIME(), PosledniSync = SYSDATETIME(), Telefon = @tel
      WHERE ZarizeniID = @z`, { th: sha256(raw), t: rezim === 'PACIENT' ? null : zasifruj(tajemstvi), tel: telefon, z: z.ZarizeniID });
    if (!znovu) await zapisDenik(q, { pacientId: z.PacientID, typ: 'Systém', text: rezim === 'PACIENT' ? `Průkaz zpřístupněn ve vlastním telefonu pacienta (${hezkyTel(telefon)}).` : `Průkaz nahrán do telefonu u pacienta (${hezkyTel(telefon)}).`, autor: 'telefon ' + z.ZarizeniID, role: 'system', zarizeniId: z.ZarizeniID });
    await audit(q, { zarizeniId: z.ZarizeniID, kdo: rezim === 'PACIENT' ? 'telefon pacienta' : 'telefon', pacientId: z.PacientID, akce: znovu ? 'telefon spárován znovu stejným kódem' : 'telefon spárován', detail: znovu ? 'předchozí kopie v tomto telefonu (např. v Safari) ztrácí přístup' : null, ip: ip(req) });
    const balik = await balikProZarizeni(q, z.PacientID, { rezim });
    // kód lékaře (TOTP) má smysl jen na zapůjčeném telefonu, který odemyká tým
    return { token: `${tenant}.${z.ZarizeniID}.${raw}`, tajemstvi: rezim === 'PACIENT' ? null : tajemstvi, zarizeniId: z.ZarizeniID, telefon: hezkyTel(telefon), rezim, balik };
  });
}));

/** Token zařízení z hlavičky → { tenant, zid, raw }. */
function tokenZarizeni(req) {
  const [tenant, zidS, raw] = bearer(req, 'Device').split('.');
  const zid = Number(zidS);
  if (!tenantRe.test(tenant || '') || !zid || !raw) throw chyba('Telefon není spárovaný', 401);
  return { tenant, zid, raw };
}
async function overZarizeni(q, zid, raw) {
  const z = await q.one(`SELECT ZarizeniID, PacientID, Stav, Rezim, TokenHash FROM dbo.A_KP_Zarizeni WHERE ZarizeniID = @z`, { z: zid });
  const ok = z && z.TokenHash && timingSafeEqual(Buffer.from(z.TokenHash), Buffer.from(sha256(raw)));
  if (!ok) throw chyba('Telefon není spárovaný', 401);
  return z;
}

device.post('/sync', h(async (req) => {
  const { tenant, zid, raw } = tokenZarizeni(req);
  omez('sync:' + zid, 120, 3600e3);
  const b = req.body || {};
  return vTenantu(tenant, async (q) => {
    const z = await overZarizeni(q, zid, raw);
    if (z.Stav !== 'SPAROVANO' && z.Rezim === 'PACIENT') {
      // vlastní telefon pacienta: data od lékaře se přestanou aktualizovat, ale co pacient má, je jeho kopie – nic se nemaže
      await audit(q, { zarizeniId: zid, kdo: 'telefon pacienta', pacientId: z.PacientID, akce: 'přístup pacienta ukončen', ip: ip(req) });
      await q.exec(`UPDATE dbo.A_KP_Zarizeni SET TokenHash = NULL, PosledniSync = SYSDATETIME() WHERE ZarizeniID = @z`, { z: zid });
      return { prikaz: 'odpojit' };
    }
    if (z.Stav !== 'SPAROVANO') {
      await audit(q, { zarizeniId: zid, kdo: 'telefon', pacientId: z.PacientID, akce: 'telefon vymazán na pokyn serveru', ip: ip(req) });
      await q.exec(`UPDATE dbo.A_KP_Zarizeni SET TokenHash = NULL, PosledniSync = SYSDATETIME() WHERE ZarizeniID = @z`, { z: zid });
      return { prikaz: 'smazat' };
    }
    const pac = await q.one(`SELECT Stav FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: z.PacientID });
    const potvrzeno = [];
    const odmitnuto = [], zhorseni = [];
    // vlastní telefon pacienta do deníku nezapisuje – týmu posílá jen to, co sám vybere (/sdilet)
    for (const e of (z.Rezim === 'PACIENT' ? [] : Array.isArray(b.fronta) ? b.fronta : []).slice(0, 200)) {
      const uuid = String(e.uuid || '');
      if (!UUID_RE.test(uuid)) continue;
      const role = String(e.role || '').toLowerCase();
      const typ = String(e.typ || '');
      if (!POVOLENE[role] || !POVOLENE[role].includes(typ) || pac.Stav !== 'AKTIVNI') { odmitnuto.push(uuid); continue; }
      const cas = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(e.cas || '') ? new Date(e.cas) : null;
      const casOk = cas && !isNaN(cas) && cas.getTime() < Date.now() + 10 * 60e3 && cas.getTime() > Date.now() - 60 * 864e5 ? cas : null;
      const zapsano = await zapisDenik(q, {
        pacientId: z.PacientID, typ, text: text(e.text, 4000) || '(bez textu)', autor: text(e.autor, 150) || (role === 'zzs' ? 'posádka ZZS' : 'neuvedeno'),
        role, zarizeniId: zid, cas: casOk, uuid, overeno: role !== 'zzs' && !!e.overeno,
      });
      if (zapsano.novy && TYPY_ZHORSENI.includes(typ)) zhorseni.push({ typ, text: text(e.text, 4000) || '(bez textu)', autor: text(e.autor, 150) || 'neuvedeno', role: ROLE_CHAT[role] || role, cas: casOk ? casOk.toISOString().slice(0, 16).replace('T', ' ') : null });
      potvrzeno.push(uuid);
    }
    if (potvrzeno.length) await audit(q, { zarizeniId: zid, kdo: 'telefon', pacientId: z.PacientID, akce: 'synchronizace zápisů', detail: `${potvrzeno.length} zápisů`, ip: ip(req) });
    // 0.11.28: zhoršení a stabilizace jdou u propojeného pacienta i do PéčeDoma (historie zhoršení v Data klienta → Z Karty pacienta)
    if (zhorseni.length) await predejZhorseniPd(q, z.PacientID, zhorseni, { audit: (qq, a) => audit(qq, { ...a, zarizeniId: zid }), ip: ip(req) });
    const baterie = Number.isFinite(Number(b.baterie)) && b.baterie !== null ? Math.max(0, Math.min(100, Math.round(Number(b.baterie)))) : null;
    const balik = await balikProZarizeni(q, z.PacientID, { rezim: z.Rezim });
    await q.exec(`UPDATE dbo.A_KP_Zarizeni SET PosledniSync = SYSDATETIME(), Baterie = ISNULL(@b, Baterie), VerzeAplikace = @v, DelkaFronty = @f, VerzePlanuVZarizeni = @vp WHERE ZarizeniID = @z`,
      { b: baterie, v: text(b.verzeAplikace, 20) || null, f: Math.max(0, (Array.isArray(b.fronta) ? b.fronta.length : 0) - potvrzeno.length - odmitnuto.length), vp: balik.plan ? balik.plan.verze : null, z: zid });
    return { potvrzeno, odmitnuto, balik };
  });
}));

const DRUHY_SDILENI = { PRANI: 'Moje hodnoty a přání', LEKY: 'Léky, které užívám', PODANI: 'Podání léků', POZNAMKA: 'Poznámka pacienta', OTAZKY: 'Otázky pro lékaře' };
/* chat PéčeDoma z telefonu (od 0.8.0): zapůjčený telefon (rodina, tým u pacienta) i Můj průkaz píší „za stranu pacienta“ (OD_PACIENTA)
   se značkou [Karta · kdo]; čtení i psaní jde přes server Karty s partnerským klíčem, telefon token PéčeDoma nikdy nedostane. */
const ROLE_CHAT = { lekar: 'lékař / spec. sestra', sestra: 'sestra DPS', rodina: 'rodina', hospic: 'hospic', pl: 'praktický lékař' };
function overAktivni(z) {
  if (z.Stav === 'SPAROVANO') return;
  throw chyba(z.Rezim === 'PACIENT' ? 'Lékař ukončil přístup k průkazu v tomto telefonu – zprávy nelze číst ani posílat. Pokud jde o omyl, požádejte o nový kód.'
    : 'Tento telefon byl v centrální aplikaci zablokován – zprávy nelze číst ani posílat.', 403);
}
async function chatKontext(q, z) {
  overAktivni(z);
  const p = await q.one(`SELECT LOWER(CONVERT(char(36), PdKlientID)) AS pd, Stav FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: z.PacientID });
  if (!p || !p.pd) throw chyba('Pacient není propojený s PéčeDoma', 400);
  const nast = await nastaveniPd(q);
  if (!nast.nastaveno) throw chyba('Propojení s PéčeDoma není nastavené', 400);
  return { nast, pd: p.pd, stav: p.Stav };
}
/* Léky z telefonu u pacienta (od 0.9.1): lékař (role lekar / pl po odemknutí) upravuje léky propojeného pacienta stejně jako v PéčeDoma –
   zápis jde do A_MSPPP_Medikace přes server Karty, pak hned synchronizace. Role je deklarovaná telefonem jako u deníku (PIN se ověřuje offline). */
const ROLE_LEKY = { lekar: 'lékař / spec. sestra', pl: 'praktický lékař' };
async function lekyKontext(q, z, b) {
  if (z.Rezim !== 'ZAPUJCENY') throw chyba('Léky z vlastního telefonu pacienta měnit nejde', 403);
  const role = String((b && b.role) || '').toLowerCase();
  if (!ROLE_LEKY[role]) throw chyba('Léky na telefonu upravuje lékař nebo specializovaná sestra (odemčení kódem lékaře nebo PINem s rolí Lékař a spec. sestra)', 403);
  const { nast, pd, stav } = await chatKontext(q, z);
  if (stav !== 'AKTIVNI') throw chyba('Průkaz je uzavřený', 403);
  return { nast, pd, kdo: [ROLE_LEKY[role], text(b.kdo, 80)].filter(Boolean).join(' '), role };
}
device.get('/leky', h(async (req) => {
  const { tenant, zid, raw } = tokenZarizeni(req);
  omez('leky:' + zid, 120, 3600e3);
  return vTenantu(tenant, async (q) => {
    const z = await overZarizeni(q, zid, raw);
    const { nast, pd } = await lekyKontext(q, z, req.query);
    return { leky: (await lekyPd(nast, pd)).leky };
  });
}));
const lekZTelefonu = (akce) => h(async (req) => {
  const { tenant, zid, raw } = tokenZarizeni(req);
  omez('lekyz:' + zid, 60, 3600e3);
  const b = req.body || {};
  return vTenantu(tenant, async (q) => {
    const z = await overZarizeni(q, zid, raw);
    if (z.Stav !== 'SPAROVANO') throw chyba('Telefon není spárovaný', 401);
    const { nast, pd, kdo, role } = await lekyKontext(q, z, b);
    let r, detail;
    if (akce === 'uloz') {
      const lek = { id: b.id ? String(b.id) : undefined, typ: text(b.typ, 15), nazev: text(b.nazev, 200), davka: text(b.davka, 200), instr: text(b.instr, 500), popis: text(b.popis, 300) };
      if (!lek.nazev) throw chyba('Vyplňte název léku');
      r = await ulozLekPd(nast, pd, lek, kdo);
      detail = `${lek.id ? 'upraven' : 'přidán'} ${lek.typ === 'ZACHRANNA' ? 'SOS lék' : 'lék'} ${lek.nazev}${lek.davka ? ' ' + lek.davka : ''}`;
    } else {
      if (!b.id) throw chyba('Chybí lék');
      r = await smazLekPd(nast, pd, b.id, kdo);
      detail = `vyřazen lék ${text(b.nazev, 200) || '#' + b.id}`;
    }
    try { await synchronizujPacienta(q, nast, z.PacientID, pd); } catch (e) { /* doběhne automaticky */ }
    await zapisDenik(q, { pacientId: z.PacientID, typ: 'Úprava léků', text: `Léky (PéčeDoma, z telefonu): ${detail}.`, autor: text(b.kdo, 150) || kdo, role, zarizeniId: zid, overeno: false });
    await audit(q, { zarizeniId: zid, kdo: 'telefon', pacientId: z.PacientID, akce: 'PéčeDoma: úprava léků z telefonu', detail: `${kdo}: ${detail}`, ip: ip(req) });
    return { leky: r.leky };
  });
});
device.post('/leky', lekZTelefonu('uloz'));
device.post('/leky/smaz', lekZTelefonu('smaz'));

device.get('/pecedoma/zpravy', h(async (req) => {
  const { tenant, zid, raw } = tokenZarizeni(req);
  omez('pdchat:' + zid, 120, 3600e3);
  return vTenantu(tenant, async (q) => {
    const z = await overZarizeni(q, zid, raw);
    const { nast, pd } = await chatKontext(q, z);
    const r = await zpravyPd(nast, pd);
    await audit(q, { zarizeniId: zid, kdo: z.Rezim === 'PACIENT' ? 'telefon pacienta' : 'telefon', pacientId: z.PacientID, akce: 'PéčeDoma: chat zobrazen', detail: text(req.query.kdo, 100) || null, ip: ip(req) });
    return { zpravy: r.zpravy };
  });
}));
device.post('/pecedoma/zprava', h(async (req) => {
  const { tenant, zid, raw } = tokenZarizeni(req);
  omez('pdzprava:' + zid, 60, 3600e3);
  const b = req.body || {};
  return vTenantu(tenant, async (q) => {
    const z = await overZarizeni(q, zid, raw);
    const { nast, pd, stav } = await chatKontext(q, z);
    if (stav !== 'AKTIVNI') throw chyba('Průkaz je uzavřený', 403);
    const roleTel = String(b.role || '').toLowerCase();
    if (z.Rezim !== 'PACIENT' && (roleTel === 'lekar' || roleTel === 'pl')) throw chyba('Lékař zprávy z telefonu neodesílá – odpovězte z portálu PéčeDoma nebo z centrály Karty (zpráva pak jde za Tým PéčeDoma)', 403);   // 0.11.35
    const kdo = z.Rezim === 'PACIENT' ? 'pacient' : [ROLE_CHAT[roleTel] || '', text(b.kdo, 80)].filter(Boolean).join(' ') || 'telefon u pacienta';
    const r = await posliZpravuPd(nast, pd, { text: text(b.text, 4000), smer: 'OD_PACIENTA', kdo });
    await audit(q, { zarizeniId: zid, kdo: z.Rezim === 'PACIENT' ? 'telefon pacienta' : 'telefon', pacientId: z.PacientID, akce: 'PéčeDoma: zpráva odeslána', detail: kdo, ip: ip(req) });
    return { zpravy: r.zpravy };
  });
}));

device.post('/sdilet', h(async (req) => {
  const { tenant, zid, raw } = tokenZarizeni(req);
  const auto = !!req.body.auto;   // 0.11.26: automatický přenos přání, poznámek, otázek a podání léků po každé změně v telefonu (bez zápisu do deníku)
  omez('sdilet:' + zid, auto ? 240 : 30, 3600e3);
  const polozky = (Array.isArray(req.body.polozky) ? req.body.polozky : []).slice(0, 20).map((p) => ({
    druh: DRUHY_SDILENI[p.druh] ? p.druh : 'POZNAMKA',
    nazev: text(p.nazev, 150) || DRUHY_SDILENI[p.druh] || 'Poznámka pacienta',
    obsah: text(p.obsah, 8000),
    puvod: text(p.puvod, 200) || 'údaj pacienta',
    aktualizovano: /^\d{4}-\d{2}-\d{2}/.test(p.aktualizovano || '') ? String(p.aktualizovano).slice(0, 16) : null,
  })).filter((p) => p.obsah);
  if (!polozky.length) throw chyba('Vyberte, co chcete sdílet');
  return vTenantu(tenant, async (q) => {
    const z = await overZarizeni(q, zid, raw);
    if (z.Rezim !== 'PACIENT') throw chyba('Sdílení je jen v aplikaci Můj průkaz', 403);
    if (z.Stav !== 'SPAROVANO') throw chyba('Přístup k průkazu byl ukončen', 403);
    const pac = await q.one(`SELECT Stav FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: z.PacientID });
    if (pac.Stav !== 'AKTIVNI') throw chyba('Průkaz je uzavřený');
    await q.exec(`INSERT INTO dbo.A_KP_Sdileni (PacientID, ZarizeniID, Polozky) VALUES (@p, @z, @j)`, { p: z.PacientID, z: zid, j: JSON.stringify(polozky) });
    if (!auto) await zapisDenik(q, {
      pacientId: z.PacientID, typ: 'Sdíleno pacientem', role: 'pacient', autor: 'pacient (vlastní telefon)', zarizeniId: zid,
      text: `Pacient sdílel: ${polozky.map((p) => p.nazev).join(', ')}. Údaje pacienta – celé znění v záložce Karta, oddíl Od pacienta.`,
    });
    await audit(q, { zarizeniId: zid, kdo: 'telefon pacienta', pacientId: z.PacientID, akce: auto ? 'záznamy pacienta přeneseny automaticky' : 'pacient sdílel údaje', detail: polozky.map((p) => p.nazev).join(', '), ip: ip(req) });
    // 0.11.28: přání, poznámky a otázky jdou u propojeného pacienta i do PéčeDoma (Data klienta → Z Karty pacienta); selhání sdílení v Kartě nezastaví
    let pecedoma = false;
    const proPd = polozky.filter((p) => DRUHY_PRO_PD.includes(p.druh));
    if (proPd.length) {
      const pac2 = await q.one(`SELECT LOWER(CONVERT(char(36), PdKlientID)) AS pd FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: z.PacientID });
      const nast = pac2 && pac2.pd ? await nastaveniPd(q) : null;
      if (nast && nast.nastaveno) {
        try {
          const r = await zaznamyPd(nast, pac2.pd, proPd);
          pecedoma = true;
          if (r.ulozeno) await audit(q, { zarizeniId: zid, kdo: 'telefon pacienta', pacientId: z.PacientID, akce: 'PéčeDoma: záznamy pacienta předány', detail: `${r.ulozeno}× (${proPd.map((p) => p.nazev).join(', ')})`, ip: ip(req) });
        } catch (e) {
          await audit(q, { zarizeniId: zid, kdo: 'telefon pacienta', pacientId: z.PacientID, akce: 'PéčeDoma: předání záznamů selhalo', detail: String(e && e.message || e).slice(0, 300), ip: ip(req) });
        }
      }
    }
    return { ok: true, cas: new Date().toISOString(), pecedoma };
  });
}));

/* ---------------- videohovor (0.11.45) ----------------
   GET  /video                     → { server, hovor }   telefon se ptá každých ~20 s (zvonění z centrály); server = adresa Jitsi nebo null
   POST /video { akce, role, jmeno, id }  akce: zahajit (po odemknutí PINem – rodina i tým) | prijmout | ukoncit
   Odkaz do místnosti se telefonu posílá hotový (odkazDoHovoru), obsah hovoru přes server Karty nejde. */
const ROLE_VIDEO = ['rodina', 'sestra', 'hospic', 'pl', 'lekar'];
const JMENO_TELEFONU = (role, jmeno) => [ROLE_CHAT[role] || role || '', jmeno || ''].filter(Boolean).join(' ') || 'Telefon u pacienta';
function odpovedVideo(hovor, jmeno) {
  return { server: videoServer() || null, hovor: hovor ? { ...hovor, odkaz: odkazDoHovoru(hovor.mistnost, jmeno) } : null };
}
device.get('/video', h(async (req) => {
  const { tenant, zid, raw } = tokenZarizeni(req);
  omez('video:' + zid, 600, 3600e3);
  return vTenantu(tenant, async (q) => {
    const z = await overZarizeni(q, zid, raw);
    if (z.Rezim !== 'ZAPUJCENY' || z.Stav !== 'SPAROVANO' || !videoServer()) return { server: null, hovor: null };
    return odpovedVideo(await aktivniHovor(q, z.PacientID), 'Telefon u pacienta');
  });
}));
device.post('/video', h(async (req) => {
  const { tenant, zid, raw } = tokenZarizeni(req);
  omez('video-akce:' + zid, 60, 3600e3);
  const b = req.body || {};
  const akce = String(b.akce || '');
  const role = String(b.role || '').toLowerCase();
  if (!videoServer()) throw chyba('Videohovory nejsou na serveru zapnuté (KP_JITSI_URL)');
  return vTenantu(tenant, async (q) => {
    const z = await overZarizeni(q, zid, raw);
    if (z.Rezim !== 'ZAPUJCENY') throw chyba('Videohovor je jen na telefonu u pacienta (karta týmu)', 403);
    if (z.Stav !== 'SPAROVANO') throw chyba('Telefon není spárovaný', 401);
    const pac = await q.one(`SELECT Stav, KodPrukazu FROM dbo.A_KP_Pacient WHERE PacientID = @p`, { p: z.PacientID });
    if (!pac || pac.Stav !== 'AKTIVNI') throw chyba('Průkaz je uzavřený');
    const jmeno = JMENO_TELEFONU(role, text(b.jmeno, 100));
    const id = Number(b.id) || null;
    if (akce === 'zahajit') {
      if (!ROLE_VIDEO.includes(role)) throw chyba('Videohovor zahájí jen rodina nebo člen týmu po odemknutí PINem', 403);
      const hovor = await zahajHovor(q, { pacientId: z.PacientID, kodPrukazu: pac.KodPrukazu, zahajil: 'TELEFON', jmeno, role, zarizeniId: zid });
      await audit(q, { zarizeniId: zid, kdo: jmeno, pacientId: z.PacientID, akce: hovor.novy ? 'videohovor zahájen z telefonu' : 'připojení k videohovoru', detail: hovor.mistnost, ip: ip(req) });
      return odpovedVideo(hovor, jmeno);
    }
    if (akce === 'prijmout') {
      if (!id) throw chyba('Chybí hovor');
      const hovor = await prijmiHovor(q, z.PacientID, id);
      await audit(q, { zarizeniId: zid, kdo: jmeno, pacientId: z.PacientID, akce: 'videohovor přijat na telefonu', detail: hovor ? hovor.mistnost : String(id), ip: ip(req) });
      return odpovedVideo(hovor, jmeno);
    }
    if (akce === 'ukoncit') {
      if (!id) throw chyba('Chybí hovor');
      return odpovedVideo(await ukonciHovor(q, z.PacientID, id, { jmeno, role: ROLE_VIDEO.includes(role) ? role : null, zarizeniId: zid }), jmeno);
    }
    throw chyba('Neznámá akce');
  });
}));
