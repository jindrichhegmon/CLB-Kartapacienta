/**
 * Kryptografie: hesla (scrypt), podepsané session (HMAC), šifrování tajemství (AES-256-GCM),
 * tokeny zařízení, PINy (PBKDF2 – ověřuje je i telefon offline přes WebCrypto) a kód lékaře (kód dne – HMAC z data).
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, pbkdf2, pbkdf2Sync, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

const klic = (ucel) => createHash('sha256').update(`kp:${ucel}:${config.secret}`).digest();

/* ---------- hesla ---------- */
export function hashHeslo(heslo) {
  const salt = randomBytes(16);
  const h = scryptSync(String(heslo), salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64url')}$${h.toString('base64url')}`;
}
export function overHeslo(heslo, ulozene) {
  const [alg, s, h] = String(ulozene || '').split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const a = scryptSync(String(heslo), Buffer.from(s, 'base64url'), 32, { N: 16384, r: 8, p: 1 });
  const b = Buffer.from(h, 'base64url');
  return a.length === b.length && timingSafeEqual(a, b);
}
const SLOVA = ['lipa', 'javor', 'buk', 'jasan', 'modrin', 'olse', 'vrba', 'habr', 'dub', 'smrk', 'tis', 'jedle', 'trnka', 'sipek', 'hloh', 'bez', 'jerab', 'ořech'.normalize('NFD').replace(/[̀-ͯ]/g, ''), 'kalina', 'zimolez'];
export function generujHeslo() {
  const s = () => SLOVA[randomInt(SLOVA.length)];
  return `${s()}-${s()}-${s()}-${randomInt(10, 100)}`;
}

/* ---------- session: base64url(json).hmac ---------- */
export function podepis(data, ttlSekund) {
  const telo = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSekund })).toString('base64url');
  const sig = createHmac('sha256', klic('session')).update(telo).digest('base64url');
  return `${telo}.${sig}`;
}
export function overSession(token) {
  const [telo, sig] = String(token || '').split('.');
  if (!telo || !sig) return null;
  const ocek = createHmac('sha256', klic('session')).update(telo).digest();
  const dano = Buffer.from(sig, 'base64url');
  if (ocek.length !== dano.length || !timingSafeEqual(ocek, dano)) return null;
  try {
    const d = JSON.parse(Buffer.from(telo, 'base64url').toString('utf8'));
    if (!d.exp || d.exp < Date.now() / 1000) return null;
    return d;
  } catch { return null; }
}

/* ---------- šifrování (tajemství zařízení, první hesla) ---------- */
export function zasifruj(text) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', klic('sifra'), iv);
  const data = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return `gcm$${iv.toString('base64url')}$${c.getAuthTag().toString('base64url')}$${data.toString('base64url')}`;
}
export function desifruj(ulozene) {
  try {
    const [alg, iv, tag, data] = String(ulozene || '').split('$');
    if (alg !== 'gcm') return '';
    const d = createDecipheriv('aes-256-gcm', klic('sifra'), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
  } catch { return ''; }
}

/* ---------- tokeny ---------- */
export const nahodny = (bajtu = 32) => randomBytes(bajtu).toString('base64url');
export const sha256 = (t) => createHash('sha256').update(String(t)).digest('hex');
/** Párovací kód: 8 znaků bez zaměnitelných (0/O, 1/I/L). */
export function parovaciKod() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 8; i++) s += abc[randomInt(abc.length)];
  return s;
}

/* ---------- PIN (PBKDF2-SHA256, stejný výpočet v telefonu přes WebCrypto) ---------- */
export const PIN_ITERACE = 120000;
export function hashPin(pin, saltHex, iterace = PIN_ITERACE) {
  return pbkdf2Sync(String(pin), Buffer.from(saltHex, 'hex'), iterace, 32, 'sha256').toString('hex');
}
/** totéž jako novyPin(), ale PBKDF2 neblokuje server (hromadný import lidí) */
export async function novyPinAsync() {
  const pin = String(randomInt(0, 1000000)).padStart(6, '0');
  const salt = randomBytes(16).toString('hex');
  const hash = await new Promise((ok, chyba) => pbkdf2(pin, Buffer.from(salt, 'hex'), PIN_ITERACE, 32, 'sha256', (e, k) => (e ? chyba(e) : ok(k.toString('hex')))));
  return { pin, salt, hash, iterace: PIN_ITERACE };
}
export function novyPin() {
  const pin = String(randomInt(0, 1000000)).padStart(6, '0');
  const salt = randomBytes(16).toString('hex');
  return { pin, salt, hash: hashPin(pin, salt), iterace: PIN_ITERACE };
}

/* ---------- kód lékaře = kód dne: HMAC-SHA256(tajemství telefonu, "kod-dne:RRRR-MM-DD"), 6 číslic ----------
   Celý kalendářní den (Europe/Prague) stejný, takže si ho lékař najde i v PéčeDoma; telefon ho ověří offline
   stejným výpočtem (WebCrypto) a kolem půlnoci přijme i kód předchozího dne. */
export const dnesPraha = (cas = Date.now()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(cas));
export function kodDne(tajemstviHex, datum = dnesPraha()) {
  const h = createHmac('sha256', Buffer.from(tajemstviHex, 'hex')).update('kod-dne:' + datum).digest();
  const n = ((h[0] & 0x7f) << 24) | (h[1] << 16) | (h[2] << 8) | h[3];
  return String(n % 1000000).padStart(6, '0');
}
/** Konec dnešního dne v Praze (ISO) – do kdy kód dne platí. */
export function konecDnePraha(cas = Date.now()) {
  const d = dnesPraha(cas);
  // půlnoc následujícího dne: zkusíme obě možnosti posunu (letní/zimní čas)
  for (const posun of ['+02:00', '+01:00']) { const t = new Date(`${d}T24:00:00${posun}`); if (dnesPraha(t.getTime() - 1000) === d && dnesPraha(t.getTime()) !== d) return t.toISOString(); }
  return new Date(`${d}T23:59:59+01:00`).toISOString();
}
