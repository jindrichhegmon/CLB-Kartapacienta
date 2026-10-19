import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
process.env.KP_SECRET = 'x'.repeat(40);
const { totp, hashPin, novyPin, hashHeslo, overHeslo, podepis, overSession, zasifruj, desifruj } = await import('../src/crypto.js');
const { anonymizuj, obnov } = await import('../src/anonym.js');
const { lokalniRozbor } = await import('../src/ai.js');
const { navrhniIdTenanta } = await import('../src/routes/admin.js');

test('TOTP odpovídá RFC 6238 (SHA1, krok 30 s)', () => {
  const secret = Buffer.from('12345678901234567890').toString('hex');
  assert.equal(totp(secret, 59 * 1000, 30), '287082');
  assert.equal(totp(secret, 1111111109 * 1000, 30), '081804');
});

test('PIN: hash je deterministický a ověřitelný', () => {
  const n = novyPin();
  assert.match(n.pin, /^\d{6}$/);
  assert.equal(hashPin(n.pin, n.salt, n.iterace), n.hash);
  assert.notEqual(hashPin('000000', n.salt, n.iterace), n.hash === hashPin('000000', n.salt, n.iterace) ? '' : n.hash);
});

test('heslo, session, šifrování', () => {
  const h = hashHeslo('tajne-heslo-1');
  assert.ok(overHeslo('tajne-heslo-1', h));
  assert.ok(!overHeslo('jine', h));
  const s = podepis({ typ: 'kp', tenant: 'A'.repeat(16) }, 60);
  assert.equal(overSession(s).typ, 'kp');
  assert.equal(overSession(s.slice(0, -2) + 'xx'), null);
  assert.equal(desifruj(zasifruj('ahoj')), 'ahoj');
});

test('IDTENANT = IČO + 8 písmen', () => {
  assert.equal(navrhniIdTenanta('75187868', 'Ing. Jindřich Hegmon'), '75187868JINDRICH');
  assert.equal(navrhniIdTenanta('22202480', 'FamiCura s.r.o.'), '22202480FAMICURA');
  assert.match(navrhniIdTenanta('1', 'A'), /^00000001A[A-Z]{7}$/);
});

test('anonymizace propouštěcí zprávy: žádné jméno, RČ, telefon ani datum narození', () => {
  const zprava = fs.readFileSync(new URL('./zprava-demo.txt', import.meta.url), 'utf8')
    + '\nRČ 470312/1234, bytem ul. Dlouhá 12, 760 01 Zlín, e-mail karel.svoboda@seznam.cz, nar. 12. 3. 1947';
  const a = anonymizuj(zprava, { jmeno: 'Karel', prijmeni: 'Svoboda', rc: '470312/1234', datumNarozeni: '1947-03-12', adresa: 'Dlouhá 12, Zlín' });
  assert.equal(a.blokovano, false, a.zbytky.join(','));
  for (const zakazane of ['SVOBODA', 'Svoboda', '470312', '604 000 000', 'seznam.cz', 'Veselá', 'Dlouhá 12', '12. 3. 1947']) {
    assert.ok(!a.text.includes(zakazane), `v textu zůstalo: ${zakazane}`);
  }
  assert.ok(a.text.includes('[PACIENT]'));
  assert.ok(a.text.includes('morfin 5 mg'), 'klinický obsah zůstává');
  const r = obnov({ kontakty: [{ jmeno: '[OSOBA_1], syn', tel: '[TELEFON_1]' }] }, a.mapa);
  assert.match(r.kontakty[0].tel, /604 000 000/);
});

test('lokální rozbor najde limitace, SOS léky a chybějící DVP', () => {
  const t = fs.readFileSync(new URL('./zprava-demo.txt', import.meta.url), 'utf8');
  const r = lokalniRozbor(anonymizuj(t, {}).text);
  assert.deepEqual(r.limity.slice(0, 2), ['KPR', 'Umělá plicní ventilace']);
  assert.equal(r.cil, 'limited');
  assert.equal(r.sos.length, 2);
  assert.ok(r.chybi.some((x) => /vyslovené přání/.test(x)));
});

test('číslo telefonu s kartou: normalizace a porovnání', async () => {
  const { normTel, hezkyTel } = await import('../src/telefon.js');
  for (const v of ['777 123 456', '+420 777 123 456', '00420777123456', '420777123456', '(777) 123-456']) assert.equal(normTel(v), '+420777123456');
  assert.equal(normTel('+421 905 123 456'), '+421905123456');
  for (const v of ['', '12345', 'abc', '+420 777 12', '0777123456789012345']) assert.equal(normTel(v), '');
  assert.equal(hezkyTel('+420777123456'), '+420 777 123 456');
});

test('nápověda: kapitoly, obrázky a lokální odpověď bez AI', async () => {
  const { textNapovedy, lokalne } = await import('../src/routes/napoveda.js');
  const t = textNapovedy();
  const kapitoly = t.match(/^## \d+\. .+$/gm);
  assert.equal(kapitoly.length, 18);
  kapitoly.forEach((k, i) => assert.ok(k.startsWith(`## ${i + 1}. `), `pořadí kapitol: ${k}`));
  for (const [, src] of t.matchAll(/!\[[^\]]*\]\((\/napoveda\/img\/[^)]+)\)/g)) {
    assert.ok(fs.existsSync(new URL('../public' + src, import.meta.url)), `chybí obrázek ${src}`);
  }
  const o = lokalne('Jak vydám PIN pro pečující?');
  assert.match(o, /Kapitola: 8\. Telefon a PINy/);
});

test('role na kartě: typy zápisů v telefonu povoluje i server', async () => {
  const { POVOLENE } = await import('../src/routes/device.js');
  const html = fs.readFileSync(new URL('../public/karta/index.html', import.meta.url), 'utf8');
  const blok = html.match(/const ROLE_KARTA = (\{[\s\S]*?\n\});/)[1];
  const ROLE_KARTA = new Function(`return ${blok}`)();
  for (const [role, r] of Object.entries(ROLE_KARTA)) for (const t of r.typy) assert.ok(POVOLENE[role] && POVOLENE[role].includes(t), `${role}: server nepovoluje „${t}“`);
  assert.deepEqual(Object.keys(ROLE_KARTA).sort(), ['hospic', 'lekar', 'pl', 'rodina', 'sestra']);
});

test('role lidí z CSV a PéčeDoma podle typu pracoviště', async () => {
  const { roleOsoby } = await import('../src/kp.js');
  assert.equal(roleOsoby('lekar', 'HOSPIC'), 'LEKAR');
  assert.equal(roleOsoby('lékař', 'PL'), 'PL');
  assert.equal(roleOsoby('sestra', 'HOSPIC'), 'HOSPIC');
  assert.equal(roleOsoby('sestra', 'DOMOV'), 'SESTRA');
  assert.equal(roleOsoby('Pečovatelka', 'DOMOV'), 'SESTRA');
  assert.equal(roleOsoby('SESTRA', 'HOSPIC'), 'SESTRA');
  assert.equal(roleOsoby('admin', 'HOSPIC'), null);
});
