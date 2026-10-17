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
