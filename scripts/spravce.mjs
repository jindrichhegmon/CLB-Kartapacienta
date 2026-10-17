/**
 * Založí správce (admin + lékař) v tenantovi podle IČO, nebo mu vygeneruje nové heslo, když už existuje.
 *   node scripts/spravce.mjs <IČO> <login> "<Jméno a příjmení>"
 * Spouští se na VPS (čte KP_ADMIN_HESLO z .env); heslo vypíše jen jednou.
 */
import 'dotenv/config';
const [ico, login, jmeno] = process.argv.slice(2);
if (!ico || !login || !jmeno) { console.log('použití: node scripts/spravce.mjs <IČO> <login> "<Jméno>"'); process.exit(1); }
const BASE = process.env.BASE || `http://127.0.0.1:${process.env.PORT || 3120}`;
const api = async (p, body, token) => { const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }); const d = await r.json(); if (!d.ok) throw new Error(d.chyba); return d; };
const get = async (p, token) => (await fetch(BASE + p, { headers: { authorization: 'Bearer ' + token } })).json();
const adm = (await api('/api/admin/login', { heslo: process.env.KP_ADMIN_HESLO })).session;
const t = (await get('/api/admin/tenanti', adm)).tenanti.find((x) => x.ico === ico.padStart(8, '0'));
if (!t) throw new Error('Tenant s IČO ' + ico + ' neexistuje – založte ho v /tenanti/');
const u = (await api('/api/admin/spravci', { tenant: t.id }, adm)).uzivatele.find((x) => x.login === login);
const heslo = u ? (await api('/api/admin/reset-hesla', { tenant: t.id, uzivatelId: u.id }, adm)).heslo
  : (await api('/api/admin/zalozit', { ico, typ: 'AMBULANCE', spravceJmeno: jmeno, spravceLogin: login, spravceLekar: true, pridatSpravce: true }, adm)).heslo;
console.log(`${u ? 'Nové heslo' : 'Založen'}: ${t.odkaz}  login ${login}  heslo ${heslo}`);
