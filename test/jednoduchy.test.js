import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.KP_SECRET = 'x'.repeat(40);
const { opravneni, kdoPlan } = await import('../src/kp.js');

/* napodobená databáze: pacient je aktivní, garantem je pracoviště 5, tým podle parametru */
const db = (tymRole) => ({
  one: async (sql) => {
    if (sql.includes('FROM dbo.A_KP_Pacient')) return { PacientID: 1, Stav: 'AKTIVNI' };
    if (sql.includes("g.Stav = 'PLATNA'")) return { GaranceID: 1, PoskytovatelID: 5 };
    return null;   // žádný návrh garance
  },
  all: async (sql) => (sql.includes('A_KP_Tym') ? tymRole.map((Role) => ({ Role })) : []),
});
const uz = (role, jednoduchy, poskytovatelId = 5) => ({ role, jednoduchy, poskytovatelId, jmeno: 'Jana Nováková' });

test('jednoduchý režim (0.11.111): sestra v týmu smí totéž co lékař, plná Karta beze změny', async () => {
  const plna = await opravneni(db(['GARANT']), uz(['sestra'], false), 1);
  assert.equal(plna.lekar, false, 'plná Karta: sestra není lékař');
  assert.equal(plna.garant, false);
  assert.equal(plna.zapis, true);
  const jed = await opravneni(db(['GARANT']), uz(['sestra'], true), 1);
  assert.equal(jed.lekar, true, 'jednoduchý režim: sestra zapíše plán');
  assert.equal(jed.garant, true, 'jednoduchý režim: sestra předá pacientovi do Průkazu');
  const lekar = await opravneni(db(['GARANT']), uz(['lekar'], false), 1);
  assert.equal(lekar.lekar && lekar.garant, true, 'lékař garanta smí vše i v plné Kartě');
});

test('jednoduchý režim: „jen čtení“ a host v týmu dál jen čtou', async () => {
  const ctenar = await opravneni(db(['GARANT']), uz(['ctenar'], true), 1);
  assert.equal(ctenar.lekar || ctenar.garant || ctenar.zapis, false);
  const host = await opravneni(db(['HOST']), uz(['sestra'], true, 9), 1);
  assert.equal(host.lekar || host.garant, false, 'host (např. nemocnice) nezapisuje ani v jednoduchém režimu');
});

test('verze plánu uložená sestrou nese „(sestra)“', () => {
  assert.equal(kdoPlan({ role: ['sestra'], jmeno: 'Jana Nováková' }), 'Jana Nováková (sestra)');
  assert.equal(kdoPlan({ role: ['lekar', 'admin'], jmeno: 'MUDr. Petr Ukázka' }), 'MUDr. Petr Ukázka');
  assert.equal(kdoPlan({ role: ['admin'], jmeno: 'Správce' }), 'Správce');
});

test('přepnutí role správce (0.11.112): jen na stejná nebo nižší práva; jednoduchý režim se správce netýká', async () => {
  const { roleNahledu } = await import('../src/kp.js');
  assert.deepEqual(roleNahledu(['admin', 'lekar']), ['admin', 'lekar', 'sestra', 'ctenar']);
  assert.deepEqual(roleNahledu(['admin']), ['admin', 'sestra', 'ctenar'], 'správce bez lékaře se lékařem nestane');
  assert.deepEqual(roleNahledu(['lekar']), [], 'přepínat smí jen správce');
  const spravce = await opravneni(db(['GARANT']), uz(['admin', 'lekar'], false), 1);
  assert.equal(spravce.garant && spravce.lekar, true);
});
