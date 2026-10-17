/**
 * Kontrola celé cesty proti běžícímu serveru (spouští se na VPS, kde je dostupná DB):
 *   BASE=http://127.0.0.1:3120 KP_ADMIN_HESLO=… ICO=75187868 node scripts/e2e.mjs
 * Zapne kartu pacienta pro tenanta s daným IČO (existující tenant se použije), založí pacienta
 * přes anonymní rozbor zprávy, spáruje „telefon“, pošle zápis z fronty, ověří PIN a kód lékaře,
 * předání garance, izolaci tenantů (RLS) a zablokování telefonu.
 */
import { pbkdf2Sync, createHmac } from 'node:crypto';
import 'dotenv/config';

const BASE = process.env.BASE || 'http://127.0.0.1:3120';
const ICO = process.env.ICO || '75187868';
let ok = 0;
const krok = (t) => { ok++; console.log(`✓ ${t}`); };
async function api(path, { method = 'GET', body, token, typ = 'Bearer' } = {}) {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `${typ} ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok === false) throw Object.assign(new Error(`${path}: ${r.status} ${d.chyba || ''}`), { status: r.status, d });
  return d;
}
const ocekavejChybu = async (fn, status, t) => { try { await fn(); } catch (e) { if (!status || e.status === status) return krok(t); throw e; } throw new Error('Očekávána chyba: ' + t); };

const h = await api('/api/health'); if (!h.ok) throw new Error('health'); krok(`server ${h.verze}, databáze ${h.db}`);
const adm = (await api('/api/admin/login', { method: 'POST', body: { heslo: process.env.KP_ADMIN_HESLO } })).session; krok('přihlášení do správy tenantů');
const tenanti = (await api('/api/admin/tenanti', { token: adm })).tenanti;
let t = tenanti.find((x) => x.ico === ICO);
// test používá VLASTNÍ účet e2e.test – nikdy nemění hesla účtů, kterými se přihlašují lidé
const login = 'e2e.test'; let heslo;
if (!t || !t.uzivatelu) {
  const z = await api('/api/admin/zalozit', { method: 'POST', token: adm, body: { ico: ICO, typ: 'AMBULANCE', telefon24: '777 000 001', nazevSite: 'Testovací síť karty pacienta', spravceJmeno: 'Automatický test', spravceLogin: login, spravceLekar: true, demo: true } });
  heslo = z.heslo; t = { id: z.tenant }; krok(`tenant ${z.tenant} ${z.novyTenant ? 'založen' : 'existoval'}, karta zapnuta, ukázková data`);
} else {
  const sp = (await api('/api/admin/spravci', { method: 'POST', token: adm, body: { tenant: t.id } })).uzivatele;
  const u = sp.find((x) => x.login === login);
  if (u) heslo = (await api('/api/admin/reset-hesla', { method: 'POST', token: adm, body: { tenant: t.id, uzivatelId: u.id } })).heslo;
  else heslo = (await api('/api/admin/zalozit', { method: 'POST', token: adm, body: { ico: ICO, typ: 'AMBULANCE', spravceJmeno: 'Automatický test', spravceLogin: login, spravceLekar: true, pridatSpravce: true } })).heslo;
  krok(`tenant ${t.id} existuje, testovací účet ${login} připraven`);
}
const ses = (await api('/api/c/login', { method: 'POST', body: { tenant: t.id, login, heslo } })).session; krok('přihlášení do centrální aplikace');
const ja = await api('/api/c/ja', { token: ses }); krok(`uživatel ${ja.ja.jmeno} (${ja.ja.role}), AI ${ja.ai ? 'zapnuta' : 'lokální'}`);
await ocekavejChybu(() => api('/api/c/login', { method: 'POST', body: { tenant: '02570459DSIDEQAJ', login, heslo } }), 403, 'cizí tenant bez karty pacienta přihlášení odmítne');

const zprava = `KRAJSKÁ NEMOCNICE – Interní oddělení\nPacient: Karel SVOBODA, nar. 1947, muž\nRČ 470312/1234\nPropuštěn do: Domov pro seniory Burešov\nDiagnózy:\nI50.0 Chronické srdeční selhání\n\nAlergie: sulfonamidy\nPrůběh: pacient si nepřeje resuscitaci ani napojení na ventilátor, další hospitalizaci jen při nezvládnutelných obtížích.\nFunkční stav: chodí s chodítkem.\nSOS medikace: morfin 5 mg s.c. při dušnosti, midazolam 2,5 mg s.c. při neklidu\nKontakt rodina: syn Martin Svoboda, tel. 604 000 000\nMUDr. Jana Veselá`;
const ai = await api('/api/c/ai/rozbor', { method: 'POST', token: ses, body: { text: zprava } });
if (ai.blokovano) throw new Error('AI blokováno: ' + ai.duvod);
for (const z of ['SVOBODA', 'Svoboda', '470312', '604 000 000', 'Veselá']) if (ai.anonymniText.includes(z)) throw new Error('Do AI by odešlo: ' + z);
krok(`anonymní rozbor (${ai.zdroj}${ai.model ? ' ' + ai.model : ''}): ${ai.pocetNahrad} údajů nahrazeno, limity ${ai.vysledek.limity.join(', ')}`);

const posk = (await api('/api/c/poskytovatele', { token: ses })).poskytovatele;
const hospic = posk.find((p) => p.typ === 'HOSPIC'); const domov = posk.find((p) => p.typ === 'DOMOV');
const novy = await api('/api/c/pacient', { method: 'POST', token: ses, body: {
  pacient: { jmeno: 'Karel', prijmeni: 'Testovací', rok: 1947, pohlavi: 'muž', pobyt: 'Domov pro seniory, pokoj 3' },
  plan: { ...ai.vysledek, doklad: { dvp: false, zprava: 'Krajská nemocnice, propouštěcí zpráva' } }, kontakty: ai.vysledek.kontakty, tym: [hospic && hospic.id, domov && domov.id].filter(Boolean), aiPouzito: true } });
krok(`pacient založen ${novy.kod}`);
const pid = novy.id;
await api(`/api/c/pacient/${pid}/plan`, { method: 'POST', token: ses, body: { typ: 'REVIZE', platnostDo: '2027-01-31', poznamka: 'test' } }); krok('revize plánu → verze 2');
const pin = (await api(`/api/c/pacient/${pid}/pin`, { method: 'POST', token: ses, body: { jmeno: 'Jana (dcera)', role: 'RODINA' } })).pin; krok('PIN vydán');
const par = await api(`/api/c/pacient/${pid}/parovat`, { method: 'POST', token: ses, body: { stitek: 'test-telefon' } }); krok(`párovací kód ${par.kod}`);
const tel = await api('/api/d/parovat', { method: 'POST', body: { tenant: par.tenant, kod: par.kod } }); krok(`telefon spárován, balík: ${tel.balik.pacient.kod}, plán v${tel.balik.plan.verze}, ${tel.balik.piny.length} PIN`);
await ocekavejChybu(() => api('/api/d/parovat', { method: 'POST', body: { tenant: par.tenant, kod: par.kod } }), 404, 'párovací kód nejde použít podruhé');
const p0 = tel.balik.piny[0];
if (pbkdf2Sync(pin, Buffer.from(p0.salt, 'hex'), p0.iterace, 32, 'sha256').toString('hex') !== p0.hash) throw new Error('PIN nesedí'); krok('PIN ověřitelný offline (PBKDF2)');
const uuid = crypto.randomUUID();
const s1 = await api('/api/d/sync', { method: 'POST', token: tel.token, typ: 'Device', body: { fronta: [{ uuid, typ: 'Podán SOS lék', text: 'Dušnost, morfin 5 mg s.c. (zapsáno bez signálu)', role: 'rodina', autor: 'Jana (dcera)', cas: new Date(Date.now() - 3600e3).toISOString(), overeno: true }, { uuid: crypto.randomUUID(), typ: 'Revize', text: 'pokus změnit plán z telefonu', role: 'rodina', autor: 'x' }], baterie: 64, verzeAplikace: 'e2e' } });
if (!s1.potvrzeno.includes(uuid) || s1.odmitnuto.length !== 1) throw new Error('sync'); krok('sync: zápis z fronty přijat, nepovolený typ odmítnut');
const s2 = await api('/api/d/sync', { method: 'POST', token: tel.token, typ: 'Device', body: { fronta: [{ uuid, typ: 'Podán SOS lék', text: 'duplicitní odeslání', role: 'rodina', autor: 'Jana' }] } });
if (s2.balik.denik.filter((e) => e.uuid === uuid).length !== 1) throw new Error('duplicita'); krok('opakované odeslání stejného UUID se nezdvojí');
const kl = await api(`/api/c/pacient/${pid}/kod-lekare`, { token: ses });
const totp = (sec, c) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(c)); const hm = createHmac('sha1', Buffer.from(sec, 'hex')).update(b).digest(); const o = hm[19] & 15; return String((((hm[o] & 127) << 24) | (hm[o + 1] << 16) | (hm[o + 2] << 8) | hm[o + 3]) % 1e6).padStart(6, '0'); };
if (totp(tel.tajemstvi, Math.floor(Date.now() / 300000)) !== kl.kod) throw new Error('kód lékaře'); krok('kód lékaře z centrály ověřitelný na telefonu offline');
if (hospic) {
  await api(`/api/c/pacient/${pid}/predat`, { method: 'POST', token: ses, body: { poskytovatelId: hospic.id } });
  const d = await api(`/api/c/pacient/${pid}`, { token: ses });
  if (!d.garance.some((g) => g.stav === 'NAVRZENO')) throw new Error('předání'); krok('předání garance hospici navrženo (čeká na potvrzení)');
}
const prehled = await api('/api/c/prehled', { token: ses }); krok(`přehled: ${prehled.pacienti.length} pacientů, ${prehled.upozorneni.length} upozornění`);
await api(`/api/c/pacient/${pid}/uzavrit`, { method: 'POST', token: ses, body: { duvod: 'test – e2e' } }); krok('průkaz uzavřen');
const s3 = await api('/api/d/sync', { method: 'POST', token: tel.token, typ: 'Device', body: { fronta: [] } });
if (s3.prikaz !== 'smazat') throw new Error('smazat'); krok('telefon po uzavření dostal příkaz smazat data');
await ocekavejChybu(() => api('/api/d/sync', { method: 'POST', token: tel.token, typ: 'Device', body: {} }), 401, 'vymazaný telefon už nemá přístup');
await ocekavejChybu(() => api('/api/c/prehled', { token: ses.slice(0, -3) + 'abc' }), 401, 'podvržená session odmítnuta');
console.log(`\nVše v pořádku (${ok} kroků). Tenant ${t.id}. Hesla lidských účtů test neměnil.`);
