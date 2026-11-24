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

test('lék v PéčeDoma (0.11.125): zapsáno ručně + ověřeno zprávou, ze zprávy, jinak zapsáno v PéčeDoma', async () => {
  const { puvodLekuPd } = await import('../src/routes/central.js');
  const audit = [   // od nejnovějšího jako v databázi
    { kdo: 'Ing. J', kdy: '2026-11-16 20:30', detail: 'potvrzen lék Atoris 1x1 · ze zprávy „Dekurz.pdf“' },
    { kdo: 'Ing. J', kdy: '2026-11-16 20:30', detail: 'upraven lék Palexia SR 150-0-50 · ze zprávy „Dekurz.pdf“' },
    { kdo: 'Ing. J', kdy: '2026-11-16 20:30', detail: 'přidán lék Dexamethason 4 mg 1-0-0 · ze zprávy „Dekurz.pdf“' },
    { kdo: 'Jana V', kdy: '2026-11-02 10:20', detail: 'přidán lék Palexia SR 150-0-50' },
    { kdo: 'Jana V', kdy: '2026-11-02 10:17', detail: 'přidán lék Atoris 1x1' },
  ];
  const q = { all: async () => audit };
  const l = await puvodLekuPd(q, 1, [{ nazev: 'Atoris', davka: '1x1' }, { nazev: 'Palexia SR', davka: '150-0-50' }, { nazev: 'Dexamethason', davka: '4 mg 1-0-0' }, { nazev: 'Lactulosa', davka: '', od: '2026-10-01' }]);
  assert.deepEqual([l[0].puvod.zdroj, l[0].puvod.kdo, l[0].puvod.overeno.dokument], ['karta', 'Jana V', 'Dekurz.pdf'], 'ručně + ověřeno');
  assert.deepEqual([l[1].puvod.zdroj, l[1].puvod.overeno && l[1].puvod.overeno.dokument], ['karta', 'Dekurz.pdf'], 'přesun skupiny ze zprávy: zapsal ručně, ověřeno zprávou');
  assert.deepEqual([l[2].puvod.zdroj, l[2].puvod.dokument, l[2].puvod.overeno], ['zprava', 'Dekurz.pdf', undefined]);
  assert.deepEqual([l[3].puvod.zdroj, l[3].puvod.overeno], ['pecedoma', undefined]);
});

test('deník přístupů (0.11.128): hledání bez zástupných znaků SQL a podle českého data', async () => {
  const { likeVzor, hledatDatum } = await import('../src/routes/central.js');
  assert.equal(likeVzor('50%_[x]'), '%50[%][_][[]x]%');
  assert.equal(hledatDatum('16. 11.'), '-11-16');
  assert.equal(hledatDatum('6.1.2026'), '2026-01-06');
  assert.equal(hledatDatum('Palexia'), 'Palexia');
});

