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
  assert.equal(kapitoly.length, 21);   // 0.11.111: kapitola 21 Jednoduchý režim
  kapitoly.forEach((k, i) => assert.ok(k.startsWith(`## ${i + 1}. `), `pořadí kapitol: ${k}`));
  for (const [, src] of t.matchAll(/!\[[^\]]*\]\((\/napoveda\/img\/[^)]+)\)/g)) {
    assert.ok(fs.existsSync(new URL('../public' + src, import.meta.url)), `chybí obrázek ${src}`);
  }
  const o = lokalne('Jak vydám PIN pro pečující?');
  assert.match(o, /Kapitola: (8\. Telefon a PINy|11\. Lidé a týmy)/);   // obě kapitoly o PINech jsou správná odpověď; váhy slov se mění s textem nápovědy
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
  const v = normalizujSync({ leky: { sos: ['Morphin 10 mg s.c. – při bolesti', ' ', 'Midazolam 5 mg'], opioidy: ['MST Continus 30 mg – 1-0-1'], medikace: ['Furosemid 40 mg – 1-0-0'], vPeceDoma: true },
    pristiNavsteva: { kdy: '2026-10-24T09:30', lekar: 'MUDr. Malý', sestra: 'Jana Veselá', sluzba: 'Návštěva sestry', stav: 'Plánováno', misto: 'Zlín' }, klient: { portalKlientId: '12' } });
  assert.deepEqual(v.sos, ['Morphin 10 mg s.c. – při bolesti', 'Midazolam 5 mg']);
  assert.deepEqual([v.opioidy, v.medikace], [['MST Continus 30 mg – 1-0-1'], ['Furosemid 40 mg – 1-0-0']]);
  assert.equal(v.pristiNavsteva, '2026-10-24 09:30');
  assert.equal(v.pristiKdo, 'lékař MUDr. Malý, sestra Jana Veselá');
  assert.equal(v.pristiPozn, 'Návštěva sestry · Plánováno · Zlín');
  assert.equal(v.portalKlientId, 12);
  const bez = normalizujSync({ leky: {}, pristiNavsteva: null, kalendarChyba: 'Kalendář FK neodpovídá' });
  // 0.11.88: místo pacienta – bez pole kde se nemá přepsat (starší PéčeDoma), s polem ano
  assert.equal(bez.kdeZname, false);
  const sKde = normalizujSync({ leky: {}, kde: ' DS  C ' }); assert.equal(sKde.kde, 'DS C'); assert.equal(sKde.kdeZname, true);
  const prazdne = normalizujSync({ leky: {}, kde: '' }); assert.equal(prazdne.kde, null); assert.equal(prazdne.kdeZname, true);
  assert.deepEqual([bez.sos, bez.opioidy, bez.medikace, bez.pristiNavsteva, bez.pristiKdo, bez.kalendarChyba], [[], [], [], null, null, 'Kalendář FK neodpovídá']);
});

test('videohovor: název místnosti a odkaz do Jitsi', async () => {
  process.env.KP_JITSI_URL = 'https://jitsi.example.org/';
  const { novaMistnost, odkazDoHovoru, videoServer } = await import('../src/video.js');
  const { config } = await import('../src/config.js');
  config.video.server = 'https://jitsi.example.org/';
  assert.equal(videoServer(), 'https://jitsi.example.org');
  const m = novaMistnost('P-0017');
  assert.match(m, /^kp-p0017-[a-z0-9]{10}$/);
  assert.notEqual(m, novaMistnost('P-0017'));
  const o = odkazDoHovoru(m, 'MUDr. Petra "Ukázková"');
  assert.ok(o.startsWith('https://jitsi.example.org/' + m + '#config.prejoinPageEnabled=false'));
  assert.ok(o.includes('userInfo.displayName=' + encodeURIComponent(JSON.stringify('MUDr. Petra "Ukázková"'))));
  assert.equal(odkazDoHovoru('../x', 'a'), null);
  config.video.server = '';
  assert.equal(odkazDoHovoru(m, 'a'), null);
});

