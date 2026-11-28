// Zpráva do Průkazu (0.11.148): jednorázová zašifrovaná zásilka v paměti serveru a CORS pro aplikaci na Netlify
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.KP_SECRET = 'x'.repeat(40);
const { zalozZasilku, vyzvedniZasilku, zrusZasilku, cekaZasilka, ZASILKA_ID_RE, ZASILKA_PLATNOST_MS, ZASILKA_MAX_ZNAKU } = await import('../src/zasilka.js');
const { corsPovolen } = await import('../src/cors.js');

const T = 'ABCDEFGHIJKLMNOP', sifra = Buffer.alloc(300, 7).toString('base64');

test('zásilka: vydá se jen jednou, jen správné organizaci a jen 30 minut', () => {
  const t0 = Date.UTC(2026, 10, 28, 10);
  const z = zalozZasilku({ tenant: T, uzivatelId: 5, sifra }, t0);
  assert.match(z.id, ZASILKA_ID_RE);
  assert.equal(z.platnostDo, new Date(t0 + ZASILKA_PLATNOST_MS).toISOString());
  assert.equal(vyzvedniZasilku('ZZZZZZZZZZZZZZZZ', z.id, t0), null, 'jiná organizace nic nedostane');
  assert.equal(cekaZasilka(T, z.id, t0), true);
  assert.equal(vyzvedniZasilku(T, z.id, t0 + 1000).sifra, sifra);
  assert.equal(vyzvedniZasilku(T, z.id, t0 + 2000), null, 'podruhé už ne');
  assert.equal(cekaZasilka(T, z.id, t0 + 2000), false);

  const z2 = zalozZasilku({ tenant: T, uzivatelId: 5, sifra }, t0);
  assert.equal(vyzvedniZasilku(T, z2.id, t0 + ZASILKA_PLATNOST_MS + 1), null, 'po 30 minutách vypršela');

  const z3 = zalozZasilku({ tenant: T, uzivatelId: 5, sifra }, t0);
  assert.equal(zrusZasilku(T, z3.id, 6), false, 'zrušit smí jen ten, kdo ji vytvořil');
  assert.equal(zrusZasilku(T, z3.id, 5), true);
  assert.equal(vyzvedniZasilku(T, z3.id, t0), null);
});

test('zásilka: přijme jen base64 šifru rozumné velikosti', () => {
  assert.throws(() => zalozZasilku({ tenant: T, uzivatelId: 1, sifra: '' }), /Chybí zašifrovaná zpráva/);
  assert.throws(() => zalozZasilku({ tenant: T, uzivatelId: 1, sifra: '{"dg":"C50 karcinom prsu"}'.repeat(5) }), /Chybí zašifrovaná zpráva/, 'nešifrovaný JSON neprojde');
  assert.throws(() => zalozZasilku({ tenant: T, uzivatelId: 1, sifra: 'A'.repeat(ZASILKA_MAX_ZNAKU + 4) }), /příliš velká/);
});

test('CORS: aplikace Zpráva do Průkazu smí jen přihlášení, rozbor zprávy a zásilku; Průkaz smí vyzvednout zásilku', () => {
  const zprava = 'https://zprava-do-prukazu.netlify.app', prukaz = 'https://dialogusprukaz.netlify.app';
  for (const c of ['/api/c/login', '/api/c/ja', '/api/c/ai/rozbor-souboru', '/api/c/zasilka', '/api/c/zasilka/stav', '/api/c/zasilka/zrusit']) assert.equal(corsPovolen(zprava, c), true, c);
  for (const c of ['/api/c/pacient/5', '/api/c/prehled', '/api/c/pacient', '/api/d/sync', '/api/d/zasilka']) assert.equal(corsPovolen(zprava, c), false, c);
  assert.equal(corsPovolen(prukaz, '/api/d/zasilka'), true);
  assert.equal(corsPovolen(prukaz, '/api/c/zasilka'), false);
  assert.equal(corsPovolen('https://cizi.example', '/api/c/login'), false);
  assert.equal(corsPovolen(undefined, '/api/c/login'), false);
});