test('nový pacient ze zprávy (0.11.129): identita z hlavičky Medistaru, rodné číslo, anonymizace bez diakritiky, původ při založení', async () => {
  const fs = await import('node:fs');
  const { identitaZeZpravy, zRodnehoCisla, rozdelJmeno } = await import('../src/identita.js');
  const { anonymizuj } = await import('../src/anonym.js');
  const { rozborZpravy } = await import('../src/ai.js');
  const { puvodPlanu } = await import('../src/kp.js');
  const t = fs.readFileSync(new URL('./zprava-medistar-dekurz.txt', import.meta.url), 'utf8');   // smyšlený dekurz
  const id = identitaZeZpravy(t);
  assert.deepEqual([id.jmeno, id.prijmeni, id.rc, id.datumNarozeni, id.pohlavi, id.pojistovna, id.adresa, id.telefon],
    ['Jan', 'Testovací', '450101/123', '1945-01-01', 'muž', '111', 'Lipová 12, 760 01 Zlín', '777000111']);
  assert.deepEqual(zRodnehoCisla('346231/434'), { rc: '346231/434', datumNarozeni: '1934-12-31', rok: 1934, pohlavi: 'žena' });
  assert.equal(zRodnehoCisla('0452151234').datumNarozeni, '2004-02-15');
  assert.equal(zRodnehoCisla('991332/1234'), null, 'neplatné datum');
  assert.deepEqual(rozdelJmeno('MUDr. Jan NOVÁK, Ph.D.'), { jmeno: 'Jan', prijmeni: 'Novák' });
  assert.deepEqual(rozdelJmeno('Charuzova Silvia', 'pj'), { jmeno: 'Silvia', prijmeni: 'Charuzova' });
  assert.deepEqual(identitaZeZpravy('Pacient: Jan Novák, nar. 3. 5. 1944\nDg.: C50').datumNarozeni, '1944-05-03');
  // příjmení psané ve zprávě bez diakritiky se skryje také
  const a = anonymizuj('Pacientka Novakova přišla s dcerou. Paní Nováková souhlasí.', { jmeno: 'Marie', prijmeni: 'Nováková' });
  assert.doesNotMatch(a.text, /Nov[aá]kov/i); assert.equal(a.blokovano, false);
  // pacient ještě není v Kartě: identitu pro anonymizaci dodá hlavička zprávy
  const r = await rozborZpravy(t, { telefony: [], osoby: [] }, { priBlokuLokalne: true });
  assert.equal(r.blokovano, false);
  assert.doesNotMatch(r.anonymniText, /Testovac|450101|777000111|Lipov/);
  assert.equal(r.identita.prijmeni, 'Testovací');
  assert.match(r.vysledek.dg, /R52\.1/);
  // původ: založeno ze zprávy v souboru → štítek s názvem zprávy
  const p = puvodPlanu([{ verze: 1, typ: 'ZALOZENI', podepsal: 'MUDr. A', vytvoreno: '2026-11-17 09:00', data: { dg: 'R52.1', opioidy: ['Oxycontin'] } }], 'zprava', 'Dekurz 16. 11.');
  assert.deepEqual([p.dg[0].zdroj, p.dg[0].dokument, p.opioidy[0].dokument], ['zalozeni-zprava', 'Dekurz 16. 11.', 'Dekurz 16. 11.']);
});

test('Medistar dekurz, léky v řádku (0.11.129): „Ter.: Chronická medikace: lék, lék, , lék“ přes dva řádky a kód MKN čtený malým písmenem', async () => {
  const { lokalniRozbor } = await import('../src/ai.js');
  const r = lokalniRozbor(['Dg.: c61 Zhoubný novotvar předstojné žlázy - prostaty', 'Probíhá zajištění komplexní paliativní péče MDT.', 'Diagnóza: Ca prostaty, kardiostimulator',
    '-- Medikace --', 'Opioidy: Sine', 'SOS Medikace:', 'Pri bolesti metamizol 35 gtt', 'Parenterální medikace: Sine', 'Závěr: stabilizovaný stav',
    'Ter.: Chronická medikace: Lekadin 1-0-0, Betacare 10 mg 1-0-0, , Antikoag 5 mg 1-0-1', 'Glukonorm 1-0-0 , Tenzoprim neo 5 mg 1-0-0',
    'Dop.: Rozsah ošetřovatelské péče : péče o pokožku', 'Zav.: Ca prostaty - AV blok', 'ZP: Dg.: C61 Výkony: 09521 2x'].join('\n'));   // smyšlené názvy léků
  assert.equal(r.dg, 'C61 Zhoubný novotvar předstojné žlázy - prostaty; Ca prostaty, kardiostimulator');
  assert.deepEqual(r.medikace, ['Lekadin 1-0-0', 'Betacare 10 mg 1-0-0', 'Antikoag 5 mg 1-0-1', 'Glukonorm 1-0-0', 'Tenzoprim neo 5 mg 1-0-0']);
  assert.deepEqual(r.opioidy, []);
  assert.deepEqual(r.sos, ['Pri bolesti metamizol 35 gtt']);
});

test('léky pacienta ambulance (0.11.131): skupina Parenterálně v plánu, v rozboru zprávy i v původu údajů', async () => {
  const { normalizujPlan, puvodPlanu } = await import('../src/kp.js');
  const { lokalniRozbor } = await import('../src/ai.js');
  assert.deepEqual(normalizujPlan({ parenteralni: ' Dexamethason 8 mg i.v. \n\nMorfin 10 mg s.c.' }).parenteralni, ['Dexamethason 8 mg i.v.', 'Morfin 10 mg s.c.']);
  assert.deepEqual(normalizujPlan({}).parenteralni, [], 'starší plány bez skupiny');
  assert.deepEqual(lokalniRozbor('Dg.: C61\nOpioidy: Sine\nParenterální medikace: Sine\nParenterální terapie: Dexamethason 8 mg i.v. 1x týdně.').parenteralni, ['Dexamethason 8 mg i.v. 1x týdně']);
  assert.deepEqual(lokalniRozbor('Dg.: C61\nParenterální medikace: Sine').parenteralni, []);
  const p = puvodPlanu([{ verze: 1, typ: 'ZALOZENI', podepsal: 'A', vytvoreno: '2026-11-19 15:11', data: { parenteralni: [] } },
    { verze: 2, typ: 'ZMENA', podepsal: 'B', vytvoreno: '2026-11-19 15:18', data: { parenteralni: ['Dexamethason 8 mg i.v.'] } }], 'zprava', 'Dekurz');
  assert.deepEqual([p.parenteralni[0].zdroj, p.parenteralni[0].verze], ['rucne', 2]);
});

