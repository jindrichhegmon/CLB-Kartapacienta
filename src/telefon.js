/**
 * Číslo telefonu s kartou a SMS s odkazem na spárování.
 * Karta pacienta je jen v jednom telefonu: u pacienta je uvedené jeho číslo (A_KP_Pacient.TelefonKarty) a telefon se spáruje
 * jen tehdy, když při párování zadá stejné číslo; odkaz na spárování může přijít SMS právě na toto číslo (Twilio, bez Make).
 */
import { config } from './config.js';

/** '+420 777 123 456', '777123456', '00420777123456' → '+420777123456'; jiné mezinárodní +XX…; neplatné → '' */
export function normTel(v) {
  let s = String(v ?? '').trim().replace(/[\s().\-/]/g, '');
  if (!s) return '';
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (/^\d{9}$/.test(s)) s = '+420' + s;
  if (/^420\d{9}$/.test(s)) s = '+' + s;
  if (s.startsWith('+420')) return /^\+420\d{9}$/.test(s) ? s : '';   // české číslo má vždy 9 číslic
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : '';
}

/** '+420777123456' → '+420 777 123 456' (pro zobrazení) */
export function hezkyTel(t) {
  const m = String(t || '').match(/^\+420(\d{3})(\d{3})(\d{3})$/);
  return m ? `+420 ${m[1]} ${m[2]} ${m[3]}` : String(t || '');
}

export const smsDostupne = () => !!(config.sms.from && config.sms.ucet && ((config.sms.token) || (config.sms.klic && config.sms.tajemstvi)));

/** SMS přes Twilio REST API; vrací SID zprávy, při chybě vyhodí výjimku s důvodem */
export async function posliSms(telefon, text) {
  if (!smsDostupne()) throw Object.assign(new Error('Odesílání SMS není na serveru nastavené (TWILIO_* v .env)'), { status: 503 });
  const to = normTel(telefon);
  if (!to) throw Object.assign(new Error('Neplatné číslo telefonu'), { status: 400 });
  const { ucet, token, klic, tajemstvi, from } = config.sms;
  const auth = Buffer.from(klic && tajemstvi ? `${klic}:${tajemstvi}` : `${ucet}:${token}`).toString('base64');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(ucet)}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: String(text).slice(0, 1000) }),
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('SMS se nepodařilo odeslat: ' + (d.message || r.status)), { status: 502 });
  return d.sid || '';
}
