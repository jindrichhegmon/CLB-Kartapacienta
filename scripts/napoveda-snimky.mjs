/**
 * Snímky obrazovek do nápovědy (public/napoveda/img/*.png) – se smyšlenými daty, bez databáze.
 * Spustí statický server nad public/ s napodobeným API (stejné tvary odpovědí jako src/routes/*) a obrazovky nafotí Playwrightem.
 *   node scripts/napoveda-snimky.mjs            (Playwright: npm i -g playwright, nebo PLAYWRIGHT_MODULE=/cesta/k/playwright/index.mjs)
 * Pak zmenšení na 256 barev: python3 scripts/napoveda-zmensit.py
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { pbkdf2Sync, randomBytes, createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VYSTUP = path.join(KOREN, 'public', 'napoveda', 'img');
const PORT = 3901;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
fs.mkdirSync(VYSTUP, { recursive: true });

/* ---------------- smyšlená data ---------------- */
const TENANT = 'ABCDEFGH12345678';
const dnes = new Date(); const den = (d) => { const x = new Date(dnes); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const cas = (d, hm) => `${den(d)} ${hm}`;
const posk = [
  { id: 1, nazev: 'Hospic Ukázka', ico: '12345678', icp: '', typ: 'HOSPIC', smiBytGarant: true, telefon24: '777 100 200', adresa: 'Nemocniční 1, Zlín', aktivni: true },
  { id: 2, nazev: 'Praktický lékař MUDr. Vzorová', ico: '87654321', icp: '72100123', typ: 'PL', smiBytGarant: true, telefon24: '577 000 111', adresa: 'Náměstí 5, Zlín', aktivni: true },
  { id: 3, nazev: 'Domov Pohoda', ico: '11223344', icp: '', typ: 'DOMOV', smiBytGarant: false, telefon24: '577 222 333', adresa: 'Zahradní 8, Zlín', aktivni: true },
  { id: 4, nazev: 'Krajská nemocnice – interna', ico: '27661989', icp: '72000001', typ: 'NEMOCNICE', smiBytGarant: true, telefon24: '577 552 000', adresa: 'Havlíčkovo nábř. 600, Zlín', aktivni: true },
];
const planData = {
  cil: 'symptom', limity: ['KPR', 'Umělá plicní ventilace', 'Hospitalizace'],
  doklad: { dvp: true, datum: den(-40), original: 'u dcery, obálka na lednici', zprava: 'zápis o rozhovoru s pacientkou a dcerou', pouceni: true, overenyPodpis: true, prijeti: '' },
  dg: 'C50 karcinom prsu s metastázami do kostí a jater; chronické srdeční selhání', funkce: 'PPS 40 % – většinu dne na lůžku, s pomocí do křesla',
  alergie: 'penicilin',
  sos: ['Morphin 10 mg s.c. při bolesti nebo dušnosti, nejvýš po 4 h', 'Midazolam 5 mg s.c. při neklidu', 'Paracetamol 1 g p.o. při horečce'],
  medikace: ['MST Continus 30 mg 1-0-1', 'Furosemid 40 mg 1-0-0', 'Pantoprazol 20 mg 1-0-0', 'Lactulosa 15 ml večer'],
};
const plan = { verze: 3, data: planData, platnostDo: den(70), podepsal: 'MUDr. Petra Ukázková', podepsalId: 1, typ: 'ZMENA', vytvoreno: cas(-7, '10:24') };
const kontakty = [
  { id: 1, jmeno: 'Jana Zkušební, dcera (určená osoba)', tel: '777 000 321', skupina: 'ROZHODUJE', pozn: 'volat jako první', poradi: 1 },
  { id: 2, jmeno: 'Petr Zkušební, syn', tel: '777 000 654', skupina: 'INFORMOVAT', pozn: '', poradi: 2 },
  { id: 3, jmeno: 'Hospic Ukázka – sestra 24/7', tel: '777 100 200', skupina: 'PECUJE', pozn: 'nonstop', poradi: 3 },
  { id: 4, jmeno: 'MUDr. Vzorová, praktická lékařka', tel: '577 000 111', skupina: 'PECUJE', pozn: 'ordinační hodiny', poradi: 4 },
];
const denik = [
  { uuid: 'a1', typ: 'Založení', text: 'Průkaz založen, plán péče verze 1.', autor: 'MUDr. Petra Ukázková', role: 'lekar', cas: cas(-21, '09:10'), overeno: true },
  { uuid: 'a2', typ: 'Systém', text: 'Průkaz nahrán do telefonu u pacienta (+420 777 000 123).', autor: 'telefon 7', role: 'system', cas: cas(-21, '09:32'), overeno: true },
  { uuid: 'a3', typ: 'Návštěva hospice', text: 'Kontrola bolesti, úprava dávky MST na 30 mg 1-0-1.', autor: 'Sestra Lucie Příkladná', role: 'sestra', cas: cas(-7, '10:05'), overeno: true },
  { uuid: 'a4', typ: 'Podán SOS lék', text: 'V noci bolest 7/10, podán Morphin 10 mg s.c., po 30 min úleva.', autor: 'Jana Zkušební', role: 'rodina', cas: cas(-2, '02:40'), overeno: true },
  { uuid: 'a5', typ: 'Pozorování rodiny', text: 'Klidný den, pila čaj, chvíli seděla v křesle.', autor: 'Jana Zkušební', role: 'rodina', cas: cas(-1, '18:15'), overeno: true },
];
const tym = [
  { id: 1, poskytovatelId: 1, nazev: 'Hospic Ukázka', typ: 'HOSPIC', telefon24: '777 100 200', role: 'GARANT', od: den(-21) },
  { id: 2, poskytovatelId: 2, nazev: 'Praktický lékař MUDr. Vzorová', typ: 'PL', telefon24: '577 000 111', role: 'LEKAR', od: den(-21) },
  { id: 3, poskytovatelId: 3, nazev: 'Domov Pohoda', typ: 'DOMOV', telefon24: '577 222 333', role: 'PECE', od: den(-10) },
];
// lidé a týmy pracovišť (zapsaní jednou, k pacientovi přiřazení)
const os = (id, ps, posk, typ, tym, jmeno, role, telefon, zdroj = 'RUCNE', pacientu = 2) => ({ id, poskytovatelId: ps, poskytovatel: posk, typPoskytovatele: typ, tym, jmeno, role, telefon, email: '', pozn: '', maPin: 1, pinVydan: cas(-20, '10:00'), zdroj, aktivni: 1, pacientu });
const lide = [
  os(1, 1, 'Hospic Ukázka', 'HOSPIC', 'Tým Zlín', 'MUDr. Petra Ukázková', 'LEKAR', '777 100 201', 'PECEDOMA', 3),
  os(2, 1, 'Hospic Ukázka', 'HOSPIC', 'Tým Zlín', 'Sestra Lucie Příkladná', 'HOSPIC', '777 100 202', 'PECEDOMA', 3),
  os(3, 1, 'Hospic Ukázka', 'HOSPIC', 'Tým Zlín', 'Bc. Tereza Vzorná', 'HOSPIC', '777 100 203', 'PECEDOMA', 2),
  os(4, 1, 'Hospic Ukázka', 'HOSPIC', 'Tým Otrokovice', 'MUDr. Karel Modelový', 'LEKAR', '777 100 204', 'CSV', 1),
  os(5, 1, 'Hospic Ukázka', 'HOSPIC', 'Tým Otrokovice', 'Jitka Ukázková, pečovatelka', 'HOSPIC', '777 100 205', 'CSV', 1),
  os(6, 2, 'Praktický lékař MUDr. Vzorová', 'PL', null, 'MUDr. Eva Vzorová', 'PL', '577 000 111', 'RUCNE', 4),
  os(7, 3, 'Domov Pohoda', 'DOMOV', 'Oddělení A', 'Sestra Marta Pokojná', 'SESTRA', '577 222 301', 'CSV', 5),
  os(8, 3, 'Domov Pohoda', 'DOMOV', 'Oddělení A', 'Pavla Dobrá, pečovatelka', 'SESTRA', '577 222 302', 'CSV', 5),
  os(9, 3, 'Domov Pohoda', 'DOMOV', 'Oddělení B', 'Sestra Hana Klidná', 'SESTRA', '577 222 303', 'CSV', 3),
];
const prirazeni = [1, 2, 6, 7, 8].map((oid) => { const o = lide.find((x) => x.id === oid); return { id: 100 + oid, osobaId: oid, jmeno: o.jmeno, role: o.role, tym: o.tym, poskytovatelId: o.poskytovatelId, poskytovatel: o.poskytovatel, od: den(-20), maPin: 1 }; });
const pdTym = [
  { id: 11, jmeno: 'Bc. Tereza Vzorná', role: 'sestra', telefon: '777 100 203', login: 'tereza', externiId: 'pd:11', nacteno: true },
  { id: 12, jmeno: 'MUDr. Petra Ukázková', role: 'lekar,casemanager', telefon: '777 100 201', login: 'petra', externiId: 'pd:12', nacteno: true },
  { id: 13, jmeno: 'Sestra Iveta Nová', role: 'sestra', telefon: '777 100 206', login: 'iveta', externiId: 'pd:13', nacteno: false },
  { id: 14, jmeno: 'MUDr. Ondřej Příklad', role: 'lekar', telefon: '777 100 207', login: 'ondrej', externiId: 'pd:14', nacteno: false },
  { id: 15, jmeno: 'Jindřich Správce', role: 'admin', telefon: '', login: 'spravce', externiId: 'pd:15', nacteno: false },
];
const garance = [{ id: 1, poskytovatelId: 1, nazev: 'Hospic Ukázka', stav: 'PLATNA', lekar: 'MUDr. Petra Ukázková', navrhl: null, navrzeno: null, od: cas(-21, '09:10'), do: null, poznamka: null }];
const pacient = { id: 1, kod: 'P-0007', jmeno: 'Marie', prijmeni: 'Zkušební', rc: '415203/1234', datumNarozeni: '1941-02-03', rok: 1941, pohlavi: 'žena', pojistovna: '111',
  adresa: 'Lipová 12, Zlín', pobyt: 'doma', telefonKarty: '+420 777 000 123', stav: 'AKTIVNI', souhlas: `potvrzeno ${den(-21)} · MUDr. Petra Ukázková`, zalozeno: cas(-21, '09:10'), uzavreno: null, duvodUzavreni: null };
const detail = {
  pacient, plan,
  verze: [{ verze: 3, typ: 'ZMENA', podepsal: 'MUDr. Petra Ukázková', vytvoreno: cas(-7, '10:24'), platnostDo: den(70), poznamka: 'úprava SOS medikace' },
    { verze: 2, typ: 'REVIZE', podepsal: 'MUDr. Petra Ukázková', vytvoreno: cas(-14, '11:00'), platnostDo: den(60), poznamka: null },
    { verze: 1, typ: 'ZALOZENI', podepsal: 'MUDr. Petra Ukázková', vytvoreno: cas(-21, '09:10'), platnostDo: den(60), poznamka: null }],
  kontakty, tym, garance,
  zarizeni: [{ id: 9, stitek: 'telefon pacienta', stav: 'SPAROVANO', sparovano: cas(-5, '11:02'), sync: cas(0, '07:40'), baterie: null, verzeAplikace: 'pacient-0.5.0', fronta: 0, verzePlanu: 3, kod: null, kodPlatnost: null, telefon: '+420604000777', rezim: 'PACIENT' },
    { id: 7, stitek: null, stav: 'SPAROVANO', sparovano: cas(-21, '09:32'), sync: cas(0, '08:12'), baterie: 76, verzeAplikace: 'karta-0.5.0', fronta: 0, verzePlanu: 3, kod: null, kodPlatnost: null, telefon: '+420777000123', rezim: 'ZAPUJCENY' }],
  odPacienta: [{ id: 1, cas: cas(-1, '19:30'), polozky: [
    { druh: 'PRANI', nazev: 'Moje hodnoty a přání', obsah: 'Co je pro mě důležité: zůstat doma s dcerou a vnoučaty, nemít bolesti.\nČeho se obávám: dušení a převozu do nemocnice v noci.\nCo chci, aby lékaři zohlednili: raději úleva než léčba za každou cenu.', puvod: 'údaj pacienta – jak si pamatuji rozhovor se zdravotníkem (MUDr. Ukázková, ' + den(-30).split('-').reverse().map(Number).join('. ') + ')', aktualizovano: cas(-1, '19:20') },
    { druh: 'LEKY', nazev: 'Léky, které užívám', obsah: 'MST Continus 30 mg – ráno a večer · aktualizováno ' + den(-1).split('-').reverse().map(Number).join('. ') + '\nFurosemid 40 mg – jen ob den (otoky menší)', puvod: 'údaj pacienta', aktualizovano: cas(-1, '19:25') }] }],
  piny: [{ id: 1, jmeno: 'Jana Zkušební (dcera)', role: 'RODINA', vytvoreno: den(-21) }], lide: prirazeni,
  denik: [...denik].reverse(), dokumenty: [{ id: 1, typ: 'DVP', nazev: 'Dříve vyslovené přání', kdeOriginal: 'u dcery', mime: 'application/pdf', velikost: 120000, vytvoreno: cas(-21, '09:20'), datum: den(-40), pracoviste: 'Hospic Ukázka' },
    { id: 2, typ: 'ZPRAVA', nazev: 'Propouštěcí zpráva – interna', kdeOriginal: '', mime: 'application/pdf', velikost: 230000, vytvoreno: cas(-22, '15:00'), datum: den(-23), pracoviste: 'Krajská nemocnice – interna' }],
  pristupy: [{ cas: cas(0, '08:15'), kdo: 'MUDr. Petra Ukázková', akce: 'zobrazení průkazu', detail: null }, { cas: cas(-2, '02:41'), kdo: 'telefon', akce: 'synchronizace', detail: '1 zápis' }],
  op: { vidi: true, aktivni: true, lekar: true, garant: true, zapis: true, prijmoutGaranci: false, navrhGaranceId: null }, smsDostupne: true,
};
const pacienti = [
  { id: 1, kod: 'P-0007', jmeno: 'Marie', prijmeni: 'Zkušební', rok: 1941, pobyt: 'doma', stav: 'AKTIVNI', zalozeno: cas(-21, '09:10'), verze: 3, platnostDo: den(70), cil: 'symptom', garantId: 1, garant: 'Hospic Ukázka', garantTyp: 'HOSPIC', garantOd: cas(-21, '09:10'), sync: cas(0, '08:12'), baterie: 76, telefonu: 1, posledniKrize: null, posledniZapis: cas(-1, '18:15') },
  { id: 2, kod: 'P-0008', jmeno: 'Josef', prijmeni: 'Příkladný', rok: 1938, pobyt: 'Domov Pohoda, pokoj 12', stav: 'AKTIVNI', zalozeno: cas(-50, '10:00'), verze: 2, platnostDo: den(9), cil: 'limited', garantId: 1, garant: 'Hospic Ukázka', garantTyp: 'HOSPIC', garantOd: cas(-50, '10:00'), sync: cas(0, '07:50'), baterie: 15, telefonu: 1, posledniKrize: 'Zhoršení stavu', posledniZapis: cas(0, '06:30') },
  { id: 3, kod: 'P-0009', jmeno: 'Anna', prijmeni: 'Vzorová', rok: 1950, pobyt: 'doma', stav: 'AKTIVNI', zalozeno: cas(-3, '14:00'), verze: 1, platnostDo: den(88), cil: 'symptom', garantId: 4, garant: 'Krajská nemocnice – interna', garantTyp: 'NEMOCNICE', garantOd: cas(-3, '14:00'), sync: null, baterie: null, telefonu: 0, posledniKrize: null, posledniZapis: cas(-3, '14:00') },
];
const upozorneni = [
  { uroven: 'crit', pacientId: 2, text: 'Příkladný Josef: probíhá zhoršení stavu' },
  { uroven: 'warn', pacientId: 2, text: 'Příkladný Josef: revize plánu do 9 dní' },
  { uroven: 'warn', pacientId: 2, text: 'Příkladný Josef: baterie telefonu 15 %' },
  { uroven: 'info', pacientId: 3, text: 'Vzorová Anna: průkaz zatím není v žádném telefonu' },
];
const uzivatele = [
  { id: 1, jmeno: 'MUDr. Petra Ukázková', login: 'petra.ukazkova', email: 'petra@hospic-ukazka.cz', telefon: '777 100 201', role: ['admin', 'lekar'], clk: '1234567', aktivni: true, posledni: cas(0, '08:10'), poskytovatelId: 1, poskytovatel: 'Hospic Ukázka', prvniHeslo: '' },
  { id: 2, jmeno: 'Sestra Lucie Příkladná', login: 'lucie.prikladna', email: '', telefon: '777 100 202', role: ['sestra'], clk: '', aktivni: true, posledni: cas(-1, '16:40'), poskytovatelId: 1, poskytovatel: 'Hospic Ukázka', prvniHeslo: '' },
  { id: 3, jmeno: 'MUDr. Eva Vzorová', login: 'eva.vzorova', email: '', telefon: '', role: ['lekar'], clk: '7654321', aktivni: true, posledni: null, poskytovatelId: 2, poskytovatel: 'Praktický lékař MUDr. Vzorová', prvniHeslo: 'Kx7-pQ2m-Lr9' },
];
// PIN 123456 pro karta (stejný algoritmus jako src/crypto.js hashPin)
const salt = randomBytes(16).toString('hex');
const balik = {
  pacient: { kod: 'P-0007', jmeno: 'Marie', prijmeni: 'Zkušební', rok: 1941, pohlavi: 'žena', pobyt: 'doma', stav: 'AKTIVNI' },
  plan, garant: { poskytovatel: 'Hospic Ukázka', typ: 'HOSPIC', telefon24: '777 100 200', lekar: 'MUDr. Petra Ukázková', lekarTelefon: '777 100 201' },
  kontakty: kontakty.map((k) => ({ id: k.id, jmeno: k.jmeno, tel: k.tel, skupina: k.skupina.toLowerCase(), pozn: k.pozn })),
  tym: tym.map((t) => ({ nazev: t.nazev, typ: t.typ, role: t.role, tel: t.telefon24 })),
  piny: [{ id: 'o2', jmeno: 'Sestra Lucie Příkladná', role: 'hospic', salt, hash: pbkdf2Sync('123456', Buffer.from(salt, 'hex'), 120000, 32, 'sha256').toString('hex'), iterace: 120000 }],
  denik, serverCas: new Date().toISOString(),
};
// vlastní telefon pacienta: bez PINů týmu a bez deníku (src/kp.js balikProZarizeni, rezim PACIENT)
const balikPacient = { ...balik, piny: [], denik: [], rezim: 'PACIENT' };
const sdileno = [];
const tenanti = [
  { id: TENANT, nazev: 'Hospic Ukázka, z. ú.', ico: '12345678', nazevSite: 'Paliativní síť Ukázkového kraje', kp: true, pacientu: 3, poskytovatelu: 4, uzivatelu: 3, telefonu: 2, sync: cas(0, '08:12'), vytvoreno: cas(-60, '09:00'), odkaz: `https://kartapacienta.example/centrala/?t=${TENANT}` },
  { id: '87654321VZOROVAE', nazev: 'MUDr. Eva Vzorová s.r.o.', ico: '87654321', nazevSite: '', kp: false, pacientu: 0, poskytovatelu: 0, uzivatelu: 0, telefonu: 0, sync: null, vytvoreno: cas(-400, '09:00'), odkaz: '' },
];
const typy = { NEMOCNICE: 'Nemocnice', HOSPIC: 'Mobilní hospic', AMBULANCE: 'Paliativní ambulance', PL: 'Praktický lékař', DOMOV: 'Domov pro seniory', ZZS: 'ZZS', JINY: 'Jiný' };
const pecedomaJson = { format: 'CLB-Kartapacienta/pacient', verze: 1, zdroj: 'PéčeDoma', vytvoreno: new Date().toISOString(),
  puvod: { famicuraKlientId: 'x', portalKlientId: 12, posledniPM103: den(-5), zodpovednyLekar: 'MUDr. Petra Ukázková', prevzato: ['údaje klienta', 'diagnózy z PM103', 'léky', 'kontakty'] },
  pacient: { jmeno: 'Anna', prijmeni: 'Vzorová', rc: '505512/1234', datumNarozeni: '1950-05-12', rok: 1950, pohlavi: 'žena', pojistovna: '211', adresa: 'Polní 3, Zlín', pobyt: 'doma', telefon: '777 000 456', email: '' },
  plan: { cil: '', limity: [], doklad: {}, dg: 'C25 karcinom pankreatu', funkce: 'PPS 50 %', alergie: '', sos: ['Morphin 5 mg s.c. při bolesti'], medikace: ['Oxycontin 20 mg 1-0-1', 'Metoclopramid 10 mg při nauzee'] },
  kontakty: [{ jmeno: 'Karel Vzor', tel: '777 000 789', skupina: 'PECUJE', pozn: 'manžel' }], doplnit: ['cíl péče', 'limitace (co se neprovádí)', 'dříve vyslovené přání (DVP)'] };

/* ---------------- server s napodobeným API ---------------- */
const app = express();
app.use(express.json());
const j = (o) => (req, res) => res.json({ ok: true, ...(typeof o === 'function' ? o(req) : o) });
app.get('/api/napoveda', j({ text: fs.readFileSync(path.join(KOREN, 'napoveda', 'napoveda.md'), 'utf8') }));
app.post('/api/napoveda/dotaz', j({ text: 'Telefon spárujete v detailu pacienta v záložce Telefon a PINy:\n\n1. Zkontrolujte, že je u pacienta vyplněný Telefon s kartou (záložka Údaje).\n2. Klikněte na Poslat odkaz SMS na +420… – nebo na Spárovat telefon a na telefonu naskenujte QR kód tlačítkem Načíst QR kód fotoaparátem.\n3. Telefon zadá své číslo; jiné číslo server odmítne.\n\nKód platí 15 minut a jen jednou.\n\nKapitola: 8. Telefon a PINy\nKapitola: 13. Karta na telefonu – instalace a spárování' }));
app.post('/api/c/login', j({ session: 'ukazka' }));
app.get('/api/c/ja', j({ ja: { jmeno: 'MUDr. Petra Ukázková', login: 'petra.ukazkova', poskytovatel: 'Hospic Ukázka', poskytovatelId: 1, role: ['admin', 'lekar'], musiZmenitHeslo: false }, nazevSite: 'Paliativní síť Ukázkového kraje', nastaveni: { intervalRevize: 3 }, verejnaAdresa: 'https://kartapacienta.example', verze: '0.5.0', ai: true }));
app.get('/api/c/poskytovatele', j({ poskytovatele: posk }));
app.get('/api/c/prehled', j((req) => (req.query.stav === 'UZAVRENY' ? { pacienti: [], upozorneni: [] } : { pacienti, upozorneni })));
app.get('/api/c/pacient/:id', j(detail));
app.post('/api/c/pacient/:id/parovat', j({ zarizeniId: 8, kod: 'TYJRRRQH', tenant: TENANT, platnost: new Date(Date.now() + 15 * 60e3).toISOString(), odkaz: `https://kartapacienta.example/karta/#p=${TENANT}.TYJRRRQH`, telefonKarty: '+420 777 000 123', smsDostupne: true, smsDuvod: '', sms: null }));
app.post('/api/c/pacient/:id/pacientovi', j((req) => ({ zarizeniId: 10, kod: 'MPK4R7ZD', tenant: TENANT, platnost: new Date(Date.now() + 72 * 3600e3).toISOString(), odkaz: `https://kartapacienta.example/pacient/#p=${TENANT}.MPK4R7ZD`, telefon: '+420 604 000 777', smsDostupne: true, smsDuvod: '', sms: req.body.sms ? { ok: true } : null })));
app.get('/api/c/uzivatele', j({ uzivatele }));
app.get('/api/c/lide', j({ lide, role: { LEKAR: 'Lékař', PL: 'Praktický lékař', HOSPIC: 'Hospic', SESTRA: 'Sestra DPS' }, smsDostupne: true }));
app.get('/api/c/lide/pecedoma', j({ lide: pdTym }));
app.post('/api/c/osoba', j({ id: 99, pin: '482913', sms: null }));
app.post('/api/c/lide/import', j((req) => ({ pridano: req.body.radky.length, aktualizovano: 0, chyby: [], piny: req.body.radky.map((r, i) => ({ ...r, pin: String(305117 + i * 91813).slice(0, 6), sms: req.body.sms ? { ok: true } : null })) })));
app.post('/api/c/pacient/:id/lide', j({ zmeny: 1 }));
// kód lékaře dne – stejný výpočet jako src/crypto.js kodDne (telefon ho ověří offline z tajemství '0011…')
const TAJEMSTVI = '00112233445566778899aabbccddeeff00112233';
const kodDne = (datum) => { const h = createHmac('sha256', Buffer.from(TAJEMSTVI, 'hex')).update('kod-dne:' + datum).digest(); return String((((h[0] & 0x7f) << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) % 1000000).padStart(6, '0'); };
const dnesLokalne = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
app.get('/api/c/pacient/:id/kod-lekare', j({ kod: kodDne(dnesLokalne()), platiDo: den(1) + 'T00:00:00+02:00', lekar: 'MUDr. Petra Ukázková' }));
app.get('/api/c/zarizeni', j({ zarizeni: [] }));
app.get('/api/c/audit', j({ audit: [], ai: [] }));
app.post('/api/d/parovat', j((req) => (req.body.rezim === 'PACIENT'
  ? { token: `${TENANT}.9.ukazka`, tajemstvi: null, zarizeniId: 9, telefon: '+420 604 000 777', rezim: 'PACIENT', balik: balikPacient }
  : { token: `${TENANT}.7.ukazka`, tajemstvi: TAJEMSTVI, zarizeniId: 7, telefon: '+420 777 000 123', rezim: 'ZAPUJCENY', balik })));
app.post('/api/d/sync', j((req) => (String(req.headers.authorization || '').includes('.9.') ? { potvrzeno: [], odmitnuto: [], balik: balikPacient } : { potvrzeno: (req.body.fronta || []).map((e) => e.uuid), odmitnuto: [], balik })));
app.post('/api/d/sdilet', j((req) => { sdileno.push(req.body); return { cas: new Date().toISOString() }; }));
app.post('/api/admin/login', j({ session: 'ukazka' }));
app.get('/api/admin/tenanti', j({ tenanti, typy }));
app.post('/api/admin/spravci', j({ uzivatele: [] }));
app.use('/api', (req, res) => res.status(404).json({ ok: false, chyba: 'neznámé: ' + req.path }));
app.use(express.static(path.join(KOREN, 'public'), { extensions: ['html'] }));
const srv = app.listen(PORT);
const URL = `http://localhost:${PORT}`;

/* ---------------- focení ---------------- */
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const chyby = [];
async function stranka({ mobil = false, session = null, init = null } = {}) {
  const ctx = await b.newContext(mobil ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => chyby.push(e.message));
  await p.addInitScript(([s, t]) => { try { localStorage.setItem('kp_tenant', t); if (s) { sessionStorage.setItem('kp_session', s); sessionStorage.setItem('kp_tenanti_session', s); } } catch { /* */ } }, [session, TENANT]);
  if (init) await p.addInitScript(init);
  return p;
}
const foto = async (p, jmeno, { cela = false, vyska = null } = {}) => {
  await p.evaluate(() => { scrollTo(0, 0); document.querySelectorAll('.box').forEach((b) => (b.scrollTop = 0)); });
  await p.waitForTimeout(350);
  const vp = p.viewportSize();
  const opt = { path: path.join(VYSTUP, jmeno + '.png'), animations: 'disabled' };
  if (cela || vyska) { opt.fullPage = true; if (vyska) opt.clip = { x: 0, y: 0, width: vp.width, height: vyska }; }
  await p.screenshot(opt); console.log('  ✓', jmeno);
};
const klik = async (p, sel) => { await p.waitForSelector(sel); await p.click(sel); };

console.log('Centrální aplikace');
let p = await stranka();
await p.goto(`${URL}/centrala/?t=${TENANT}`); await p.waitForSelector('#l_l');
await p.fill('#l_l', 'petra.ukazkova'); await p.fill('#l_h', '••••••••••');
await foto(p, 'c-prihlaseni');
await p.close();

p = await stranka({ session: 'ukazka' });
await p.goto(`${URL}/centrala/`); await p.waitForSelector('tr[data-id]');
await foto(p, 'c-pacienti');
await klik(p, '.nav button[data-v="novy"]'); await p.waitForSelector('#w_json', { state: 'attached' });
await foto(p, 'c-novy-1');
await p.setInputFiles('#w_json', { name: 'karta-pacienta-vzorova.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pecedomaJson)) });
await p.waitForSelector('#n_tk', { timeout: 8000 }).catch(async (e) => { console.error('toast:', await p.textContent('#toast').catch(() => '')); throw e; }); await p.waitForTimeout(3500); // toast zmizí
await foto(p, 'c-novy-2', { vyska: 1100 });
await klik(p, '.nav button[data-v="pacienti"]'); await klik(p, 'tr[data-id="1"]'); await p.waitForSelector('.tabs [data-t]');
const zalozka = async (t, jmeno, o) => { await klik(p, `.tabs [data-t="${t}"]`); await p.waitForTimeout(200); await foto(p, jmeno, o); };
await zalozka('karta', 'c-karta', { vyska: 1000 });
await zalozka('plan', 'c-plan', { vyska: 1050 });
await zalozka('denik', 'c-denik');
await zalozka('kontakty', 'c-kontakty');
await zalozka('tym', 'c-tym', { vyska: 900 });
await zalozka('telefon', 'c-telefon', { vyska: 1000 });
await klik(p, '#lide_prirad'); await p.waitForSelector('[data-celytym]');
await p.click('[data-os="3"]');
await p.setViewportSize({ width: 1200, height: 1060 }); await foto(p, 'c-prirazeni'); await p.setViewportSize({ width: 1200, height: 760 });
await p.evaluate(() => KP.closeModal());
await klik(p, '#parovat'); await p.waitForSelector('#pr_sms');
await foto(p, 'c-parovani', { vyska: 1000 });
await p.evaluate(() => KP.closeModal());
await klik(p, '#pacientovi'); await p.waitForSelector('#pz_t'); await p.fill('#pz_t', '+420 604 000 777');
await klik(p, '#pz_qr'); await p.waitForSelector('#pz_hot');
await p.setViewportSize({ width: 1200, height: 1000 }); await foto(p, 'c-pacientovi'); await p.setViewportSize({ width: 1200, height: 760 });
await p.evaluate(() => KP.closeModal());
await zalozka('dok', 'c-dokumenty');
await klik(p, '.tabs [data-t="karta"]'); await p.waitForSelector('details summary');
await p.evaluate(() => document.querySelector('details').open = true);
await p.evaluate(() => { const el = [...document.querySelectorAll('.panel-h h2')].find((h) => h.textContent === 'Od pacienta').closest('.panel'); el.scrollIntoView(); });
await p.waitForTimeout(300); await p.screenshot({ path: path.join(VYSTUP, 'c-od-pacienta.png') }); console.log('  ✓ c-od-pacienta');
await zalozka('udaje', 'c-udaje', { vyska: 900 });
await klik(p, '.nav button[data-v="sprava"]'); await p.waitForSelector('#p_new');
await foto(p, 'c-pracoviste');
await klik(p, '[data-st="uziv"]'); await p.waitForSelector('#u_new');
await foto(p, 'c-uzivatele');
await klik(p, '.nav button[data-v="lide"]'); await p.waitForSelector('tr[data-oid]');
await p.selectOption('#lf', ''); await p.waitForSelector('tr[data-oid="9"]');
await foto(p, 'c-lide', { vyska: 1150 });
await klik(p, '#l_pd'); await p.waitForSelector('#im_ok');
await p.setViewportSize({ width: 1200, height: 900 }); await foto(p, 'c-lide-import');
await klik(p, '#im_ok'); await p.waitForSelector('#pn_tisk'); await p.waitForTimeout(3600);
await foto(p, 'c-piny'); await p.setViewportSize({ width: 1200, height: 760 });
await p.evaluate(() => KP.closeModal());
await klik(p, 'tr[data-oid="2"]'); await p.waitForSelector('#os_ok');
await foto(p, 'c-osoba');
await p.evaluate(() => KP.closeModal());
await klik(p, '.nav button[data-v="pacienti"]'); await p.waitForSelector('tr[data-id]');
await klik(p, '[data-kp="vzhled"]'); await p.waitForSelector('.vzhledy');
await foto(p, 'c-vzhled');
await p.evaluate(() => KP.closeModal());
await klik(p, '.hlp-fab'); await p.waitForSelector('.hlp-chat textarea');
await p.fill('.hlp-chat textarea', 'Jak spáruji telefon s kartou?'); await p.keyboard.press('Enter');
await p.waitForSelector('.hlp-chat a.kap');
await foto(p, 'c-chat');
await p.close();

console.log('Karta na telefonu');
// QR: kamera napodobená obrázkem, čtečka nic nepřečte, aby okno zůstalo otevřené
p = await stranka({ mobil: true, init: () => {
  window.jsQR = () => null;
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement('canvas'); c.width = 480; c.height = 480; const x = c.getContext('2d');
    setInterval(() => { x.fillStyle = '#3a3f47'; x.fillRect(0, 0, 480, 480); x.fillStyle = '#f5f5f5'; x.fillRect(110, 90, 260, 300); x.fillStyle = '#111';
      for (let i = 0; i < 12; i++) for (let k = 0; k < 12; k++) if ((i * 7 + k * 3) % 5 < 2 || (i < 3 && k < 3) || (i < 3 && k > 8) || (i > 8 && k < 3)) x.fillRect(130 + k * 18, 120 + i * 18, 18, 18); }, 60);
    return c.captureStream(10);
  };
} });
await p.goto(`${URL}/karta/`); await p.waitForSelector('#p_qr');
await foto(p, 'k-parovani');
await klik(p, '#p_qr'); await p.waitForSelector('#qr_v'); await p.waitForTimeout(800);
await foto(p, 'k-qr');
await klik(p, '#qr_zpet');
await p.goto(`${URL}/karta/#p=${TENANT}.TYJRRRQH`); await p.waitForSelector('#p_tel');
await p.fill('#p_tel', '+420 777 000 123'); await klik(p, '#p_ok');
await p.waitForSelector('#unCarer'); await p.waitForTimeout(3500);
await foto(p, 'k-zamceno');
await p.fill('#zzs_p', 'Jan Rychlý, RZP Zlín 12'); await p.evaluate(() => document.querySelector('#zzs_p').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(300); await p.screenshot({ path: path.join(VYSTUP, 'k-zzs.png') }); console.log('  ✓ k-zzs');
// lékař bez PINu: kód dne (dnešní i včerejší projde, jiný ne), pak zamknout a odemknout PINem týmu
await klik(p, '#unDoc'); await p.fill('#kod', '000000'); await p.fill('#kodJ', 'MUDr. Test'); await klik(p, '#kodOk'); await p.waitForTimeout(600);
if (await p.$('.tile[data-tab]')) chyby.push('špatný kód lékaře odemkl kartu');
await p.fill('#kod', kodDne(dnesLokalne())); await klik(p, '#kodOk'); await p.waitForSelector('.tile[data-tab]', { timeout: 15000 });
if (!/MUDr\. Test · Lékař/.test(await p.textContent('#work'))) chyby.push('kód dne neodemkl kartu jako lékaře');
await klik(p, '#btnZamek'); await p.waitForSelector('#unRodina');
await klik(p, '#unCarer'); await p.fill('#pin', '123456'); await klik(p, '#pinOk');
await p.waitForSelector('.tile[data-tab]', { timeout: 15000 }); await p.waitForTimeout(3500);
await foto(p, 'k-odemceno');
await klik(p, '.tile[data-tab="denik"]'); await p.waitForSelector('#d_txt'); await p.fill('#d_txt', 'Odpoledne klidná, napila se, bolest 2/10.');
await foto(p, 'k-denik');
await klik(p, '.tile[data-tab="zhorseni"]'); await p.waitForSelector('#btnZ');
await p.click('#z_sym input[value="dušnost"]'); await p.click('#z_akce input[value="podán SOS lék"]');
await foto(p, 'k-zhorseni', { vyska: 1150 });
await p.close();

console.log('Můj průkaz (telefon pacienta)');
p = await stranka({ mobil: true });
await p.goto(`${URL}/pacient/#p=${TENANT}.MPK4R7ZD`); await p.waitForSelector('#p_tel');
await p.fill('#p_tel', '+420 604 000 777');
await foto(p, 'p-propojeni');
await klik(p, '#p_ok'); await p.waitForSelector('#np1');
await p.fill('#np1', '258147'); await p.fill('#np2', '258147');
await foto(p, 'p-pin');
await klik(p, '#np_ok'); await p.waitForSelector('.tile[data-tab="prani"]', { timeout: 20000 }); await p.waitForTimeout(3500);
await foto(p, 'p-prehled', { vyska: 1500 });
await klik(p, '.tile[data-tab="prani"]'); await p.waitForSelector('#pr_ok');
await p.fill('#pr_dulezite', 'Zůstat doma s dcerou a vnoučaty, nemít bolesti, mít jasnou hlavu na rozhovory.');
await p.fill('#pr_obavy', 'Dušení a převozu do nemocnice v noci.');
await p.fill('#pr_rozhodovani', 'Raději úleva než léčba za každou cenu.');
await p.fill('#pr_kdo', 'dcera Jana, 777 000 321');
await p.selectOption('#pr_puvod', 'rozhovor'); await p.fill('#pr_rk', 'MUDr. Ukázková, hospic');
await klik(p, '#pr_ok'); await p.waitForTimeout(3500);
await foto(p, 'p-prani', { vyska: 1500 });
await klik(p, '.tile[data-tab="leky"]'); await klik(p, '#lk_novy'); await p.fill('#lk_n', 'MST Continus'); await p.fill('#lk_d', '30 mg ráno a večer'); await klik(p, '#lk_ok');
await klik(p, '#lk_novy'); await p.fill('#lk_n', 'Furosemid'); await p.fill('#lk_d', '40 mg'); await p.fill('#lk_p', 'jen ob den – otoky menší'); await klik(p, '#lk_ok');
await p.waitForTimeout(3500);
await foto(p, 'p-leky', { vyska: 1300 });
await klik(p, '.tile[data-tab="poznamky"]'); await p.fill('#pz_t', 'Můžu brát Morphin i přes den, když bolí víc?'); await klik(p, '#pz_ok'); await p.waitForTimeout(300);
await klik(p, '.tile[data-tab="sdilet"]'); await p.waitForSelector('#sd_nahled');
await p.check('.vyber input[value="KARTA"]'); await p.waitForTimeout(3300);   // toast „Uloženo“ zmizí
await foto(p, 'p-sdilet', { vyska: 1200 });
await klik(p, '#sd_nahled'); await p.waitForSelector('#sd_tym');
await foto(p, 'p-nahled');
await klik(p, '#sd_tym'); await klik(p, '#kpOk'); await p.waitForTimeout(500);
if (sdileno.length !== 1 || sdileno[0].polozky.some((x) => !['PRANI', 'LEKY', 'OTAZKY', 'POZNAMKA'].includes(x.druh))) chyby.push('sdílení týmu poslalo něco jiného než údaje pacienta');
await klik(p, '.tile[data-tab="nouze"]'); await p.waitForSelector('#nz_kop'); await p.waitForTimeout(3300);
await foto(p, 'p-nouze', { vyska: 1400 });
// zamknutí a znovu odemknutí PINem (data jsou šifrovaná PINem)
await klik(p, '#btnZamek'); await p.waitForSelector('#pin');
await foto(p, 'p-zamek');
await p.fill('#pin', '111111'); await klik(p, '#pinOk'); await p.waitForTimeout(1500);
if (await p.$('.tile[data-tab]')) chyby.push('špatný PIN odemkl Můj průkaz');
await p.fill('#pin', '258147'); await klik(p, '#pinOk'); await p.waitForSelector('.tile[data-tab="leky"]', { timeout: 20000 });
await klik(p, '.tile[data-tab="leky"]');
if (!(await p.textContent('#work')).includes('Furosemid')) chyby.push('po odemknutí chybí vlastní léky pacienta');
await p.close();

console.log('Správa tenantů');
p = await stranka({ session: 'ukazka' });
await p.goto(`${URL}/tenanti/`); await p.waitForSelector('tr[data-id]');
await foto(p, 't-seznam');
await klik(p, '#novy'); await p.waitForSelector('#f_ico');
await p.fill('#f_ico', '12345678'); await p.fill('#f_nazev', 'Hospic Ukázka, z. ú.'); await p.fill('#f_adresa', 'Nemocniční 1, 760 01 Zlín');
await p.fill('#f_sj', 'MUDr. Petra Ukázková'); await p.dispatchEvent('#f_sj', 'input'); await p.fill('#f_se', 'petra@hospic-ukazka.cz');
await foto(p, 't-zalozit', { vyska: 1000 });
await p.close();

await b.close(); srv.close();
if (chyby.length) { console.error('Chyby na stránkách:', chyby); process.exitCode = 1; }
console.log('Hotovo →', VYSTUP);
