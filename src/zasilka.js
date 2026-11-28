/**
 * Zpráva do Průkazu (0.11.148) – jednorázová zásilka z malé webové aplikace „Zpráva do Průkazu“ (nastroje/zprava-do-prukazu)
 * do aplikace Průkaz pacienta. Bez přihlášení a bez vazby na Kartu pacienta (žádný tenant, žádná databáze).
 *
 * Aplikace vytvoří náhodný kód (12 znaků, např. 7K3M-Q9TX-2HDR) a z něj v prohlížeči odvodí (HKDF-SHA-256) dvě věci:
 * číslo zásilky (id, 64 hex) a klíč AES-GCM. Údaje zašifruje a pošle sem jen id a šifru – kód ani klíč server nikdy nedostane,
 * obsah tedy přečíst neumí. Průkaz pacienta z kódu (QR nebo opsaný) spočítá totéž id a klíč, šifru si jednou vyzvedne
 * a rozšifruje až v telefonu. Šifra je jen v paměti serveru, nejvýš 30 minut, vydá se jednou a smaže se.
 */
import { chyba } from './http.js';

export const ZASILKA_PLATNOST_MS = 30 * 60e3;
export const ZASILKA_MAX_ZNAKU = 9 * 1024 * 1024;   // base64 šifry (zpráva PDF / fotka do ~6,5 MB + údaje)
export const ZASILKA_ID_RE = /^[0-9a-f]{64}$/;
const MAX_CEKAJICICH = 300;

const zasilky = new Map();   // id → { sifra, do }

function uklid(ted = Date.now()) { for (const [k, v] of zasilky) if (v.do <= ted) zasilky.delete(k); }
setInterval(() => uklid(), 60e3).unref();

/** Uloží šifru na 30 minut; vrací { platnostDo, velikost }. */
export function zalozZasilku({ id, sifra }, ted = Date.now()) {
  uklid(ted);
  if (!ZASILKA_ID_RE.test(String(id || ''))) throw chyba('Neplatné číslo zásilky');
  if (typeof sifra !== 'string' || sifra.length < 40 || !/^[A-Za-z0-9+/]+=*$/.test(sifra)) throw chyba('Chybí zašifrovaná zpráva');
  if (sifra.length > ZASILKA_MAX_ZNAKU) throw chyba('Zpráva je příliš velká – zmenšete přílohu (nejvýš asi 6 MB)');
  if (zasilky.has(id)) throw chyba('Kód už se používá – vytvořte prosím nový');
  if (zasilky.size >= MAX_CEKAJICICH) throw chyba('Na serveru čeká příliš mnoho zpráv – zkuste to prosím za chvíli', 503);
  zasilky.set(id, { sifra, do: ted + ZASILKA_PLATNOST_MS });
  return { platnostDo: new Date(ted + ZASILKA_PLATNOST_MS).toISOString(), velikost: Math.round(sifra.length * 3 / 4) };
}

/** Vydá šifru jen jednou (pak ji smaže); null = neexistuje, vypršela nebo už je vyzvednutá. */
export function vyzvedniZasilku(id, ted = Date.now()) {
  uklid(ted);
  const z = zasilky.get(id);
  if (!z) return null;
  zasilky.delete(id);
  return z;
}

/** Zrušení z aplikace (Další zpráva) – id zná jen ten, kdo zná kód. */
export function zrusZasilku(id) { return zasilky.delete(id); }

/** Čeká ještě zásilka na vyzvednutí? (aplikace ukáže, že si ji pacient už vzal) */
export function cekaZasilka(id, ted = Date.now()) {
  const z = zasilky.get(id);
  return !!(z && z.do > ted);
}
