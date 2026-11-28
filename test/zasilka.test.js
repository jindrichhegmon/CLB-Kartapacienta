// Zpráva do Průkazu (0.11.148): bez přihlášení a bez Karty pacienta – rozbor zprávy bez identity, jednorázová zašifrovaná zásilka, CORS
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
process.env.KP_SECRET = 'x'.repeat(40);
delete process.env.ANTHROPIC_API_KEY;   // rozbor podle pravidel – zkouška nic neposílá ven
const { zalozZasilku, vyzvedniZasilku, zrusZasilku, cekaZasilka, ZASILKA_PLATNOST_MS, ZASILKA_MAX_ZNAKU } = await import('../src/zasilka.js');
const { corsPovolen } = await import('../src/cors.js');
const express = (await import('express')).default;
const { zprava } = await import('../src/routes/zprava.js');

const sifra = Buffer.alloc(300, 7).toString('base64');
const ID = (n) => String(n).repeat(64).slice(0, 64);

test('zásilka: vydá se jen jednou a jen 30 minut; id je jen otisk kódu', () => {
  const t0 = Date.UTC(2026, 10, 28, 10);
  const z = zalozZasilku({ id: ID('a'), sifra }, t0);
  assert.equal(z.platnostDo, new Date(t0 + ZASILKA_PLATNOST_MS).toISOString());
  assert.throws(() => zalozZasilku({ id: ID('a'), sifra }, t0), /už se používá/);
  assert.equal(cekaZasilka(ID('a'), t0), true);
  assert.equal(vyzvedniZasilku(ID('a'), t0 + 1000).sifra, sifra);
  assert.equal(vyzvedniZasilku(ID('a'), t0 + 2000), null, 'podruhé už ne');
  assert.equal(cekaZasilka(ID('a'), t0 + 2000), false);
  zalozZasilku({ id: ID('b'), sifra }, t0);
  assert.equal(vyzvedniZasilku(ID('b'), t0 + ZASILKA_PLATNOST_MS + 1), null, 'po 30 minutách vypršela');
  zalozZasilku({ id: ID('c'), sifra }, t0);
  assert.equal(zrusZasilku(ID('c')), true); assert.equal(vyzvedniZasilku(ID('c'), t0), null);
});

test('zásilka: přijme jen platné id a base64 šifru rozumné velikosti', () => {
  assert.throws(() => zalozZasilku({ id: 'ABCD-1234', sifra }), /Neplatné číslo zásilky/, 'samotný kód (klíč) na server nesmí');
  assert.throws(() => zalozZasilku({ id: ID('d'), sifra: '' }), /Chybí zašifrovaná zpráva/);
  assert.throws(() => zalozZasilku({ id: ID('d'), sifra: '{"dg":"C50 karcinom prsu"}'.repeat(5) }), /Chybí zašifrovaná zpráva/, 'nešifrovaný JSON neprojde');
  assert.throws(() => zalozZasilku({ id: ID('d'), sifra: 'A'.repeat(ZASILKA_MAX_ZNAKU + 4) }), /příliš velká/);
});

test('CORS: Zpráva do Průkazu smí jen /api/z/* (rozbor, zásilka), Průkaz jen vyzvednout; nic z Karty pacienta', () => {
  const zp = 'https://zprava-do-prukazu.netlify.app', pr = 'https://dialogusprukaz.netlify.app';
  for (const c of ['/api/z/rozbor', '/api/z/zasilka', '/api/z/zasilka/stav', '/api/z/zasilka/zrusit']) assert.equal(corsPovolen(zp, c), true, c);
  for (const c of ['/api/c/login', '/api/c/ai/rozbor-souboru', '/api/c/pacient/5', '/api/d/sync', '/api/z/vyzvednout']) assert.equal(corsPovolen(zp, c), false, c);
  assert.equal(corsPovolen(pr, '/api/z/vyzvednout'), true);
  assert.equal(corsPovolen(pr, '/api/z/rozbor'), false);
  assert.equal(corsPovolen('https://cizi.example', '/api/z/rozbor'), false);
});

test('rozbor zprávy bez přihlášení: vrátí diagnózy a léky, ale ne jméno ani identitu pacienta', async () => {
  const app = express(); app.use(express.json({ limit: '12mb' })); app.use('/api/z', zprava);
  const srv = app.listen(0); const url = `http://127.0.0.1:${srv.address().port}/api/z`;
  try {
    const post = (c, b) => fetch(url + c, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, d: await r.json() }));
    const r = await post('/rozbor', { mime: 'application/pdf', nazev: 'zprava.pdf', data: fs.readFileSync(new URL('./zprava-medistar-ukazka.pdf', import.meta.url)).toString('base64') });
    assert.equal(r.status, 200, JSON.stringify(r.d));
    const s = JSON.stringify(r.d);
    assert.match(s, /C50/); assert.match(s, /Furosemid/);
    assert.doesNotMatch(s, /Zkušební|Marie|1946|identita|anonymniText/, 'jméno, datum narození ani anonymizovaný text se nevrací');
    assert.equal((await post('/rozbor', { mime: 'text/html', data: 'eA==' })).status, 400);
    // zásilka přes HTTP: založit → stav → vyzvednout jednou
    assert.equal((await post('/zasilka', { id: ID('e'), sifra })).status, 200);
    assert.equal((await post('/zasilka/stav', { id: ID('e') })).d.ceka, true);
    assert.equal((await post('/vyzvednout', { id: ID('e') })).d.sifra, sifra);
    const znovu = await post('/vyzvednout', { id: ID('e') });
    assert.equal(znovu.status, 404); assert.match(znovu.d.chyba, /30 minut a jen jednou/);
    assert.equal((await post('/vyzvednout', { id: 'x' })).status, 400);
  } finally { srv.close(); }
});
