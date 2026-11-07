/**
 * Hromadný přenos průkazů ze starého telefonu (A) na nový (B) – „výměna telefonu“ (0.11.95, převzato z úkolu Velína #2).
 *
 *   A: POST /api/d/prenos/zahajit  { tokeny:[…], role, kdo } → { kod, odkaz }   (tým odemčený PINem; A ukáže QR kód s odkazem)
 *   B: POST /api/d/prenos/nahled   { kod }                   → { pocet, telefon } (kolik průkazů a číslo starého telefonu – kód se nespotřebuje)
 *   B: POST /api/d/prenos/prevzit  { kod, telefon }          → { karty:[…] }      (B naskenuje QR, dostane nové tokeny; jiné číslo → změní se
 *                                                                                   i číslo telefonu s kartou u pacientů a u týmů)
 *   A: POST /api/d/prenos/stav     { kod }                   → { stav }           (A zjistí, že je hotovo, a vymaže se)
 *
 * Od 0.11.96 jde výměnu připravit i v centrální aplikaci (POST /api/c/telefon/vymena): kód vydá přihlášený garant nebo lékař pro
 * všechny průkazy na čísle starého telefonu, QR ukáže centrála (platí 30 min) a v kódu je i číslo nového telefonu (novyTelefon) –
 * nový telefon musí mít právě toto číslo. Starý telefon se po převzetí zablokuje (při připojení se vymaže).
 *
 * Přenosový kód je jednorázový a platí 10 minut. Drží se jen v paměti serveru (běží jedna instance
 * v pm2) – po restartu stačí na starém telefonu vygenerovat nový. V kódu nejsou žádná data pacienta,
 * jen odkaz na zařízení; nový telefon dostane vlastní tokeny a starý se zablokuje (při připojení se vymaže).
 */
import { randomInt } from 'node:crypto';

export const PRENOS_PLATNOST_MS = 10 * 60 * 1000;
const HOTOVO_DRZET_MS = 30 * 60 * 1000;
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez zaměnitelných znaků (0/O, 1/I/L)
export const PRENOS_KOD_RE = /^[A-HJKMNP-Z2-9]{12}$/;

const cekajici = new Map(); // kod → { exp, karty:[{ tenant, zarizeniId, tokenHash }] }
const hotove = new Map();   // kod → { cas, stav:'prevzato', pocet }

export function novyKodPrenosu() {
  let s = '';
  for (let i = 0; i < 12; i++) s += ABC[randomInt(ABC.length)];
  return s;
}

/** Normalizace kódu zadaného ručně („ABCD-EFGH-JKLM“, malá písmena…). */
export const normalizujKod = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Formát pro zobrazení: ABCD-EFGH-JKLM */
export const formatujKod = (k) => String(k).replace(/(.{4})(?=.)/g, '$1-');

export function zalozPrenos(karty, nyni = Date.now(), { platnostMs = PRENOS_PLATNOST_MS, novyTelefon = '', zdroj = 'telefon' } = {}) {
  if (!Array.isArray(karty) || !karty.length) throw new Error('Žádné průkazy k přenosu');
  // jedno zařízení smí mít jen jeden čekající přenos – starší kód se zruší
  const zid = new Set(karty.map((k) => `${k.tenant}.${k.zarizeniId}`));
  for (const [kod, p] of cekajici) if (p.karty.some((k) => zid.has(`${k.tenant}.${k.zarizeniId}`))) cekajici.delete(kod);
  let kod;
  do kod = novyKodPrenosu(); while (cekajici.has(kod) || hotove.has(kod));
  cekajici.set(kod, { exp: nyni + platnostMs, karty: karty.map((k) => ({ ...k })), novyTelefon, zdroj });
  return { kod, platnost: new Date(nyni + platnostMs) };
}

/** Náhled bez spotřebování kódu (nový telefon předvyplní číslo starého telefonu). */
export function nahledPrenosu(kod, nyni = Date.now()) {
  const p = cekajici.get(kod);
  return p && p.exp >= nyni ? p : null;
}

/** Jednorázové vyzvednutí: vrátí přenos a hned ho odebere (podruhé už vrátí null). */
export function vezmiPrenos(kod, nyni = Date.now()) {
  const p = cekajici.get(kod);
  if (!p) return null;
  cekajici.delete(kod);
  if (p.exp < nyni) return null;
  return p;
}

/** Zrušení ze starého telefonu (tlačítko Zrušit) – kód přestane platit hned. */
export function zrusPrenos(kod) { return cekajici.delete(kod); }

export function dokonciPrenos(kod, pocet, nyni = Date.now()) {
  hotove.set(kod, { cas: nyni, stav: 'prevzato', pocet });
}

export function stavPrenosu(kod, nyni = Date.now()) {
  const h = hotove.get(kod);
  if (h) return { stav: h.stav, pocet: h.pocet };
  const p = cekajici.get(kod);
  if (p && p.exp >= nyni) return { stav: 'ceka', zbyva: Math.round((p.exp - nyni) / 1000) };
  return { stav: 'neplatny' };
}

export function uklidPrenosy(nyni = Date.now()) {
  for (const [k, p] of cekajici) if (p.exp < nyni) cekajici.delete(k);
  for (const [k, h] of hotove) if (nyni - h.cas > HOTOVO_DRZET_MS) hotove.delete(k);
}
setInterval(() => uklidPrenosy(), 60 * 1000).unref();