test('parenterální léky do Průkazu (0.11.132): ve snímku předání jen když nějaké jsou, změna spustí aktualizaci', async () => {
  const { obsahPredani } = await import('../src/kp.js');
  const b = (par) => ({ plan: { verze: 2, data: { sos: ['Novalgin'], opioidy: [], medikace: [], ...(par ? { parenteralni: par } : {}) } }, kontakty: [], tym: [], garant: {} });
  assert.equal('parenteralni' in obsahPredani(b()).leky, false, 'bez parenterálních léků se snímek nemění (žádná falešná aktualizace)');
  assert.equal('parenteralni' in obsahPredani(b([])).leky, false);
  assert.deepEqual(obsahPredani(b(['Dexamethason 8 mg i.v.'])).leky.parenteralni, ['Dexamethason 8 mg i.v.']);
  assert.notEqual(JSON.stringify(obsahPredani(b(['Dexamethason 8 mg i.v.']))), JSON.stringify(obsahPredani(b())), 'nový parenterální lék = změna k předání');
  // pacient propojený s PéčeDoma: léky jdou z PéčeDoma, parenterální z plánu se nepřidávají
  const pd = { ...b(['X']), pecedoma: { propojeno: true, aktualizovano: '2026-11-19 10:00', sos: [], opioidy: [], medikace: [] } };
  assert.equal('parenteralni' in obsahPredani(pd).leky, false);
});

test('dekurz přes OCR (0.11.134): štítek „R.Čč.:“ apod. – identita se přečte, jméno se skryje i bez ní a bez jména nic do AI', async () => {
  const { identitaZeZpravy } = await import('../src/identita.js');
  const { anonymizuj } = await import('../src/anonym.js');
  const { rozborZpravy } = await import('../src/ai.js');
  // stejná podoba jako text z OCR obrázkového dekurzu (Medistar → Tisk dekurzu → Microsoft Print to PDF), smyšlené údaje
  const t = 'Centrum pro léčbu bolesti a paliativní medicínu s.r.o. IČO: 02570459, Ambulance léčby bolesti\n'
    + 'Jana Testovací R.Čč.: 455101/1234 ZP: 111\nTrvalá adresa: Polní 12, 760 01 Zlín TEL: 603111222\nPřechodná adresa:\n'
    + '01.07.2026 15:01 M54.59 ALB\nDg.: M54.59 Bolesti dolní části zad; lokalizace NS\nRp. 1x MAGNOSOLV 365mg por gra sol scc 30 Dávkování: 1-0-0\nIng. Petr Lékařský';
  for (const s of ['R.Čč.:', 'R.C.:', 'Rč:', 'R. č,:', 'R.č.', 'RČ:']) {
    const o = identitaZeZpravy(t.replace('R.Čč.:', s));
    assert.deepEqual([o.jmeno, o.prijmeni, o.rc, o.pojistovna, o.telefon, o.adresa], ['Jana', 'Testovací', '455101/1234', '111', '603111222', 'Polní 12, 760 01 Zlín'], s);
  }
  // záchranná síť: i bez identity je jméno z hlavičky pryč
  const a = anonymizuj(t, {});
  assert.doesNotMatch(a.text, /Testovac|Jana/);
  assert.match(a.text, /^\[PACIENT\] R\.Čč\.:/m);
  // hlavička je, jméno se přečíst nepodaří → do AI nic, rozbor jen lokálně
  const r = await rozborZpravy(t.replace('Jana Testovací R.Čč.:', 'J4na T3st R?:'), {}, { priBlokuLokalne: true });
  assert.equal(r.zdroj, 'lokalne');
  assert.equal(r.aiBlokovano, true);
  const b = await rozborZpravy(t.replace('Jana Testovací R.Čč.:', 'J4na T3st R?:'), {});
  assert.equal(b.blokovano, true);
  assert.match(b.duvod, /nepodařilo přečíst/);
  // s přečtenou identitou jde rozbor dál a jméno se do výsledku doplní ze serveru
  const ok = await rozborZpravy(t, {}, { priBlokuLokalne: true });
  assert.equal(ok.vysledek.jmenoCele, 'Jana Testovací');
  assert.doesNotMatch(ok.anonymniText, /Testovac|455101|603111222|Polní/);
});

