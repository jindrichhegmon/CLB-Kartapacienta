import { test } from 'node:test';
import assert from 'node:assert/strict';
const { zalozPrenos, vezmiPrenos, dokonciPrenos, stavPrenosu, zrusPrenos, normalizujKod, formatujKod, PRENOS_KOD_RE, PRENOS_PLATNOST_MS } = await import('../src/prenos.js');

const T = 'ABCDEFGH12345678';

test('výměna telefonu: kód je jednorázový a čitelný', () => {
  const { kod } = zalozPrenos([{ tenant: T, zarizeniId: 1, tokenHash: 'a' }]);
  assert.match(kod, PRENOS_KOD_RE);
  assert.equal(normalizujKod(formatujKod(kod).toLowerCase()), kod);
  assert.equal(stavPrenosu(kod).stav, 'ceka');
  const p = vezmiPrenos(kod);
  assert.equal(p.karty.length, 1);
  assert.equal(vezmiPrenos(kod), null, 'podruhé už kód neplatí');
  dokonciPrenos(kod, 1);
  assert.deepEqual(stavPrenosu(kod), { stav: 'prevzato', pocet: 1 });
});

test('výměna telefonu: kód vyprší, jde zrušit a nový kód ruší starší pro stejný telefon', () => {
  const nyni = Date.now();
  const a = zalozPrenos([{ tenant: T, zarizeniId: 2, tokenHash: 'b' }], nyni);
  assert.equal(vezmiPrenos(a.kod, nyni + PRENOS_PLATNOST_MS + 1), null);
  const b = zalozPrenos([{ tenant: T, zarizeniId: 3, tokenHash: 'c' }]);
  const c = zalozPrenos([{ tenant: T, zarizeniId: 3, tokenHash: 'c' }, { tenant: T, zarizeniId: 4, tokenHash: 'd' }]);
  assert.equal(stavPrenosu(b.kod).stav, 'neplatny');
  assert.equal(stavPrenosu(c.kod).stav, 'ceka');
  assert.ok(zrusPrenos(c.kod));
  assert.equal(vezmiPrenos(c.kod), null);
  assert.throws(() => zalozPrenos([]));
});

test('výměna telefonu: náhled kód nespotřebuje (nový telefon předvyplní číslo)', async () => {
  const { nahledPrenosu } = await import('../src/prenos.js');
  const { kod } = zalozPrenos([{ tenant: T, zarizeniId: 9, tokenHash: 'e', telefon: '+420777000111' }]);
  assert.equal(nahledPrenosu(kod).karty[0].telefon, '+420777000111');
  assert.ok(vezmiPrenos(kod), 'po náhledu jde kód pořád použít');
  assert.equal(nahledPrenosu(kod), null);
});
