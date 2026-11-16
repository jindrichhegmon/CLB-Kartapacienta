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

test('dokument do Průkazu (0.11.118): jen zařízení PACIENT, propojené, a jen předaný dokument jeho pacienta – v jednom dotazu', async () => {
  const { dokumentProZarizeni, obsahPredani } = await import('../src/kp.js');
  const volani = [];
  const q = { one: async (sql, par) => { volani.push({ sql, par }); return par.d === 7 && par.p === 42 ? { id: 7, nazev: 'Zpráva', mime: 'application/pdf', obsah: Buffer.from('x'), sha256: 'ab' } : null; } };
  const z = { ZarizeniID: 5, PacientID: 42, Rezim: 'PACIENT', Stav: 'SPAROVANO' };
  assert.equal((await dokumentProZarizeni(q, z, '7')).id, 7, 'vlastní předaný dokument');
  const sql = volani[0].sql;
  assert.match(sql, /DokumentID = @d AND PacientID = @p AND ProPacienta = 1 AND Obsah IS NOT NULL/, 'vlastnictví i předání v jednom dotazu');
  assert.equal(volani[0].par.p, 42, 'pacient se bere ze zařízení, ne z požadavku');
  assert.equal(await dokumentProZarizeni(q, z, '8'), null, 'cizí / nepředaný dokument → null (404)');
  assert.equal(await dokumentProZarizeni(q, { ...z, PacientID: 43 }, '7'), null, 'dokument jiného pacienta → null');
  const pred = volani.length;
  assert.equal(await dokumentProZarizeni(q, { ...z, Rezim: 'ZAPUJCENY' }, '7'), null, 'zapůjčený telefon dokumenty nestahuje');
  assert.equal(await dokumentProZarizeni(q, { ...z, Stav: 'ZABLOKOVANO' }, '7'), null, 'ukončený přístup');
  assert.equal(await dokumentProZarizeni(q, z, 'abc'), null, 'neplatné číslo');
  assert.equal(volani.length, pred, 'bez oprávněného zařízení se do databáze vůbec nesahá');
  const b = { plan: null, kontakty: [], tym: [], garant: {} };
  assert.equal('dokumenty' in obsahPredani(b), false, 'bez dokumentů se snímek nemění (žádná falešná aktualizace)');
  assert.deepEqual(obsahPredani({ ...b, dokumenty: [{ id: 7, sha256: 'ab', nazev: 'Zpráva', typ: 'ZPRAVA', datum: '2026-11-16', velikost: 9 }] }).dokumenty, [{ id: 7, sha256: 'ab', nazev: 'Zpráva', typ: 'ZPRAVA', datum: '2026-11-16' }]);
});

test('původ údajů plánu (0.11.123): ze zprávy / ručně / z PéčeDoma podle verze, od které je údaj v plánu', async () => {
  const { puvodPlanu, zdrojVerze } = await import('../src/kp.js');
  const V = [
    { verze: 1, typ: 'ZALOZENI', podepsal: 'MUDr. A', vytvoreno: '2026-11-01 10:00', data: { dg: 'C50.9 Ca prsu', funkce: 'chodí', alergie: 'žádné známé', sos: ['Morfin 10 mg'], opioidy: [], medikace: [] } },
    { verze: 2, typ: 'ZMENA', podepsal: 'Ing. J', vytvoreno: '2026-11-16 18:00', poznamka: 'Doplněno z rozboru zprávy „Dekurz.pdf“ (lokální rozbor)', data: { dg: 'C50.9 Ca prsu\nR52.1; Ischemická choroba DK', funkce: 'PPS 30 %', alergie: 'žádné známé', sos: ['Morfin 10 mg', 'Novalgin'], opioidy: ['Palexia SR 150-0-50'], medikace: [] } },
    { verze: 3, typ: 'REVIZE', podepsal: 'MUDr. B', vytvoreno: '2026-11-17 08:00', data: { dg: 'C50.9 Ca prsu\nR52.1\nIschemická choroba DK', funkce: 'PPS 30 %', alergie: 'žádné známé', sos: ['Novalgin'], opioidy: ['Palexia SR 150-0-50'], medikace: [] } },
    { verze: 4, typ: 'ZMENA', podepsal: 'PéčeDoma: MUDr. C', vytvoreno: '2026-11-18 09:00', data: { dg: 'C50.9 Ca prsu\nR52.1\nIschemická choroba DK\nI50.0', funkce: 'PPS 30 %', alergie: 'penicilin', sos: ['Novalgin'], opioidy: ['Palexia SR 150-0-50'], medikace: [] } },
  ];
  const p = puvodPlanu(V, 'zprava');
  assert.deepEqual(p.dg.map((x) => [x.text, x.zdroj, x.verze]), [['C50.9 Ca prsu', 'zalozeni-zprava', 1], ['R52.1', 'zprava', 2], ['Ischemická choroba DK', 'zprava', 2], ['I50.0', 'pecedoma', 4]]);
  assert.equal(p.dg[1].dokument, 'Dekurz.pdf');
  assert.deepEqual([p.opioidy[0].zdroj, p.sos[0].zdroj, p.funkce.zdroj, p.alergie.zdroj], ['zprava', 'zprava', 'zprava', 'pecedoma']);
  // položka, která z plánu zmizí a vrátí se, má původ od návratu; ruční úprava kódu je ručně
  const p2 = puvodPlanu([...V, { verze: 5, typ: 'ZMENA', podepsal: 'MUDr. B', vytvoreno: '2026-11-19 09:00', data: { ...V[3].data, dg: 'C50 Ca prsu\nR52.1\nIschemická choroba DK\nI50.0', sos: ['Morfin 10 mg', 'Novalgin'] } }], 'rucne');
  assert.equal(p2.dg[0].zdroj, 'rucne');
  assert.equal(p2.sos[0].verze, 5);
  assert.equal(zdrojVerze({ typ: 'ZALOZENI' }, 'pecedoma').zdroj, 'zalozeni-pecedoma');
  assert.equal(zdrojVerze({ typ: 'ZMENA', podepsal: 'MUDr. B' }).zdroj, 'rucne');
});

test('seznam léčiv SÚKL (0.11.124): stejná data jako Průkaz pacienta, hledání a lék podle textu zprávy; audit léku ze zprávy', async () => {
  const { seznamSukl, lekText } = await import('../src/sukl.js');
  const s = seznamSukl();
  assert.ok(s.pocet > 5000, 'kopie seznamu SÚKL v data/sukl-leky.json');
  assert.ok(s.hledej('palex', 5).every((p) => /^PALEXIA/.test(p.nazev)));
  assert.ok(s.hledej('novalg', 5).some((p) => /^NOVALGIN/.test(p.nazev)));
  assert.deepEqual(s.hledej('x'), []);
  assert.match(lekText(s.najdiVTextu('Pregabalin Accord 150mg-0-150mg')), /^PREGABALIN ACCORD 150/);
  const { RE_AUDIT_LEKU } = await import('../src/routes/central.js');
  assert.deepEqual('potvrzen lék Palexia SR 150-0-50 · ze zprávy „Dekurz.pdf“'.match(RE_AUDIT_LEKU).slice(1), ['potvrzen', 'Palexia SR 150-0-50', 'Dekurz.pdf']);
  assert.deepEqual('přidán SOS lék Morphin 10 mg s.c.'.match(RE_AUDIT_LEKU).slice(1), ['přidán', 'Morphin 10 mg s.c.', undefined]);
});
