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

test('telefon bez kamery: kód z obrazovky spojí telefon s přenosem jen při shodě kódu i čísla', async () => {
  const { zalozCekani, stavCekani, potvrdCekani } = await import('../src/prenos.js');
  const c = zalozCekani('+420777000555');
  assert.match(c.kod, /^\d{6}$/);
  assert.equal(stavCekani(c.id).stav, 'ceka');
  assert.equal(potvrdCekani(c.kod, '+420777000999', 'ABCDEFGHJKMN'), false, 'jiné číslo');
  assert.equal(potvrdCekani('000000' === c.kod ? '111111' : '000000', '+420777000555', 'ABCDEFGHJKMN'), false, 'jiný kód');
  assert.equal(potvrdCekani(c.kod, '+420777000555', 'ABCDEFGHJKMN'), true);
  assert.deepEqual(stavCekani(c.id), { stav: 'potvrzeno', prenos: 'ABCDEFGHJKMN' });
  assert.equal(stavCekani('neexistuje').stav, 'neplatny');
});

test('6místné číslo z centrály: jen pro telefon, pro který bylo vydané, a jen do platnosti (0.11.110)', async () => {
  const { vydejCislo, najdiCislo, CISLO_MAX_MS } = await import('../src/prenos.js');
  const nyni = Date.now();
  const cil = { typ: 'parovat', tenant: 'ABCDEFGH12345678', kod: 'K2M4P6Q8', rezim: 'PACIENT' };
  const a = vydejCislo(cil, '+420777123456', new Date(nyni + 72 * 3600e3), nyni);
  assert.match(a.cislo, /^\d{6}$/);
  assert.equal(a.platnost.getTime(), nyni + CISLO_MAX_MS, 'nejdéle 24 hodin');
  assert.deepEqual(najdiCislo(a.cislo, '+420777123456', nyni), cil);
  assert.deepEqual(najdiCislo(a.cislo.slice(0, 3) + ' ' + a.cislo.slice(3), '+420777123456', nyni), cil, 'mezera v čísle nevadí');
  assert.equal(najdiCislo(a.cislo, '+420777000000', nyni), null, 'jiný telefon číslo nedostane');
  assert.equal(najdiCislo(a.cislo, '+420777123456', nyni + CISLO_MAX_MS + 1), null, 'po platnosti neplatí');
  const b = vydejCislo(cil, '+420777123456', new Date(nyni + 30 * 60e3), nyni);
  assert.equal(b.cislo, a.cislo, 'stejný kód = stejné číslo (okno otevřené znovu)');
  const p = vydejCislo({ typ: 'prenos', kod: 'ABCDEFGHJKMN' }, '', new Date(nyni + 30 * 60e3), nyni);
  assert.notEqual(p.cislo, a.cislo);
  assert.deepEqual(najdiCislo(p.cislo, '+420777999999', nyni), { typ: 'prenos', kod: 'ABCDEFGHJKMN' }, 'bez čísla telefonu platí pro každý telefon');
});
