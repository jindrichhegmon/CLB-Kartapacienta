/**
 * Zpráva do Průkazu (0.11.148) – jednorázová zásilka z malé webové aplikace „Zpráva do Průkazu“ (nastroje/zprava-do-prukazu)
 * do aplikace Průkaz pacienta ve vlastním telefonu pacienta.
 *
 * Lékař nahraje zprávu, server ji přečte a rozebere (AI jen anonymizovaně – rozborZpravy), lékař údaje zkontroluje a prohlížeč
 * je ZAŠIFRUJE (AES-GCM, náhodný klíč). Server dostane jen šifru – klíč je jen v QR kódu, který pacient načte Průkazem.
 * Server tak obsah neumí přečíst; šifru drží jen v paměti, nejvýš 30 minut a vydá ji jen jednou (pak ji smaže).
 * Do databáze se nic neukládá, jen zápis do auditu (bez obsahu). Restart serveru čekající zásilky zahodí – lékař vytvoří nový QR kód.
 */
import { randomBytes } from 'node:crypto';
import { chyba } from './http.js';

export const ZASILKA_PLATNOST_MS = 30 * 60e3;
export const ZASILKA_MAX_ZNAKU = 9 * 1024 * 1024;   // base64 šifry (zpráva PDF / fotka do ~6,5 MB + údaje)
export const ZASILKA_ID_RE = /^[A-Za-z0-9_-]{16}$/;
const MAX_CEKAJICICH = 300;

const zasilky = new Map();   // id → { tenant, uzivatelId, sifra, do }

function uklid(ted = Date.now()) { for (const [k, v] of zasilky) if (v.do <= ted) zasilky.delete(k); }
setInterval(() => uklid(), 60e3).unref();

/** Uloží šifru na 30 minut; vrací { id, platnostDo, velikost }. */
export function zalozZasilku({ tenant, uzivatelId, sifra }, ted = Date.now()) {
  uklid(ted);
  if (typeof sifra !== 'string' || sifra.length < 40 || !/^[A-Za-z0-9+/]+=*$/.test(sifra)) throw chyba('Chybí zašifrovaná zpráva');
  if (sifra.length > ZASILKA_MAX_ZNAKU) throw chyba('Zpráva je příliš velká – zmenšete přílohu (nejvýš asi 6 MB)');
  if (zasilky.size >= MAX_CEKAJICICH) throw chyba('Na serveru čeká příliš mnoho zpráv – zkuste to prosím za chvíli', 503);
  let id; do { id = randomBytes(12).toString('base64url'); } while (zasilky.has(id));
  zasilky.set(id, { tenant, uzivatelId, sifra, do: ted + ZASILKA_PLATNOST_MS });
  return { id, platnostDo: new Date(ted + ZASILKA_PLATNOST_MS).toISOString(), velikost: Math.round(sifra.length * 3 / 4) };
}

/** Vydá šifru jen jednou (pak ji smaže); null = neexistuje, vypršela, už vyzvednutá nebo jiná organizace. */
export function vyzvedniZasilku(tenant, id, ted = Date.now()) {
  uklid(ted);
  const z = zasilky.get(id);
  if (!z || z.tenant !== tenant) return null;
  zasilky.delete(id);
  return z;
}

/** Lékař zásilku zrušil (Další pacient / Zrušit) – smí jen ten, kdo ji vytvořil. */
export function zrusZasilku(tenant, id, uzivatelId) {
  const z = zasilky.get(id);
  if (!z || z.tenant !== tenant || z.uzivatelId !== uzivatelId) return false;
  zasilky.delete(id);
  return true;
}

/** Čeká ještě zásilka na vyzvednutí? (aplikace lékaře ukáže, že si ji pacient už vzal) */
export function cekaZasilka(tenant, id, ted = Date.now()) {
  const z = zasilky.get(id);
  return !!(z && z.tenant === tenant && z.do > ted);
}