test('zpráva v PDF (0.11.120): text z PDF a lokální rozbor formátu Medistaru (Dg.: na řádku, léky oddělené čárkou, SOS)', async () => {
  const { textZPdf } = await import('../src/pdftext.js');
  const t = await textZPdf(fs.readFileSync(new URL('./zprava-medistar-ukazka.pdf', import.meta.url)));   // smyšlená zpráva
  assert.match(t, /Dg\.: C50\.9 Zhoubný novotvar prsu, I50\.0/);
  const r = lokalniRozbor(t);
  assert.equal(r.dg, 'C50.9 Zhoubný novotvar prsu; I50.0 Městnavé srdeční selhání', 'diagnózy i s kódy MKN');
  assert.equal(r.alergie, 'penicilin');
  assert.deepEqual(r.medikace, ['Furosemid 40 mg 1-0-0', 'MST Continus 30 mg 1-0-1']);
  assert.deepEqual(r.sos, ['Při bolesti Morphin 10 mg s.c.']);
  assert.ok(!r.medikace.some((x) => /MUDr/.test(x)), 'podpis lékaře není lék');
});

test('Medistar dekurz (0.11.122): diagnózy, opioidy, chronická terapie, SOS a funkční stav; anonymizace nebere nadpisy jako jména', async () => {
  const { anonymizuj } = await import('../src/anonym.js');
  const { slozStranky } = await import('../src/pdftext.js');
  const surovy = fs.readFileSync(new URL('./zprava-medistar-dekurz.txt', import.meta.url), 'utf8');   // smyšlený dekurz
  const t = slozStranky(surovy.split(/^\d\n/m));
  assert.equal((t.match(/IČO: 12345678/g) || []).length, 1, 'hlavička zařízení na další straně vynechána');
  const a = anonymizuj(t, { jmeno: 'Jan', prijmeni: 'Testovací', rc: '450101/123' });
  assert.match(a.text, /\nDiagnóza: Chronická/, '„…bez sestry⏎Diagnóza:“ není jméno');
  assert.match(a.text, /\nZodpovědný lékař:/, '„Dcera⏎Zodpovědný“ není jméno');
  assert.doesNotMatch(a.text, /02-11-2026|Testovací|450101/);
  const r = lokalniRozbor(a.text);
  assert.equal(r.dg, 'R52.1; Chronická obstrukční plicní nemoc, srdeční selhání');
  assert.deepEqual(r.opioidy, ['Oxycontin 20 mg 1-0-1']);
  assert.deepEqual(r.medikace, ['Furosemid 40 mg 1-0-0', 'Berodual inh. 2-2-2'], 'chronická terapie, bez opioidu a bez opakování');
  assert.deepEqual(r.sos, ['Novalgin tbl. při bolesti 3-4 x denně']);
  assert.equal(r.funkce, 'PPS 40 %; pohyblivost: převážně na lůžku; soběstačnost: nutná pomoc s většinou činností');
  assert.equal(r.citace.cil, 'Probíhá zajištění komplexní paliativní péče MDT.');
  assert.ok(r.chybi.some((x) => /Pečující osoba \(Dcera\)/.test(x)));
});

test('PDF bez textové vrstvy (Microsoft Print to PDF, sken): text se rozpozná OCR přímo na serveru', { timeout: 120000 }, async () => {
  const { textZeZpravy, ukonciOcr } = await import('../src/pdftext.js');
  let z;
  try { z = await textZeZpravy(fs.readFileSync(new URL('./zprava-medistar-bez-textu.pdf', import.meta.url)), 'application/pdf'); }   // smyšlený dekurz jako obrázek
  finally { await ukonciOcr(); }
  assert.equal(z.ocr, true);
  assert.equal(z.stran, 2);
  const r = lokalniRozbor(z.text);
  assert.match(r.dg, /R52\.1/);
  assert.deepEqual(r.opioidy, ['Oxycontin 20 mg 1-0-1']);
  assert.ok(r.medikace.some((x) => /^Furosemid 40 mg/.test(x)));
  assert.ok(r.sos.some((x) => /^Novalgin/.test(x)));
});