test('Medistar dekurz – léky z celé zprávy (0.11.137): Algeziologická terapie, samotné SOS:, Rp. bez zdvojení, opioidy podle názvu', async () => {
  const { lokalniRozbor } = await import('../src/ai.js');
  // podoba dekurzu z ambulance bolesti (OCR), smyšlené údaje
  const t = ['24.11.2026 10:16 M54.36 ALB', 'Dg.: M54.36 Ischias; bederní krajina', 'M Parkinson, Lumboischialgie', 'Sy neklidných nohou', 'Nynější onemocnění:',
    'Pacientka přichází do ambulance bolesti v doprovodu dcery, analgeticky stav vyhovující.',
    'Rp. Vysoce návyková látka - canabis sativa 6/6', 'Rozpis: 9390000 Extrakt z konopí pro léčebné použití, , (7.5g) ; D. S.: 1 tob na noc',
    'Rp. Vysoce návyková látka - 6x MATRIFEN 25mcg/h tdr emp 5 iii Dávkování: 1x3 dny', 'Rp. 1:x BISACODYL KRKA 5mg tbl obd 105 Dávkování: 1-0-0',
    'Rp. 3x HALOPERIDOL-RICHTER 2mg/ml por gtt sol 10ml Dávkování: 2x7 gtt',
    'Ter.: Chronická terapie: Madopar 200 0-0-1, Toviaz 4 mg 1-0-0, Alfa calci, Sortis 10 mg, Stacyl,', 'Euthyrox 50,', 'Nakom 5xdenně, chlorprotixen 0-0-1',
    'Algeziologická terapie: Gabagamma 300 mg 1-0- 1,', 'TTS fentanyl 25 - 1x 3 dny', 'konopí - 6/6- 2,5 g - tob', 'SOS: Metamizol gtt 35 při bolestí', 'Dop.: převedení do MSPP'].join('\n');
  const a = lokalniRozbor(t);
  assert.equal(a.dg, 'M54.36 Ischias; bederní krajina; M Parkinson, Lumboischialgie; Sy neklidných nohou');
  assert.deepEqual(a.opioidy, ['TTS fentanyl 25 - 1x 3 dny']);   // MATRIFEN z Rp. je tentýž fentanyl – nezdvojit
  assert.deepEqual(a.sos, ['Metamizol gtt 35 při bolestí']);
  assert.deepEqual(a.medikace, ['Madopar 200 0-0-1', 'Toviaz 4 mg 1-0-0', 'Alfa calci', 'Sortis 10 mg', 'Stacyl', 'Euthyrox 50', 'Nakom 5xdenně', 'chlorprotixen 0-0-1',
    'Gabagamma 300 mg 1-0- 1', 'konopí - 6/6- 2,5 g - tob', 'BISACODYL KRKA 5mg 1-0-0', 'HALOPERIDOL-RICHTER 2mg/ml 2x7 gtt']);
  // volný text pod diagnózou (věta) se do diagnóz nebere; dávkování „při bolesti, nejvýš po 4 h“ se nerozdělí
  const b = lokalniRozbor('Dg.: M54.59 Bolesti zad\nV rámci léčby bolesti proběhla telefonní konzultace pacienta s lékařem ohledně terapie\nTer.: Chronická terapie: Morphin 10 mg s.c. při bolesti, nejvýš po 4 h\nRp. 1x MAGNOSOLV 365mg por gra sol scc 30 Dávkování: 1-0-0');
  assert.equal(b.dg, 'M54.59 Bolesti zad');
  assert.deepEqual(b.opioidy, ['Morphin 10 mg s.c. při bolesti, nejvýš po 4 h']);
  assert.deepEqual(b.medikace, ['MAGNOSOLV 365mg 1-0-0'], 'Rp. ukončí seznam terapie a vezme se jako lék');
});
