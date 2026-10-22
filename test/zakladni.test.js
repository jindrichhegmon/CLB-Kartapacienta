import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
process.env.KP_SECRET = 'x'.repeat(40);
const { kodDne, dnesPraha, konecDnePraha, hashPin, novyPin, hashHeslo, overHeslo, podepis, overSession, zasifruj, desifruj } = await import('../src/crypto.js');
const { anonymizuj, obnov } = await import('../src/anonym.js');
const { lokalniRozbor } = await import('../src/ai.js');
const { navrhniIdTenanta } = await import('../src/routes/admin.js');

test('kód lékaře dne: 6 číslic, celý den stejný, jiný den jiný, telefon (WebCrypto) spočítá totéž', async () => {
  const secret = Buffer.from('12345678901234567890').toString('hex');
  assert.match(kodDne(secret, '2026-10-22'), /^\d{6}$/);
  assert.equal(kodDne(secret, '2026-10-22'), kodDne(secret, '2026-10-22'));
  assert.notEqual(kodDne(secret, '2026-10-22'), kodDne(secret, '2026-10-23'));
  // stejný výpočet jako public/karta/index.html kodDne()
  const k = await globalThis.crypto.subtle.importKey('raw', Buffer.from(secret, 'hex'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const h = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', k, new TextEncoder().encode('kod-dne:2026-10-22')));
  const telefon = String((((h[0] & 127) << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) % 1000000).padStart(6, '0');
  assert.equal(telefon, kodDne(secret, '2026-10-22'));
  // den v Praze: 23:30 UTC 21. 10. je v Praze už 22. 10.; konec dne = půlnoc v Praze
  assert.equal(dnesPraha(Date.UTC(2026, 9, 21, 23, 30)), '2026-10-22');
  assert.equal(konecDnePraha(Date.UTC(2026, 9, 22, 10, 0)), '2026-10-22T22:00:00.000Z');
  assert.equal(konecDnePraha(Date.UTC(2026, 0, 15, 10, 0)), '2026-01-15T23:00:00.000Z');
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
  assert.equal(kapitoly.length, 19);
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

test('doklad k limitacím: DVP s poučením a ověřeným podpisem, DVP z přijetí, rozhodnutí lékaře', async () => {
  const { normalizujDoklad, normalizujPlan } = await import('../src/kp.js');
  const plne = normalizujDoklad({ dvp: true, datum: '2026-09-10', pouceni: 1, overenyPodpis: 'ano', prijeti: '  ' });
  assert.deepEqual([plne.dvp, plne.pouceni, plne.overenyPodpis, plne.prijeti], [true, true, true, '']);
  // bez DVP nemá poučení, podpis ani přijetí smysl – nesmí se na kartě objevit
  const bez = normalizujDoklad({ dvp: false, pouceni: true, overenyPodpis: true, prijeti: 'Nemocnice Zlín', zprava: 'zpráva z 1. 10.' });
  assert.deepEqual([bez.pouceni, bez.overenyPodpis, bez.prijeti, bez.zprava], [false, false, '', 'zpráva z 1. 10.']);
  assert.equal(normalizujPlan({ doklad: { dvp: true, prijeti: 'Nemocnice Zlín, interna' } }).doklad.prijeti, 'Nemocnice Zlín, interna');
  assert.equal(normalizujPlan({}).doklad.dvp, false);
});

test('PéčeDoma: odpověď sync → řádek A_KP_PdSync (léky, nejbližší návštěva, chyba kalendáře)', async () => {
  const { normalizujSync } = await import('../src/pecedoma.js');
  const v = normalizujSync({ leky: { sos: ['Morphin 10 mg s.c. – při bolesti', ' ', 'Midazolam 5 mg'], medikace: ['MST Continus 30 mg – 1-0-1'], vPeceDoma: true },
    pristiNavsteva: { kdy: '2026-10-24T09:30', lekar: 'MUDr. Malý', sestra: 'Jana Veselá', sluzba: 'Návštěva sestry', stav: 'Plánováno', misto: 'Zlín' }, klient: { portalKlientId: '12' } });
  assert.deepEqual(v.sos, ['Morphin 10 mg s.c. – při bolesti', 'Midazolam 5 mg']);
  assert.equal(v.pristiNavsteva, '2026-10-24 09:30');
  assert.equal(v.pristiKdo, 'lékař MUDr. Malý, sestra Jana Veselá');
  assert.equal(v.pristiPozn, 'Návštěva sestry · Plánováno · Zlín');
  assert.equal(v.portalKlientId, 12);
  const bez = normalizujSync({ leky: {}, pristiNavsteva: null, kalendarChyba: 'Kalendář FK neodpovídá' });
  assert.deepEqual([bez.sos, bez.medikace, bez.pristiNavsteva, bez.pristiKdo, bez.kalendarChyba], [[], [], null, null, 'Kalendář FK neodpovídá']);
});
