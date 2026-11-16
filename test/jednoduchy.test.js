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

test('předání do Průkazu (0.11.113): snímek obsahuje plán, diagnózy, alergie, léky, kontakty a tým; léky z PéčeDoma mají přednost', async () => {
  const { obsahPredani } = await import('../src/kp.js');
  const plan = { verze: 4, platnostDo: '2027-01-01', podepsal: 'MUDr. A', data: { cil: 'symptom', kpr: 'dvp', limity: ['KPR'], doklad: { dvp: true, datum: '2026-10-01', original: 'u dcery' }, dg: 'C50', alergie: 'penicilin', sos: ['Morphin'], opioidy: [], medikace: [] } };
  const b = { plan, dgPopisy: { C50: 'Zhoubný novotvar prsu' }, kontakty: [{ jmeno: 'Jana', tel: '+420777', skupina: 'rozhoduje', id: 9 }], tym: [{ nazev: 'Hospic', tel: '+420577' }], garant: { poskytovatel: 'Hospic', lekar: 'MUDr. B', telefon24: '+420577' }, pecedoma: null };
  const o = obsahPredani(b);
  assert.equal(o.plan.verze, 4); assert.equal(o.plan.dvp, true); assert.deepEqual(o.leky.sos, ['Morphin']); assert.equal(o.leky.zdroj, 'plán péče');
  assert.deepEqual(o.kontakty, [{ jmeno: 'Jana', tel: '+420777', skupina: 'rozhoduje' }], 'jen jméno, telefon a skupina');
  const pd = obsahPredani({ ...b, pecedoma: { propojeno: true, aktualizovano: '2026-11-16', sos: ['Oxycodon'], opioidy: [], medikace: [] } });
  assert.equal(pd.leky.zdroj, 'PéčeDoma'); assert.deepEqual(pd.leky.sos, ['Oxycodon']);
  assert.equal(obsahPredani({ kontakty: [], tym: [] }).plan, null, 'bez plánu');
});

test('obnovení v Průkazu (0.11.114): změna od posledního předání a výzva z centrály', async () => {
  const { stavPredani, obsahPredani } = await import('../src/kp.js');
  const plan = { verze: 2, data: { cil: 'symptom', dg: 'C50', alergie: 'penicilin', sos: ['Morphin'] } };
  const b = { plan, dgPopisy: { C50: 'X' }, kontakty: [], tym: [], garant: {} };
  const qq = (snimek, vyzva) => ({ one: async (sql) => (sql.includes('A_KP_Predani') ? snimek : sql.includes('A_KP_AuditLog') ? vyzva : null) });
  const stejny = { obsah: JSON.stringify({ ...obsahPredani(b), dgPopisy: {} }), cas: '2026-11-16 10:00:00' };
  assert.deepEqual((await stavPredani(qq(stejny, null), 1, [5], b))[5], { posledniPredani: '2026-11-16 10:00', zmena: false, vyzva: false, vyzvaOd: null, aktualizace: false }, 'jiné popisy diagnóz nejsou změna');
  const zmeneny = await stavPredani(qq(stejny, null), 1, [5], { ...b, plan: { verze: 3, data: { ...plan.data, alergie: 'žádné' } } });
  assert.equal(zmeneny[5].zmena, true); assert.equal(zmeneny[5].aktualizace, true);
  const vyzva = await stavPredani(qq(stejny, { cas: '2026-11-16 11:00:00' }), 1, [5], b);
  assert.equal(vyzva[5].vyzva, true); assert.equal(vyzva[5].aktualizace, true);
  const stara = await stavPredani(qq(stejny, { cas: '2026-11-16 09:00:00' }), 1, [5], b);
  assert.equal(stara[5].vyzva, false, 'výzva před posledním načtením už neplatí');
  assert.equal((await stavPredani(qq(null, null), 1, [5], b))[5].zmena, null, 'předáno před 0.11.113 – nejde porovnat');
});
