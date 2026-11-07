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
const VERZE = (fs.readFileSync(path.join(KOREN, 'src', 'config.js'), 'utf8').match(/verze: '([^']+)'/) || [])[1] || '0';   // verze do snímků z config.js
const VYSTUP = path.join(KOREN, 'public', 'napoveda', 'img');
const PORT = 3901;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
fs.mkdirSync(VYSTUP, { recursive: true });

/* ---------------- smyšlená data ---------------- */
const TENANT = 'ABCDEFGH12345678';
const dnes = new Date(); const den = (d) => { const x = new Date(dnes); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const cas = (d, hm) => `${den(d)} ${hm}`;
const posk = [
  { id: 1, nazev: 'Hospic Ukázka', ico: '12345678', icp: '', typ: 'HOSPIC', smiBytGarant: true, telefon24: '777 100 200', adresa: 'Nemocniční 1, Zlín', aktivni: true, odbornyZastupce: 'MUDr. Jan Vzorový, Ph.D.' },
  { id: 2, nazev: 'Praktický lékař MUDr. Vzorová', ico: '87654321', icp: '72100123', typ: 'PL', smiBytGarant: true, telefon24: '577 000 111', adresa: 'Náměstí 5, Zlín', aktivni: true },
  { id: 3, nazev: 'Domov Pohoda', ico: '11223344', icp: '', typ: 'DOMOV', smiBytGarant: false, telefon24: '577 222 333', adresa: 'Zahradní 8, Zlín', aktivni: true },
  { id: 4, nazev: 'Krajská nemocnice – interna', ico: '27661989', icp: '72000001', typ: 'NEMOCNICE', smiBytGarant: true, telefon24: '577 552 000', adresa: 'Havlíčkovo nábř. 600, Zlín', aktivni: true },
];
const planData = {
  cil: 'symptom', kpr: 'dvp', limity: ['KPR', 'Umělá plicní ventilace', 'Hospitalizace'],
  doklad: { dvp: true, datum: den(-40), original: 'u dcery, obálka na lednici', zprava: 'zápis o rozhovoru s pacientkou a dcerou', pouceni: true, overenyPodpis: true, prijeti: '' },
  dg: 'C50 karcinom prsu s metastázami do kostí a jater\nI50.9 chronické srdeční selhání', funkce: 'PPS 40 % – většinu dne na lůžku, s pomocí do křesla',
  alergie: 'penicilin',
  sos: ['Morphin 10 mg s.c. při bolesti nebo dušnosti, nejvýš po 4 h', 'Midazolam 5 mg s.c. při neklidu', 'Paracetamol 1 g p.o. při horečce'],
  opioidy: ['MST Continus 30 mg 1-0-1'],
  medikace: ['Furosemid 40 mg 1-0-0', 'Pantoprazol 20 mg 1-0-0', 'Lactulosa 15 ml večer'],
};
const plan = { verze: 3, data: planData, platnostDo: den(70), podepsal: 'MUDr. Petra Ukázková', podepsalId: 1, typ: 'ZMENA', vytvoreno: cas(-7, '10:24') };
const kontakty = [
  { id: 1, jmeno: 'Jana Zkušební, dcera (určená osoba)', tel: '777 000 321', skupina: 'ROZHODUJE', pozn: 'volat jako první', poradi: 1 },
  { id: 2, jmeno: 'Petr Zkušební, syn', tel: '777 000 654', skupina: 'INFORMOVAT', pozn: '', poradi: 2 },
  { id: 3, jmeno: 'Hospic Ukázka – sestra 24/7', tel: '777 100 200', skupina: 'PECUJE', pozn: 'nonstop', poradi: 3 },
  { id: 4, jmeno: 'MUDr. Vzorová, praktická lékařka', tel: '577 000 111', skupina: 'PECUJE', pozn: 'ordinační hodiny', poradi: 4 },
];
// výchozí kontakty organizace (0.11.70): sada pro celou organizaci, u klienta se jen zatrhne (kopie s vychoziId)
const kontaktyVychozi = [
  { id: 1, jmeno: 'Linka paliativní podpory', tel: '910 000 155', skupina: 'PECUJE', pozn: 'volat z telefonu u pacienta', klientu: 14 },
  { id: 2, jmeno: 'Sloužící sestra', tel: '+420 722 000 005', skupina: 'PECUJE', pozn: 'sestra je v kontaktu se sloužícím lékařem', klientu: 14 },
  { id: 3, jmeno: 'Ambulance Hospic Ukázka', tel: '+420 607 000 839', skupina: 'PECUJE', pozn: 'může být záznamník', klientu: 9 },
];
kontakty.push({ id: 5, jmeno: kontaktyVychozi[0].jmeno, tel: kontaktyVychozi[0].tel, skupina: 'PECUJE', pozn: kontaktyVychozi[0].pozn, poradi: 5, vychoziId: 1 });
const denik = [
  { uuid: 'a1', typ: 'Založení', text: 'Průkaz založen, plán péče verze 1.', autor: 'MUDr. Petra Ukázková', role: 'lekar', cas: cas(-21, '09:10'), overeno: true },
  { uuid: 'a2', typ: 'Systém', text: 'Průkaz nahrán do telefonu u pacienta (+420 777 000 123).', autor: 'telefon 7', role: 'system', cas: cas(-21, '09:32'), overeno: true },
  { uuid: 'a3', typ: 'Návštěva hospice', text: 'Kontrola bolesti, úprava dávky MST na 30 mg 1-0-1.', autor: 'Sestra Lucie Příkladná', role: 'sestra', cas: cas(-7, '10:05'), overeno: true },
  { uuid: 'a4', typ: 'Podán SOS lék', text: 'V noci bolest 7/10, podán Morphin 10 mg s.c., po 30 min úleva.', autor: 'Jana Zkušební', role: 'rodina', cas: cas(-2, '02:40'), overeno: true },
  { uuid: 'a9', typ: 'Výjezd ZZS', text: 'Výjezd ZZS: konzultováno s lékařem plánu, bez transportu. Dušnost, podán kyslík, po SOS medikaci úleva.', autor: 'Jan Rychlý, RZP Zlín 12', role: 'zzs', cas: cas(-9, '03:15'), overeno: false },
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
// týmy lidí (0.10.0): hlavičky týmů, týmy u pacienta s členy (člen 3 u pacienta deaktivován), nabídka dalších týmů
const tymy = [
  { id: 1, poskytovatelId: 1, poskytovatel: 'Hospic Ukázka', nazev: 'Tým Zlín', popis: 'Zlín a okolí', aktivni: 1, prirazenVzdy: 1, clenu: 5, pacientu: 3 },
  { id: 2, poskytovatelId: 1, poskytovatel: 'Hospic Ukázka', nazev: 'Tým Otrokovice', popis: 'Domov seniorů Otrokovice C', aktivni: 1, clenu: 2, pacientu: 1, telefonu: 1 },
  { id: 3, poskytovatelId: 3, poskytovatel: 'Domov Pohoda', nazev: 'Oddělení A', popis: 'přízemí', aktivni: 1, clenu: 2, pacientu: 5 },
  { id: 4, poskytovatelId: 3, poskytovatel: 'Domov Pohoda', nazev: 'Oddělení B', popis: '', aktivni: 1, clenu: 1, pacientu: 3 },
];
const clen = (oid, aktivni = 1) => { const o = lide.find((x) => x.id === oid); return { osobaId: oid, jmeno: o.jmeno, role: o.role, poskytovatel: o.poskytovatel, maPin: 1, aktivni }; };
// členství (0.10.2): tým garanta může mít i lidi jiných pracovišť – Tým Zlín má i sestru domova a praktickou lékařku
const clenstvi = [[1, 1], [1, 2], [1, 3], [1, 6], [1, 7], [2, 4], [2, 5], [3, 7], [3, 8], [4, 9]].map(([tymId, osobaId]) => ({ tymId, osobaId }));
const tymyLidi = [
  { id: 1, tymId: 1, nazev: 'Tým Zlín', popis: 'Zlín a okolí', poskytovatelId: 1, poskytovatel: 'Hospic Ukázka', od: den(-21), prirazenVzdy: 1, clenove: [clen(1), clen(2), clen(3, 0), clen(6), clen(7)] },
  { id: 2, tymId: 3, nazev: 'Oddělení A', popis: 'přízemí', poskytovatelId: 3, poskytovatel: 'Domov Pohoda', od: den(-10), clenove: [clen(7), clen(8)] },
];
const tymyNabidka = () => tymy.filter((t) => !tymyLidi.some((x) => x.tymId === t.id)).map((t) => ({ id: t.id, nazev: t.nazev, popis: t.popis, poskytovatelId: t.poskytovatelId, poskytovatel: t.poskytovatel, clenu: t.clenu, mimoTym: t.id === 4 ? ['Domov Pohoda – odd. B'] : [] }));
const prirazeni = [6].map((oid) => { const o = lide.find((x) => x.id === oid); return { id: 100 + oid, osobaId: oid, jmeno: o.jmeno, role: o.role, tym: o.tym, poskytovatelId: o.poskytovatelId, poskytovatel: o.poskytovatel, od: den(-20), maPin: 1 }; });
const pdTym = [
  { id: 11, jmeno: 'Bc. Tereza Vzorná', role: 'sestra', telefon: '777 100 203', login: 'tereza', externiId: 'pd:11', nacteno: true },
  { id: 12, jmeno: 'MUDr. Petra Ukázková', role: 'lekar,casemanager', telefon: '777 100 201', login: 'petra', externiId: 'pd:12', nacteno: true },
  { id: 13, jmeno: 'Sestra Iveta Nová', role: 'sestra', telefon: '777 100 206', login: 'iveta', externiId: 'pd:13', nacteno: false },
  { id: 14, jmeno: 'MUDr. Ondřej Příklad', role: 'lekar', telefon: '777 100 207', login: 'ondrej', externiId: 'pd:14', nacteno: false },
  { id: 15, jmeno: 'Jindřich Správce', role: 'admin', telefon: '', login: 'spravce', externiId: 'pd:15', nacteno: false },
];
const garance = [{ id: 1, poskytovatelId: 1, nazev: 'Hospic Ukázka', stav: 'PLATNA', lekar: 'MUDr. Petra Ukázková', navrhl: null, navrzeno: null, od: cas(-21, '09:10'), do: null, poznamka: null }];
const pacient = { id: 1, kod: 'P-0007', jmeno: 'Marie', prijmeni: 'Zkušební', rc: '415203/1234', datumNarozeni: '1941-02-03', rok: 1941, pohlavi: 'žena', pojistovna: '111',
  adresa: 'Lipová 12, Zlín', pobyt: 'doma', telefonKarty: '+420 777 000 123', email: 'marie.zkusebni@example.cz', stav: 'AKTIVNI', souhlas: `potvrzeno ${den(-21)} · MUDr. Petra Ukázková`, zalozeno: cas(-21, '09:10'), uzavreno: null, duvodUzavreni: null };
// propojení s PéčeDoma (0.7.0): nastavení tenanta, stav synchronizace pacienta, seznam klientů pro výběr
const pdNast = { odkaz: 'https://web-pecedoma.netlify.app/?iv=ukazka&data=ukazka&tag=hospic', api: 'https://95-216-201-2.sslip.io', apiVychozi: 'https://95-216-201-2.sslip.io', tokenNastaven: true, sync: true, nastaveno: true, partnerKlic: true };
const pdSync = { sos: ['Morphin 10 mg s.c. – při bolesti nebo dušnosti', 'Midazolam 5 mg s.c. – při neklidu'], opioidy: ['MST Continus 30 mg – 1-0-1'], medikace: ['Furosemid 40 mg – 1-0-0', 'Lactulosa 15 ml – 1-0-1'],
  pristiNavsteva: den(2) + ' 09:30', pristiKdo: 'lékař MUDr. Petra Ukázková, sestra Lucie Příkladná', pristiPozn: 'Návštěva lékaře · Plánováno · Zlín', aktualizovano: cas(0, '08:05'), chyba: null };
const pdKlienti = [
  { id: 'a1b2c3d4-0000-4000-8000-000000000001', jmeno: 'Anna', prijmeni: 'Vzorová', rc: '505512/1234', narozen: '1950-05-12', mesto: 'Zlín', telefon: '777 000 456', posledni_aktivita: den(-5), hospic: true, t720: true, lpp: true, kde: 'Doma', doma: true, ds: false, hosp: false },
  { id: 'a1b2c3d4-0000-4000-8000-000000000002', jmeno: 'Josef', prijmeni: 'Vzorek', rc: '480508/1111', narozen: '1948-05-08', mesto: 'Otrokovice', telefon: '', posledni_aktivita: den(-12), hospic: false, t720: true, lpp: false, kde: 'DS C', doma: false, ds: true, hosp: false },
];
const detail = {
  pacient, plan, dgPopisy: { C50: 'Zhoubný novotvar prsu', I509: 'Selhání srdce NS', C509: 'ZN - prs NS' },
  verze: [{ verze: 3, typ: 'ZMENA', podepsal: 'MUDr. Petra Ukázková', vytvoreno: cas(-7, '10:24'), platnostDo: den(70), poznamka: 'úprava SOS medikace' },
    { verze: 2, typ: 'REVIZE', podepsal: 'MUDr. Petra Ukázková', vytvoreno: cas(-14, '11:00'), platnostDo: den(60), poznamka: null },
    { verze: 1, typ: 'ZALOZENI', podepsal: 'MUDr. Petra Ukázková', vytvoreno: cas(-21, '09:10'), platnostDo: den(60), poznamka: null }],
  kontakty, kontaktyVychozi, tym, garance,
  pecedoma: { klientId: 'a1b2c3d4-0000-4000-8000-000000000001', portalKlientId: 12, odkaz: pdNast.odkaz, nastaveno: true, autoSync: true, sync: pdSync },
  zarizeni: [{ id: 9, stitek: 'telefon pacienta', stav: 'SPAROVANO', sparovano: cas(-5, '11:02'), sync: cas(0, '07:40'), baterie: null, verzeAplikace: 'pacient-0.5.0', fronta: 0, verzePlanu: 3, kod: null, kodPlatnost: null, telefon: '+420604000777', rezim: 'PACIENT', vytvoreno: cas(-5, '10:58') },
    { id: 11, stitek: 'dcera Jana', stav: 'CEKA', sparovano: null, sync: null, baterie: null, verzeAplikace: null, fronta: 0, verzePlanu: null, kod: 'Q7X2M4PL', kodPlatnost: cas(2, '09:15'), telefon: '+420777000321', rezim: 'PACIENT', vytvoreno: cas(-1, '09:15') },
    { id: 7, stitek: null, stav: 'SPAROVANO', sparovano: cas(-21, '09:32'), sync: cas(0, '08:12'), baterie: 76, verzeAplikace: 'karta-0.5.0', fronta: 0, verzePlanu: 3, kod: null, kodPlatnost: null, telefon: '+420777000123', rezim: 'ZAPUJCENY' }],
  odPacienta: [{ id: 1, cas: cas(-1, '19:30'), polozky: [
    { druh: 'PRANI', nazev: 'Moje hodnoty a přání', obsah: 'Co je pro mě důležité: zůstat doma s dcerou a vnoučaty, nemít bolesti.\nČeho se obávám: dušení a převozu do nemocnice v noci.\nCo chci, aby lékaři zohlednili: raději úleva než léčba za každou cenu.', puvod: 'údaj pacienta – jak si pamatuji rozhovor se zdravotníkem (MUDr. Ukázková, ' + den(-30).split('-').reverse().map(Number).join('. ') + ')', aktualizovano: cas(-1, '19:20') },
    { druh: 'LEKY', nazev: 'Léky, které užívám', obsah: 'MST Continus 30 mg – ráno a večer · aktualizováno ' + den(-1).split('-').reverse().map(Number).join('. ') + '\nFurosemid 40 mg – jen ob den (otoky menší)', puvod: 'údaj pacienta', aktualizovano: cas(-1, '19:25') }] }],
  piny: [{ id: 1, jmeno: 'Jana Zkušební (dcera)', role: 'RODINA', vytvoreno: den(-21), zobrazitelny: 1 }], lide: prirazeni, tymyLidi, get tymyNabidka() { return tymyNabidka(); },
  denik: [...denik].reverse(), dokumenty: [{ id: 1, typ: 'DVP', nazev: 'Dříve vyslovené přání', kdeOriginal: 'u dcery', mime: 'application/pdf', velikost: 120000, vytvoreno: cas(-21, '09:20'), datum: den(-40), pracoviste: 'Hospic Ukázka' },
    { id: 2, typ: 'ZPRAVA', nazev: 'Propouštěcí zpráva – interna', kdeOriginal: '', mime: 'application/pdf', velikost: 230000, vytvoreno: cas(-22, '15:00'), datum: den(-23), pracoviste: 'Krajská nemocnice – interna' }],
  pristupy: [{ cas: cas(0, '08:15'), kdo: 'MUDr. Petra Ukázková', akce: 'zobrazení průkazu', detail: null }, { cas: cas(-2, '02:41'), kdo: 'telefon', akce: 'synchronizace', detail: '1 zápis' }],
  op: { vidi: true, aktivni: true, lekar: true, garant: true, zapis: true, vychozi: true, prijmoutGaranci: false, navrhGaranceId: null }, smsDostupne: true,
};
const pacienti = [
  { id: 1, kod: 'P-0007', jmeno: 'Marie', prijmeni: 'Zkušební', rok: 1941, pobyt: 'doma', adresa: 'Lipová 12, Zlín', stav: 'AKTIVNI', zalozeno: cas(-21, '09:10'), verze: 3, platnostDo: den(70), cil: 'symptom', garantId: 1, garant: 'Hospic Ukázka', garantTyp: 'HOSPIC', garantOd: cas(-21, '09:10'), sync: cas(0, '08:12'), baterie: 76, telefonu: 1, telefonKarty: '+420777000123', posledniKrize: null, posledniZapis: cas(-1, '18:15') },
  { id: 2, kod: 'P-0008', jmeno: 'Josef', prijmeni: 'Příkladný', rok: 1938, pobyt: 'Domov Pohoda, pokoj 12', adresa: 'Zahradní 5, Otrokovice', domov: 'Domov Pohoda', stav: 'AKTIVNI', zalozeno: cas(-50, '10:00'), verze: 2, platnostDo: den(9), cil: 'limited', garantId: 1, garant: 'Hospic Ukázka', garantTyp: 'HOSPIC', garantOd: cas(-50, '10:00'), sync: cas(0, '07:50'), baterie: 15, telefonu: 1, telefonKarty: '+420777000124', posledniKrize: 'Zhoršení stavu', posledniZapis: cas(0, '06:30') },
  { id: 3, kod: 'P-0009', jmeno: 'Anna', prijmeni: 'Vzorová', rok: 1950, pobyt: 'doma', adresa: 'Polní 3, Zlín', stav: 'AKTIVNI', zalozeno: cas(-3, '14:00'), verze: 1, platnostDo: den(88), cil: 'symptom', garantId: 4, garant: 'Krajská nemocnice – interna', garantTyp: 'NEMOCNICE', garantOd: cas(-3, '14:00'), sync: null, baterie: null, telefonu: 0, posledniKrize: null, posledniZapis: cas(-3, '14:00') },
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
  plan, garant: { poskytovatel: 'Hospic Ukázka', typ: 'HOSPIC', telefon24: '777 100 200', lekar: 'MUDr. Jan Vzorový, Ph.D.', odbornyZastupce: 'MUDr. Jan Vzorový, Ph.D.' },
  kontakty: kontakty.map((k) => ({ id: k.id, jmeno: k.jmeno, tel: k.tel, skupina: k.skupina.toLowerCase(), pozn: k.pozn })),
  tym: tym.map((t) => ({ nazev: t.nazev, typ: t.typ, role: t.role, tel: t.telefon24 })),
  get lide() { return lide.slice(0, 4).map((o) => ({ id: o.id, jmeno: o.jmeno, role: String(o.role || '').toLowerCase(), tel: o.telefon || o.tel || '', poskytovatel: o.poskytovatel, tym: o.tym })); },
  piny: [{ id: 'o2', jmeno: 'Sestra Lucie Příkladná', role: 'hospic', salt, hash: pbkdf2Sync('123456', Buffer.from(salt, 'hex'), 120000, 32, 'sha256').toString('hex'), iterace: 120000 }],
  denik, serverCas: new Date().toISOString(),
  get odPacienta() { return detail.odPacienta.flatMap((x) => x.polozky.map((p) => ({ ...p, cas: x.cas }))); },
  pecedoma: { sos: pdSync.sos, opioidy: pdSync.opioidy, medikace: pdSync.medikace, pristiNavsteva: pdSync.pristiNavsteva, pristiKdo: pdSync.pristiKdo, pristiPozn: pdSync.pristiPozn, aktualizovano: pdSync.aktualizovano, chat: true, propojeno: true },
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
app.get('/api/c/ja', j({ ja: { jmeno: 'MUDr. Petra Ukázková', login: 'petra.ukazkova', poskytovatel: 'Hospic Ukázka', poskytovatelId: 1, role: ['admin', 'lekar'], musiZmenitHeslo: false }, smsPacientVychozi: 'Můj průkaz: lékař vám zpřístupnil váš paliativní průkaz. Otevřete odkaz v tomto telefonu: {odkaz} (platí 3 dny)', nazevSite: 'Paliativní síť Ukázkového kraje', nastaveni: { intervalRevize: 3 }, verejnaAdresa: 'https://kartapacienta.example', verze: VERZE, ai: true, pecedoma: pdNast }));
app.get('/api/c/poskytovatele', j({ poskytovatele: posk }));
app.get('/api/c/pacienti/export', j(() => ({ format: 'csv', vzor: true, csv: 'kod;jmeno;prijmeni\n' })));
app.get('/api/c/diagnozy', j((req) => ({ diagnozy: [{ kod: 'C509', popis: 'ZN - prs NS' }, { kod: 'C50', popis: 'Zhoubný novotvar prsu' }, { kod: 'C341', popis: 'ZN - horní lalok průdušky nebo plíce' }].filter((d) => (d.kod + ' ' + d.popis).toLowerCase().includes(String(req.query.q || '').toLowerCase().slice(0, 4)) || String(req.query.q || '').length > 3) })));
app.get('/api/c/prehled', j((req) => (req.query.stav === 'UZAVRENY' ? { pacienti: [], upozorneni: [] } : { pacienti: pacienti.map((x, i) => ({ ...x, kde: ['Doma', 'DS B', ''][i] ?? '' })), upozorneni })));
app.post('/api/c/pecedoma/sync-vse', j(() => ({ celkem: 2, ok: 2, chyby: [] })));
app.get('/api/c/pacient/:id', j(() => ({ ...detail, video: { server: 'https://jitsi.example.org', telefon: true, hovor: videoHovor ? { ...videoHovor, odkaz: 'about:blank' } : null } })));
// výchozí kontakty organizace (0.11.70): zatržení / odebrání u klienta, nový výchozí, z vlastního kontaktu, zrušení u všech
app.post('/api/c/pacient/:id/kontakt-vychozi', j((req) => { const b = req.body || {}; const dalsi = () => Math.max(0, ...kontakty.map((x) => x.poradi || 0)) + 10;
  const pouzit = (v) => { if (!kontakty.some((x) => x.vychoziId === v.id)) { kontakty.push({ id: Math.max(...kontakty.map((x) => x.id)) + 1, jmeno: v.jmeno, tel: v.tel, skupina: v.skupina, pozn: v.pozn, poradi: dalsi(), vychoziId: v.id }); v.klientu++; } };
  if (b.akce === 'pouzit') pouzit(kontaktyVychozi.find((v) => v.id === Number(b.vychoziId)));
  else if (b.akce === 'nepouzit' || b.akce === 'zrusit') { const i = kontakty.findIndex((x) => x.vychoziId === Number(b.vychoziId)); if (i >= 0) kontakty.splice(i, 1);
    const v = kontaktyVychozi.find((x) => x.id === Number(b.vychoziId)); if (b.akce === 'zrusit') kontaktyVychozi.splice(kontaktyVychozi.indexOf(v), 1); else if (i >= 0) v.klientu--; }
  else if (b.akce === 'novy') { if (!b.jmeno || !b.tel) return { ok: false, error: 'Vyplňte jméno i telefon' }; const v = { id: Math.max(0, ...kontaktyVychozi.map((x) => x.id)) + 1, jmeno: b.jmeno, tel: b.tel, skupina: b.skupina, pozn: b.pozn || '', klientu: 0 }; kontaktyVychozi.push(v); pouzit(v); }
  else if (b.akce === 'zVlastniho') { const k = kontakty.find((x) => x.id === Number(b.kontaktId)); const v = { id: Math.max(0, ...kontaktyVychozi.map((x) => x.id)) + 1, jmeno: k.jmeno, tel: k.tel, skupina: k.skupina, pozn: k.pozn, klientu: 1 }; kontaktyVychozi.push(v); k.vychoziId = v.id; }
  kontakty.sort((a, c) => (a.poradi - c.poradi) || (a.id - c.id)); return {}; }));
// důležité kontakty (0.9.6): přidání, úprava, odebrání i přeřazení šipkami nad polem kontakty (seřazené jako server: Poradi, id)
app.post('/api/c/pacient/:id/kontakt', j((req) => { const b = req.body || {}; const por = b.poradi === '' || b.poradi == null ? null : Number(b.poradi);
  if (b.id) { const k = kontakty.find((x) => x.id === Number(b.id)); if (!k) return { ok: false, error: 'Kontakt nenalezen' };
    if (k.vychoziId && !b.smazat && !b.jenPoradi) { const v = kontaktyVychozi.find((x) => x.id === k.vychoziId); Object.assign(v, { jmeno: b.jmeno, tel: b.tel, skupina: b.skupina, pozn: b.pozn || '' }); kontakty.filter((x) => x.vychoziId === v.id).forEach((x) => Object.assign(x, { jmeno: v.jmeno, tel: v.tel, skupina: v.skupina, pozn: v.pozn })); return {}; }
    if (b.smazat) kontakty.splice(kontakty.indexOf(k), 1); else if (b.jenPoradi) k.poradi = por; else Object.assign(k, { jmeno: b.jmeno, tel: b.tel, skupina: b.skupina, pozn: b.pozn || '', poradi: por == null ? k.poradi : por }); }
  else { if (!b.jmeno || !b.tel) return { ok: false, error: 'Vyplňte jméno i telefon' }; kontakty.push({ id: kontakty.length + 10, jmeno: b.jmeno, tel: b.tel, skupina: b.skupina, pozn: b.pozn || '', poradi: por == null ? 100 : por }); }
  kontakty.sort((a, c) => (a.poradi - c.poradi) || (a.id - c.id)); return {}; }));
// léky – jedna agenda (PéčeDoma)
let pdLeky = [
  { id: '1', typ: 'ZACHRANNA', nazev: 'Morphin', davka: '10 mg s.c.', instr: 'při bolesti nebo dušnosti, nejvýš po 4 h', popis: '' },
  { id: '2', typ: 'ZACHRANNA', nazev: 'Midazolam', davka: '5 mg s.c.', instr: 'při neklidu', popis: '' },
  { id: '3', typ: 'OPIOID', nazev: 'MST Continus', davka: '30 mg 1-0-1', instr: '', popis: 'tableta proti bolesti ráno a večer' },
  { id: '4', typ: 'PRAVIDELNA', nazev: 'Furosemid', davka: '40 mg 1-0-0', instr: '', popis: '' },
  { id: '5', typ: 'PRAVIDELNA', nazev: 'Lactulosa', davka: '15 ml 1-0-1', instr: '', popis: '' },
];
app.get('/api/c/pacient/:id/leky', j({ zdroj: 'pecedoma', leky: pdLeky }));
app.post('/api/c/pacient/:id/leky', j((req) => { const b = req.body || {}; if (b.id) pdLeky = pdLeky.map((l) => (l.id === String(b.id) ? { ...l, ...b, id: l.id } : l)); else pdLeky.push({ id: String(pdLeky.length + 1), typ: b.typ, nazev: b.nazev, davka: b.davka || '', instr: b.instr || '', popis: b.popis || '' }); return { leky: pdLeky, sync: pdSync }; }));
app.post('/api/c/pacient/:id/leky/smaz', j((req) => { pdLeky = pdLeky.filter((l) => l.id !== String((req.body || {}).id)); return { leky: pdLeky, sync: pdSync }; }));
// videohovor (0.11.45): napodobený server – stav hovoru v paměti, odkaz vede na stránku bez obsahu
let videoHovor = null;
const videoOdpoved = () => ({ server: 'https://jitsi.example.org', hovor: videoHovor ? { ...videoHovor, odkaz: 'about:blank' } : null });
app.get('/api/d/video', j(videoOdpoved));
app.post('/api/d/video', j((req) => { const b = req.body || {}; if (b.akce === 'zahajit' && !videoHovor) videoHovor = { id: 1, mistnost: 'kp-p0007-abc', stav: 'ZVONI', zahajil: 'TELEFON', zahajilJmeno: 'hospic Sestra Lucie', zahajeno: cas(0, '09:10') };
  else if (b.akce === 'prijmout' && videoHovor) videoHovor = { ...videoHovor, stav: 'PROBIHA', prijato: cas(0, '09:11') }; else if (b.akce === 'ukoncit') videoHovor = null; return videoOdpoved(); }));
// Karta pacienta uvnitř PéčeDoma (0.11.65): vstupenka z partnerského API, stránka /pd/
let pdVerze = [{ verze: 3, typ: 'ZMENA', podepsal: 'MUDr. Petra Ukázková', platnostDo: den(70), vytvoreno: cas(-7, '10:24'), poznamka: null }, { verze: 2, typ: 'REVIZE', podepsal: 'MUDr. Petra Ukázková', platnostDo: den(40), vytvoreno: cas(-30, '09:00'), poznamka: 'beze změny' }, { verze: 1, typ: 'ZALOZENI', podepsal: 'MUDr. Petra Ukázková', platnostDo: den(60), vytvoreno: cas(-21, '09:10'), poznamka: null }];
app.get('/api/pd/karta', (req, res) => (String(req.headers.authorization || '').startsWith('Pd ') ? res.json({ ok: true, pacient: { id: 1, kod: 'P-0007', jmeno: 'Marie', prijmeni: 'Zkušební', stav: 'AKTIVNI' }, balik: { ...balik, piny: undefined }, plan: { ...plan, verze: pdVerze[0].verze }, verze: pdVerze, lekar: true, kdo: 'MUDr. Petra Ukázková', interval: 3 }) : res.status(401).json({ ok: false, chyba: 'Vstupenka z PéčeDoma neplatí' })));
app.post('/api/pd/plan', j((req) => { const b = req.body || {}; pdVerze = [{ verze: pdVerze[0].verze + 1, typ: b.typ === 'REVIZE' ? 'REVIZE' : 'ZMENA', podepsal: 'PéčeDoma: MUDr. Petra Ukázková', platnostDo: b.platnostDo, vytvoreno: cas(0, '10:00'), poznamka: b.poznamka || null }, ...pdVerze]; return { verze: pdVerze[0].verze }; }));
app.post('/__mock/video', (req, res) => { videoHovor = req.body && req.body.id ? req.body : null; res.json({ ok: true }); });
app.get('/api/c/pacient/:id/video', j(() => ({ server: 'https://jitsi.example.org', telefon: true, hovor: videoHovor ? { ...videoHovor, odkaz: 'about:blank' } : null })));
app.post('/api/c/pacient/:id/video', j((req) => { const b = req.body || {}; if (b.akce === 'prijmout' && videoHovor) videoHovor = { ...videoHovor, stav: 'PROBIHA' }; else if (b.akce === 'ukoncit') videoHovor = null; else if (b.akce === 'zahajit' && !videoHovor) videoHovor = { id: 4, mistnost: 'kp-p0007-centrala', stav: 'ZVONI', zahajil: 'CENTRALA', zahajilJmeno: 'MUDr. Petra Ukázková', zahajeno: cas(0, '09:30') }; return { server: 'https://jitsi.example.org', telefon: true, hovor: videoHovor ? { ...videoHovor, odkaz: 'about:blank' } : null }; }));
app.get('/api/c/video/aktivni', j(() => ({ server: 'https://jitsi.example.org', hovory: videoHovor ? [{ ...videoHovor, pacientId: 7, kod: 'P-0007', jmeno: 'Marie', prijmeni: 'Zkušební', odkaz: 'about:blank' }] : [] })));
app.get('/api/d/leky', j({ leky: pdLeky }));
app.post('/api/d/leky', j((req) => { const b = req.body || {}; if (b.id) pdLeky = pdLeky.map((l) => (l.id === String(b.id) ? { ...l, ...b, id: l.id } : l)); else pdLeky.push({ id: String(pdLeky.length + 1), typ: b.typ, nazev: b.nazev, davka: b.davka || '', instr: b.instr || '', popis: b.popis || '' }); return { leky: pdLeky }; }));
app.post('/api/d/leky/smaz', j((req) => { pdLeky = pdLeky.filter((l) => l.id !== String((req.body || {}).id)); return { leky: pdLeky }; }));
app.get('/api/c/pecedoma/klienti', j((req) => { const q = String(req.query.q || '').toLowerCase(), f = String(req.query.filtr || '').split(',').filter(Boolean); return { klienti: pdKlienti.filter((k) => (!f.length || f.some((x) => k[x])) && (!q || (k.prijmeni + ' ' + k.jmeno + ' ' + k.rc + ' ' + k.mesto).toLowerCase().includes(q))), skupiny: { hospic: 1, t720: 2, lpp: 1, doma: 1, ds: 1, hosp: 0, chyba: null } }; }));
app.get('/api/c/pecedoma/klient/:id', j((req) => { const k = pdKlienti.find((x) => x.id === req.params.id); return { karta: k ? { ...pecedomaJson, pacient: { ...pecedomaJson.pacient, jmeno: k.jmeno, prijmeni: k.prijmeni, rc: k.rc, datumNarozeni: k.narozen, telefonKarty: k.telefon, telefon: k.telefon } } : pecedomaJson, klientId: req.params.id }; }));
app.post('/api/c/pacient/:id/pecedoma', j({ sync: pdSync }));
app.post('/api/c/pacient/:id/pecedoma/sync', j({ sync: pdSync }));
// chat PéčeDoma (A_MSPPP_Zprava) – stejné vlákno pro centrálu, telefon i Můj průkaz
const pdZpravy = [
  { id: '1', smer: 'OD_TYMU', cas: cas(-2, '09:12'), text: 'Dobrý den, zítra přijede sestra Lucie kolem deváté, vezme nové náplasti.', sms: true, kdo: '' },
  { id: '2', smer: 'OD_PACIENTA', cas: cas(-2, '10:40'), text: 'Děkujeme, budeme doma. Maminka dnes v noci špatně spala, bolest v zádech.', sms: false, kdo: 'rodina Jana Zkušební' },
  { id: '3', smer: 'OD_TYMU', cas: cas(-2, '11:05'), text: 'Rozumím, dejte prosím Morphin 10 mg s.c. podle plánu a napište, jak zabral. Zítra to s lékařkou probereme.', sms: false, kdo: 'MUDr. Petra Ukázková' },
];
const chatOdpoved = (smer) => (req) => { if (req.method === 'POST' && req.body && req.body.text) pdZpravy.push({ id: String(pdZpravy.length + 1), smer, cas: new Date().toISOString().slice(0, 16).replace('T', ' '), text: req.body.text, sms: false, kdo: req.body.kdo || 'MUDr. Petra Ukázková' }); return { zpravy: pdZpravy, portalKlientId: 12 }; };
app.get('/api/c/pacient/:id/pecedoma/zpravy', j(chatOdpoved('OD_TYMU')));
app.post('/api/c/pacient/:id/pecedoma/zprava', j(chatOdpoved('OD_TYMU')));
app.get('/api/d/pecedoma/zpravy', j(chatOdpoved('OD_PACIENTA')));
app.post('/api/d/pecedoma/zprava', j(chatOdpoved('OD_PACIENTA')));
app.post('/api/c/pacient/:id/parovat', j({ zarizeniId: 8, kod: 'TYJRRRQH', tenant: TENANT, platnost: new Date(Date.now() + 15 * 60e3).toISOString(), odkaz: `https://kartapacienta.example/karta/#p=${TENANT}.TYJRRRQH.T420777000123`, telefonKarty: '+420 777 000 123', smsDostupne: true, smsDuvod: '', sms: null }));
app.post('/api/c/pacient/:id/zarizeni', j({ ok: true }));
app.post('/api/c/pacient/:id/pacientovi', j((req) => ({ zarizeniId: 10, kod: 'MPK4R7ZD', tenant: TENANT, platnost: new Date(Date.now() + 72 * 3600e3).toISOString(), odkaz: `https://kartapacienta.example/pacient/#p=${TENANT}.MPK4R7ZD.T420604000777`, telefon: '+420 604 000 777', smsDostupne: true, smsDuvod: '', sms: req.body.sms ? { ok: true, text: String(req.body.text || '').replace('{odkaz}', 'https://kartapacienta.example/pacient/#p=…') } : null })));
app.get('/api/c/uzivatele', j({ uzivatele }));
app.get('/api/c/tym-lidi/telefony', j(() => ({ telefony: [   // 0.11.85: telefony s kartou v okně týmu
  { telefon: '+420722916951', hezky: '+420 722 916 951', pacienti: [{ id: 1, jmeno: 'Zkušební Marie', kod: 'P-0007', rok: 1941 }, { id: 2, jmeno: 'Příkladný Josef', kod: 'P-0008', rok: 1938 }, ...['Vzorová Anna', 'Ukázková Jana', 'Testovací Karel', 'Příkladná Eva', 'Zkušební Jiří', 'Modelová Věra', 'Vzorný Pavel', 'Ukázkový Jan', 'Pokusná Ludmila', 'Smyšlená Olga', 'Ukázková Marta', 'Vzorová Alena', 'Pokusný Milan', 'Testovací Hana', 'Modelový Petr', 'Zkušební Věra', 'Příkladný Karel'].map((jm, i) => ({ id: 10 + i, jmeno: jm, kod: 'P-00' + (10 + i), rok: 1930 + i * 2 }))], skrytych: 1, vybran: true },
  { telefon: '+420777000123', hezky: '+420 777 000 123', pacienti: [{ id: 3, jmeno: 'Vzorová Anna', kod: 'P-0009' }], skrytych: 0, vybran: false }] })));
app.get('/api/c/lide', j({ lide, tymy, clenstvi, role: { LEKAR: 'Lékař a spec. sestra', PL: 'Praktický lékař', HOSPIC: 'Hospic', SESTRA: 'Sestra DPS' }, smsDostupne: true }));
app.get('/api/c/lide/pecedoma', j({ lide: pdTym }));
app.post('/api/c/osoba', j({ id: 99, pin: '482913', sms: null }));
app.post('/api/c/osoba/:id/pin/zobrazit', j({ pin: '482913', vydan: den(-20) + ' 10:00', sms: null }));
app.post('/api/c/lide/import', j((req) => ({ pridano: req.body.radky.length, aktualizovano: 0, chyby: [], piny: req.body.radky.map((r, i) => ({ ...r, pin: String(305117 + i * 91813).slice(0, 6), sms: req.body.sms ? { ok: true } : null })) })));
app.post('/api/c/pacient/:id/lide', j({ zmeny: 1 }));
app.post('/api/c/tym-lidi', j({ id: 9 }));
app.post('/api/c/tym-lidi/:id/smazat', j({ pacientu: 0 }));
app.post('/api/c/tym-lidi/:id/piny', j((req) => { const t = tymy.find((x) => x.id === Number(req.params.id)); const cl = clenstvi.filter((c) => c.tymId === t.id).map((c) => clen(c.osobaId)); const stary = !req.body.noveChybejicim && cl.length > 1 ? [cl[cl.length - 1].jmeno] : [];
  return { tym: t.nazev, bezPinu: stary, piny: cl.filter((c) => !stary.includes(c.jmeno)).map((c, i) => ({ id: c.osobaId, jmeno: c.jmeno, role: c.role, pracoviste: c.poskytovatel, tym: t.nazev, pin: String(214807 + i * 137731).slice(0, 6), novy: !!req.body.noveChybejicim && i === cl.length - 1 })) }; }));
app.post('/api/c/lide/pecedoma/aktualizovat', j({ zmeny: [{ jmeno: 'Bc. Tereza Vzorná', co: 'telefon — → +420 777 100 203' }], bezTelefonu: [], neparovani: ['MUDr. Eva Vzorová'], celkem: 5 }));
app.post('/api/c/pacient/:id/tym-lidi', j((req) => { const b = req.body || {};
  if (b.pridatTymId) { const t = tymy.find((x) => x.id === Number(b.pridatTymId)); tymyLidi.push({ id: 10 + t.id, tymId: t.id, nazev: t.nazev, popis: t.popis, poskytovatelId: t.poskytovatelId, poskytovatel: t.poskytovatel, od: den(0), clenove: clenstvi.filter((c) => c.tymId === t.id).map((c) => clen(c.osobaId)) }); return { pracovistePridano: false }; }
  if (b.odebratTymId) { const i = tymyLidi.findIndex((x) => x.tymId === Number(b.odebratTymId)); if (i > -1) tymyLidi.splice(i, 1); return {}; }
  const t = tymyLidi.find((x) => x.tymId === Number(b.tymId)); const c = t && t.clenove.find((x) => x.osobaId === Number(b.osobaId)); if (c) c.aktivni = b.aktivni ? 1 : 0; return {}; }));
// kód lékaře dne – stejný výpočet jako src/crypto.js kodDne (telefon ho ověří offline z tajemství '0011…')
const TAJEMSTVI = '00112233445566778899aabbccddeeff00112233';
const kodDne = (datum) => { const h = createHmac('sha256', Buffer.from(TAJEMSTVI, 'hex')).update('kod-dne:' + datum).digest(); return String((((h[0] & 0x7f) << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) % 1000000).padStart(6, '0'); };
const dnesLokalne = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
app.get('/api/c/pacient/:id/linka', j({ dostupne: true, smi: true, telefony: [
  { telefon: '+420777000123', hezky: '+420 777 000 123', popis: 'telefon s kartou', registrovan: true, typ: 'KARTA', datum: den(-20) },
  { telefon: '+420604000777', hezky: '+420 604 000 777', popis: 'telefon pacienta', registrovan: true, typ: 'PECEDOMA', datum: den(-60) },
  { telefon: '+420777000321', hezky: '+420 777 000 321', popis: 'dcera Jana', registrovan: false }] }));
app.get('/api/c/pacient/:id/kod-lekare', j({ kod: kodDne(dnesLokalne()), platiDo: den(1) + 'T00:00:00+02:00', lekar: 'MUDr. Petra Ukázková' }));
app.get('/api/c/zarizeni', j({ zarizeni: [] }));
app.get('/api/c/audit', j({ audit: [], ai: [] }));
app.get('/api/d/parovaci-info', (req, res) => (String(req.query.kod).toUpperCase() === 'PROSLY00' ? res.status(404).json({ ok: false, chyba: 'Kód je neplatný nebo vypršel – vygenerujte v centrální aplikaci nový' }) : res.json({ ok: true, rezim: 'PACIENT', telefon: '+420 604 000 777' })));
app.post('/api/d/parovat', j((req) => (req.body.rezim === 'PACIENT'
  ? { token: `${TENANT}.9.ukazka`, tajemstvi: null, zarizeniId: 9, telefon: '+420 604 000 777', rezim: 'PACIENT', balik: balikPacient, videoToken: 'ukazka-video-token' }
  : { token: `${TENANT}.7.ukazka`, tajemstvi: TAJEMSTVI, zarizeniId: 7, telefon: '+420 777 000 123', rezim: 'ZAPUJCENY', balik })));
app.post('/api/d/sync', j((req) => (prenos.stav === 'prevzato' && String(req.headers.authorization || '').includes('.7.') ? { prikaz: 'smazat' } : String(req.headers.authorization || '').includes('.9.') ? { potvrzeno: [], odmitnuto: [], balik: balikPacient } : { potvrzeno: (req.body.fronta || []).map((e) => e.uuid), odmitnuto: [], balik })));
// výměna telefonu (0.11.95): starý telefon ukáže QR, nový převezme; po převzetí starý telefon synchronizací zjistí zablokování
let prenos = { stav: 'ceka', prevzato: false };
app.post('/api/d/prenos/zahajit', j((req) => { prenos = { stav: 'ceka', prevzato: false, role: req.body.role }; return { kod: 'K7MPX4RT9QWB', kodZobrazeni: 'K7MP-X4RT-9QWB', platnost: new Date(Date.now() + 10 * 60e3).toISOString(), pocet: (req.body.tokeny || []).length, neplatnych: 0, odkaz: 'https://kartapacienta.example/karta/#prenos=K7MPX4RT9QWB' }; }));
app.post('/api/d/prenos/nahled', j(() => ({ pocet: 1, telefon: '+420 777 000 123' })));
app.post('/api/d/prenos/prevzit', j((req) => { prenos.stav = 'prevzato'; prenos.telefon = req.body.telefon; return { karty: [{ tenant: TENANT, token: `${TENANT}.21.novy`, tajemstvi: TAJEMSTVI, zarizeniId: 21, telefon: '+420 777 000 456', balik, videoToken: 'ukazka-video-token' }], neprevzato: 0 }; }));
app.post('/api/d/prenos/stav', j(() => (prenos.stav === 'prevzato' ? { stav: 'prevzato', pocet: 1 } : { stav: 'ceka', zbyva: 540 })));
app.post('/api/d/prenos/zrusit', j({ zruseno: true }));
app.get('/api/c/telefon/prukazy', j({ telefon: '+420 777 000 123', pacienti: [{ id: 7, kod: 'P-0007', jmeno: 'Zkušební Marie', vymena: true, deaktivace: true }, { id: 8, kod: 'P-0008', jmeno: 'Příkladný Josef', vymena: true, deaktivace: true }] }));
app.post('/api/c/telefon/vymena', j((req) => { prenos = { stav: 'ceka', prevzato: false }; return { kod: 'H3QZ7MWK2PRT', kodZobrazeni: 'H3QZ-7MWK-2PRT', platnost: new Date(Date.now() + 30 * 60e3).toISOString(), odkaz: 'https://kartapacienta.example/karta/#prenos=H3QZ7MWK2PRT', stary: '+420 777 000 123', novy: req.body.novyTelefon || '+420 777 000 123', pacienti: ['Zkušební Marie', 'Příkladný Josef'], bezOpravneni: 0 }; }));
app.get('/api/c/telefon/vymena/stav', j(() => (prenos.stav === 'prevzato' ? { stav: 'prevzato', pocet: 2 } : { stav: 'ceka', zbyva: 1740 })));
app.post('/api/c/telefon/vymena/zrusit', j({ zruseno: true }));
app.post('/api/c/telefon/deaktivovat', j({ deaktivovano: 2, zustalo: 0 }));
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
  await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.hidden = true; });   // hlášky z předchozích kroků do snímků nepatří
  await p.evaluate(() => { scrollTo(0, 0); document.querySelectorAll('.box').forEach((b) => (b.scrollTop = 0)); });
  await p.waitForTimeout(350);
  const spatne = await p.evaluate(() => {
    const cek = document.querySelector('.app.wide') ? 38 : 42;
    return [...document.querySelectorAll('select:not([multiple]),input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range])')]
      .filter((e) => e.offsetParent && !e.closest('.hlp-chat,.hlp')).map((e) => ({ id: e.id || e.dataset.k || e.dataset.imr || e.dataset.imt || e.placeholder || e.tagName, v: Math.round(e.getBoundingClientRect().height) }))
      .filter((x) => x.v !== cek).map((x) => `${x.id}=${x.v}px (čekáno ${cek})`);
  });
  if (spatne.length) chyby.push(`${jmeno}: políčka s jinou výškou: ${spatne.join(', ')}`);
  const krive = await p.evaluate(() => [...document.querySelectorAll('.frow')].filter((f) => f.offsetParent).map((f) => {
    const vrsky = [...f.querySelectorAll(':scope > .field > input, :scope > .field > select, :scope > .field > textarea, :scope > .field > .checks')].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().top));
    return vrsky.length > 1 && Math.max(...vrsky) - Math.min(...vrsky) > 1 ? `${[...f.querySelectorAll(':scope > .field > label')].map((l) => l.textContent.trim().slice(0, 20)).join(' | ')} (${vrsky.join('/')})` : '';
  }).filter(Boolean));
  if (krive.length) chyby.push(`${jmeno}: políčka vedle sebe nejsou v jedné úrovni: ${krive.join('; ')}`);
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
await p.goto(`${URL}/centrala/`); await p.waitForSelector('#d_agenda');   // 0.11.90: Pacienti začínají přehledem (dashboard)
if ((await p.$$('[data-dtile]')).length !== 6 || (await p.$$('[data-dbar]')).length < 4) chyby.push('přehled pacientů: chybí dlaždice nebo sloupce');
if (!(await p.textContent('[data-dtile="zhorseni"]')).includes('1')) chyby.push('přehled pacientů: dlaždice zhoršení neukazuje 1');
await p.waitForTimeout(300); await foto(p, 'c-dashboard');
await klik(p, '[data-dbar="misto"][data-dval="Doma"]'); await p.waitForSelector('tr[data-id]');
if ((await p.$$('tr[data-id]')).length !== 2 || !(await p.$('[data-misto="doma"].primary'))) chyby.push('přehled → agenda: sloupec Doma nezapnul filtr Doma');
await klik(p, '#p_dash'); await klik(p, '#d_agenda'); await p.waitForSelector('tr[data-id]');
if (await p.$('#upoz[open]')) chyby.push('Upozornění: při 4 upozorněních má být panel zavřený');
if (!(await p.textContent('#upoz summary .souhrn')).includes('1× probíhá zhoršení stavu')) chyby.push('Upozornění: souhrn zavřeného panelu ' + (await p.textContent('#upoz summary .souhrn')));
await klik(p, '#upoz summary'); await p.waitForSelector('#upoz[open]'); await p.waitForTimeout(150);   // událost toggle přichází až po otevření
if ((await p.evaluate(() => localStorage.getItem('kp_upoz'))) !== '1') chyby.push('Upozornění: rozbalení se nezapamatovalo');
if (!(await p.textContent('tr[data-id="2"]')).includes('domov seniorů · Domov Pohoda') || !(await p.$('tr[data-id="2"].vdomove'))) chyby.push('Pacienti: pacient v domově není označený');
if ((await p.textContent('tr[data-id="1"]')).includes('domov seniorů')) chyby.push('Pacienti: pacient doma je omylem označený jako v domově');
if (!(await p.textContent('thead')).includes('Adresa') || !(await p.textContent('tr[data-id="1"]')).includes('Lipová 12')) chyby.push('Pacienti: chybí sloupec Adresa');
await p.fill('#hl_pac', 'prikladny'); await p.waitForTimeout(100);
if ((await p.$$eval('tr[data-id]', (rs) => rs.filter((r) => !r.hidden).length)) !== 1) chyby.push('hledání v pacientech nevyfiltrovalo jediný řádek');
if ((await p.textContent('#hlp_pac')) !== '1 z 3') chyby.push('hledání: špatný počet ' + (await p.textContent('#hlp_pac')));
await p.fill('#hl_pac', ''); await p.waitForTimeout(100);
await p.evaluate(() => localStorage.removeItem('kp_upoz'));
await klik(p, '#p_stitky'); await p.waitForSelector('#st_tisk');
if ((await p.$$('[data-stp]')).length !== 3 || (await p.$$('[data-stp]:checked')).length !== 2) chyby.push('štítky: čekáno 3 pacienti a 2 předvybraní s telefonem');
if (!(await p.textContent('#st_pocet')).startsWith('2 štítků')) chyby.push('štítky: počet ' + (await p.textContent('#st_pocet')));
await foto(p, 'c-stitky');
// 0.11.83: štítek pro telefon s více pacienty – jeden na telefon, bez jmen
await klik(p, '#st_telefony'); await p.waitForSelector('#sm_tisk');
if ((await p.$$('[data-smt]')).length < 1 || !(await p.$('[data-smk]')) || !(await p.$('[data-smd]'))) chyby.push('štítek telefonu: chybí telefony, Zapůjčeno komu nebo datum');
await p.fill('[data-smk="0"]', 'DS C Otrokovice, 2. patro'); await foto(p, 'c-stitky-telefon');
// 0.11.84: náhled vytištěného štítku – číslo telefonu, na který se lepí
await p.check('[data-smt="0"]'); await p.fill('#sm_org', 'Centrum pro léčbu bolesti a paliativní medicínu s.r.o.');   // nejdelší název – kontrola, že se text vejde
{ const cekej = p.context().waitForEvent('page', { timeout: 8000 }).catch(async (e) => { throw new Error('štítek telefonu: okno tisku se neotevřelo – ' + (await p.textContent('#toast').catch(() => ''))); }); await p.click('#sm_tisk'); const okno = await cekej; await okno.waitForLoadState(); await okno.setViewportSize({ width: 900, height: 420 });
  const t = await okno.textContent('.st'); if (!t.includes('Tento telefon') || !t.includes('777 000 123') || !t.includes('DS C Otrokovice')) chyby.push('štítek telefonu: chybí číslo telefonu nebo komu je zapůjčený');
  const pres = await okno.evaluate(() => [...document.querySelectorAll('.st')].some((e) => e.scrollHeight > e.clientHeight + 1)); if (pres) chyby.push('štítek telefonu: text se nevejde na 70 × 37 mm');
  await okno.screenshot({ path: path.join(VYSTUP, 'c-stitky-tisk.png'), clip: { x: 0, y: 0, width: 900, height: 420 } }); await okno.close(); }
await p.evaluate(() => KP.closeModal());
await foto(p, 'c-pacienti');
if (!(await p.$('[data-misto="ds"]'))) throw new Error('seznam pacientů: chybí filtr Kde je');
await klik(p, '[data-misto="ds"]'); await p.waitForTimeout(200);
if ((await p.$$('tr[data-id]')).length !== 1) throw new Error('seznam pacientů: filtr DS neukazuje jednoho pacienta');
await klik(p, '[data-misto=""]'); await p.waitForTimeout(200);
await klik(p, '.nav button[data-v="novy"]'); await p.waitForSelector('#w_json', { state: 'attached' });
await foto(p, 'c-novy-1');
await p.setInputFiles('#w_csvp', { name: 'pacienti.csv', mimeType: 'text/csv', buffer: Buffer.from('\ufeffjmeno;prijmeni;rodne_cislo;datum_narozeni;pohlavi;pobyt;adresa;telefon_karty;cil;limity;dg;kontakt1_jmeno;kontakt1_telefon;kontakt1_skupina\nMarie;Vzorová;460512/1234;1946-05-12;žena;doma;Dlouhá 12, Zlín;+420 777 000 123;symptom;KPR | Hospitalizace;C50 karcinom prsu;Jana Vzorová, dcera;+420 777 000 321;ROZHODUJE\nJosef;Dvořák;480508/1111;;muž;Domov Pohoda, pokoj 12;Otrokovice;601 111 222;limited;KPR;CHOPN IV;Petr Dvořák, syn;602 333 444;INFORMOVAT\nKarel;Bezčísla;;;muž;doma;;;symptom;;;;;\n') });
await p.waitForSelector('#hr_b tr'); await p.waitForTimeout(300); await foto(p, 'c-novy-csv'); await p.evaluate(() => closeModal());
await klik(p, '#w_pd'); await p.waitForSelector('#pdq'); await klik(p, '#pdf [data-f="t720"]'); await p.waitForSelector('tr[data-k]'); await p.waitForTimeout(300);
await foto(p, 'c-novy-pecedoma');
// 0.11.78: hromadný výběr – zatržítka, Založit vybrané → náhled s doplněním telefonu
for (const tr of await p.$$('tr[data-k] td:nth-child(2)')) await tr.click();   // 0.11.79: klik na řádek zatrhne, okno zůstane
if ((await p.$$('[data-kv]:checked')).length !== 2) throw new Error('výběr z PéčeDoma: klepnutí na řádek klienta nezatrhlo');
await klik(p, '#pdhr'); await p.waitForSelector('#hr_b tr'); await p.waitForTimeout(400); await foto(p, 'c-novy-pecedoma-hromadne');
if ((await p.$$('#hr_b tr')).length !== 2 || !(await p.$('[data-hrtel]'))) throw new Error('hromadný výběr z PéčeDoma: v náhledu chybí řádky nebo pole telefonu');
await p.evaluate(() => KP.closeModal());
await p.setInputFiles('#w_json', { name: 'karta-pacienta-vzorova.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pecedomaJson)) });
await p.waitForSelector('#n_tk', { timeout: 8000 }).catch(async (e) => { console.error('toast:', await p.textContent('#toast').catch(() => '')); throw e; }); await p.waitForTimeout(3500); // toast zmizí
await foto(p, 'c-novy-2', { vyska: 1100 });
await klik(p, '.nav button[data-v="pacienti"]'); await klik(p, '#d_agenda'); await klik(p, 'tr[data-id="1"]'); await p.waitForSelector('.tabs [data-t="karta"].on');
const zalozka = async (t, jmeno, o) => { await klik(p, `.tabs [data-t="${t}"]`); await p.waitForTimeout(200); await foto(p, jmeno, o); };
await zalozka('dg', 'c-dg', { vyska: 900 });
await klik(p, '.tabs [data-t="leky"]'); await p.waitForSelector('#lk_seznam table'); await foto(p, 'c-leky', { vyska: 1000 });
await klik(p, '#lk_novy'); await p.waitForSelector('#lk_save'); await p.fill('#lk_n', 'Paracetamol'); await p.fill('#lk_d', '1 g p.o.'); await p.fill('#lk_i', 'při horečce'); await p.selectOption('#lk_t', 'ZACHRANNA');
await foto(p, 'c-leky-pridat', { vyska: 900 }); await p.evaluate(() => KP.closeModal());
await zalozka('karta', 'c-karta', { vyska: 1000 });
if (!((await p.textContent('#tabbody .card')) || '').includes('Zhoubný novotvar prsu')) chyby.push('krizová karta v centrále: chybí popis diagnózy z číselníku');
// videohovor (0.11.45): z telefonu volá sestra → červený pruh s Připojit se
if (!(await p.$('#vidZahajit'))) chyby.push('centrála: chybí tlačítko Videohovor na telefon');
await p.evaluate(async () => { await fetch('/__mock/video', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 3, mistnost: 'kp-p0007-sestra', stav: 'ZVONI', zahajil: 'TELEFON', zahajilJmeno: 'hospic Sestra Lucie Příkladná', zahajeno: '2026-10-27 09:12' }) }); S.pac.video = await C(`/pacient/${S.pacId}/video`); kresliDetail(); });
await p.waitForSelector('#vidPripojit'); await foto(p, 'c-video', { vyska: 700 });
// pruh v každé agendě (0.11.47): hovor zvoní i na přehledu pacientů
await p.evaluate(async () => { await videoGlobalPoll(); vidZvonit(false); S.view = 'pacienti'; render(); }); await p.waitForSelector('#vidglobal [data-vidjoin]'); await p.waitForSelector('tr[data-id]'); await p.waitForTimeout(300);
await foto(p, 'c-video-pruh', { vyska: 600 });
await p.evaluate(() => { S.view = 'detail'; render(); }); await p.waitForSelector('.tabs');
await p.evaluate(async () => { await fetch('/__mock/video', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); S.pac.video = await C(`/pacient/${S.pacId}/video`); kresliDetail(); });
await p.waitForSelector('#vidZahajit');
await klik(p, '#pd_chat'); await p.waitForSelector('#chat_l .msg');
await foto(p, 'c-chat-pecedoma', { vyska: 900 });
await p.evaluate(() => KP.closeModal());
await zalozka('plan', 'c-plan', { vyska: 1050 });
// 0.11.92: limitace – dvě možnosti, našeptávač diagnóz, živý náhled karty v telefonu
if ((await p.$$('input[name="f_kpr"]')).length !== 2 || !(await p.$('#f_dvpsek:not([hidden])'))) chyby.push('plán: chybí volba limitace (KPR neuvedeno / DVP)');
await p.fill('#f_dgq', 'novotvar'); await p.waitForSelector('#f_dgn [data-dgk]'); await klik(p, '#f_dgn [data-dgk]');
if (!(await p.inputValue('#f_dg')).includes('C509')) chyby.push('plán: našeptávač nevložil diagnózu');
await klik(p, '[data-np]'); await p.waitForSelector('#np_frame');
{ const fr = p.frameLocator('#np_frame'); await fr.locator('.card').waitFor(); await p.fill('#f_al', 'penicilin, náplasti'); await p.waitForTimeout(700);
  const t = await fr.locator('.card').textContent();
  if (!t.includes('penicilin, náplasti') || !t.includes('DŘÍVE VYSLOVENÉ PŘÁNÍ') || !t.includes('MEDIKACE') || !t.includes('Zhoubný novotvar prsu')) chyby.push('živý náhled: karta se neaktualizovala podle formuláře nebo chybí nové dlaždice');
  if (t.includes('PŘÍŠTÍ NÁVŠTĚVA')) chyby.push('živý náhled: karta ještě ukazuje příští návštěvu');
  if (!(await p.$('#tabbody > .grid2 > :last-child > #np_panel .iphone'))) chyby.push('živý náhled: telefon není v pravém sloupci v rámečku iPhonu');
  await p.waitForTimeout(300); await foto(p, 'c-nahled-karty', { vyska: 1050 });
  await klik(p, '[data-npr="sestra"]'); await fr.locator('.tile').first().waitFor({ timeout: 5000 }).catch(() => chyby.push('živý náhled: role sestra kartu neodemkla'));
  await klik(p, '#np_zav'); }
await zalozka('denik', 'c-denik');
await zalozka('kontakty', 'c-kontakty');
// kontrola chování záložky Důležité kontakty: úprava ve formuláři, přeřazení šipkami, přidání na konec
{
  const jmena = async () => p.$$eval('#tabbody .tbl tbody tr td:nth-child(3) b', (els) => els.map((e) => e.textContent.trim()));
  await klik(p, '[data-ked="2"]'); await p.waitForSelector('#k_zrusit');
  if ((await p.inputValue('#k_j')) !== 'Petr Zkušební, syn') chyby.push('Upravit kontakt nenačetl kontakt do formuláře');
  await foto(p, 'c-kontakty-upravit', { vyska: 700 });
  await p.fill('#k_j', 'Petr Zkušební, syn (víkendy)'); await klik(p, '#k_ok'); await p.waitForTimeout(400);
  if (!(await jmena()).includes('Petr Zkušební, syn (víkendy)')) chyby.push('úprava kontaktu se neuložila');
  if (await p.$('#k_zrusit')) chyby.push('po uložení zůstal formulář v režimu úpravy');
  await klik(p, '[data-kmv="3|-1"]'); await p.waitForTimeout(600);
  const po = await jmena(); if (po[1] !== 'Hospic Ukázka – sestra 24/7') chyby.push('šipka nahoru nepřeřadila kontakt: ' + po.join(' | '));
  await p.fill('#k_j', 'Eva Nová, sousedka'); await p.fill('#k_t', '777 000 999'); await klik(p, '#k_ok'); await p.waitForTimeout(400);
  const po2 = await jmena(); if (po2[po2.length - 1] !== 'Eva Nová, sousedka') chyby.push('nový kontakt není na konci: ' + po2.join(' | '));
  await klik(p, '[data-kmv="3|1"]'); await p.waitForTimeout(600);   // vrátit pořadí pro další snímky
  await klik(p, '#tabbody .tbl tbody tr:last-child [data-kdel]'); await p.waitForSelector('#kpOk'); await klik(p, '#kpOk'); await p.waitForTimeout(400);
  // výchozí kontakty organizace (0.11.70): zatržení u klienta, úprava z klienta se propíše do sady, odebrání u klienta
  if (!(await p.textContent('#tabbody')).includes('Výchozí kontakty organizace')) chyby.push('chybí panel Výchozí kontakty organizace');
  await p.check('[data-kvpouzit="2"]'); await p.waitForTimeout(500);
  if (!(await jmena()).includes('Sloužící sestra')) chyby.push('zatržení výchozího kontaktu ho nepřidalo ke klientovi');
  await foto(p, 'c-kontakty-vychozi', { vyska: 900 });
  const radek = await p.$$eval('#tabbody .tbl tbody tr', (rs) => rs.findIndex((r) => r.textContent.includes('Sloužící sestra')));
  const kid = await p.$$eval('#tabbody .tbl tbody tr', (rs, i) => (rs[i].querySelector('[data-ked]') || {}).dataset.ked, radek);
  await klik(p, `[data-ked="${kid}"]`); await p.waitForSelector('#k_zrusit');
  if (!(await p.textContent('#tabbody')).includes('propíše')) chyby.push('úprava výchozího kontaktu neupozorňuje na propsání všem klientům');
  await p.fill('#k_t', '+420 722 000 006'); await klik(p, '#k_ok'); await p.waitForTimeout(500);
  if (!(await p.textContent('#tabbody')).includes('+420 722 000 006')) chyby.push('úprava výchozího kontaktu se nepropsala');
  await klik(p, '[data-ked="2"]'); await p.waitForSelector('[data-kvzvl="2"]'); await klik(p, '[data-kvzvl="2"]'); await p.waitForSelector('#kpOk'); await klik(p, '#kpOk'); await p.waitForTimeout(500);
  if (!(await p.$('[data-kvpouzit="4"]'))) chyby.push('Udělat výchozím nepřidalo kontakt do sady výchozích');
  await p.uncheck('[data-kvpouzit="2"]'); await p.waitForTimeout(500);
  if ((await jmena()).includes('Sloužící sestra')) chyby.push('odškrtnutí výchozího kontaktu ho u klienta neodebralo');
}
await zalozka('tym', 'c-tym', { vyska: 1150 });
// kontrola chování: deaktivace člena, aktivace zpět, přidání týmu, odebrání
{
  const stav = async (oid) => p.$eval(`[data-tlcl^="1|${oid}|"]`, (b) => b.textContent.trim());
  await klik(p, '[data-tlcl="1|2|0"]'); await p.waitForTimeout(400);
  if ((await stav(2)) !== 'Aktivovat') chyby.push('deaktivace člena týmu u pacienta se neprojevila');
  await klik(p, '[data-tlcl="1|2|1"]'); await p.waitForTimeout(400);
  if ((await stav(2)) !== 'Deaktivovat') chyby.push('aktivace člena týmu u pacienta se neprojevila');
  await p.selectOption('#tl_sel', '2'); await klik(p, '#tl_ok'); await p.waitForTimeout(500);
  if (!(await p.textContent('#tabbody')).includes('Tým Otrokovice · Hospic Ukázka')) chyby.push('přidání týmu k pacientovi se neprojevilo');
  await klik(p, '[data-tlodeb="2"]'); await p.waitForSelector('#kpOk'); await klik(p, '#kpOk');
  try { await p.waitForSelector('[data-tlodeb="2"]', { state: 'detached', timeout: 4000 }); } catch { chyby.push('odebrání týmu u pacienta se neprojevilo: ' + (await p.evaluate(() => (document.getElementById('toast') || {}).textContent || ''))); }
  await p.waitForTimeout(300);
}
await zalozka('telefon', 'c-telefon', { vyska: 1000 });
// 0.11.96: výměna telefonu z centrály – QR kód pro nový telefon, po převzetí Hotovo (starý telefon deaktivovaný)
await klik(p, '#vymenaTel'); await p.waitForSelector('#vt_qr'); await p.fill('#vt_novy', '+420 777 000 456');
await foto(p, 'c-vymena-telefonu', { vyska: 900 });
await klik(p, '#vt_qr'); await p.waitForSelector('#vt_stav'); await p.waitForTimeout(400);
if (!(await p.$('#modal .qr svg'))) chyby.push('výměna telefonu v centrále: chybí QR kód');
await foto(p, 'c-vymena-qr', { vyska: 900 });
await p.evaluate(() => fetch('/api/d/prenos/prevzit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kod: 'H3QZ7MWK2PRT', telefon: '+420 777 000 456' }) }));
await p.waitForFunction(() => /Hotovo/.test((document.querySelector('#modal h2') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => chyby.push('výměna telefonu v centrále: po převzetí se neukázalo Hotovo'));
await p.evaluate(() => KP.closeModal()); prenos = { stav: 'ceka', prevzato: false };
await klik(p, '#parovat'); await p.waitForSelector('#pr_sms');
await foto(p, 'c-parovani', { vyska: 1000 });
// 0.11.91: vytištěné párování do terénu – platnost 3 dny, A4 s QR kódem a postupem
await p.selectOption('#pr_plat', '72'); await p.waitForSelector('#pr_tisk');
{ const cekej = p.context().waitForEvent('page', { timeout: 10000 }); await p.click('#pr_tisk'); const okno = await cekej; await okno.waitForSelector('.qr svg'); await okno.waitForTimeout(600);
  await okno.setViewportSize({ width: 900, height: 1250 });
  const t = await okno.textContent('body'); if (!t.includes('Postup u pacienta') || !t.includes('TYJR') || !t.includes('Zkušební Marie') || t.includes('Připravuji')) chyby.push('tisk párování: chybí postup, kód nebo pacient');
  if (await okno.evaluate(() => [...document.images].some((i) => !i.complete || !i.naturalWidth))) chyby.push('tisk párování: nenačetlo se logo');
  const pdf = await okno.pdf({ format: 'A4', printBackground: true }); if ((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length !== 1) chyby.push('tisk párování: nevešlo se na jednu stranu A4');
  await okno.screenshot({ path: path.join(VYSTUP, 'c-parovani-tisk.png'), fullPage: true }); console.log('  ✓ c-parovani-tisk'); await okno.close(); }
await p.waitForSelector('#pr_sms'); await p.evaluate(() => KP.closeModal());
if (!(await p.textContent('#tabbody')).includes('dcera Jana') || !(await p.$('[data-pzrusit="11"]')) || !(await p.$('[data-pznovu="11"]'))) chyby.push('vlastní telefony: čekající odkaz pro rodinu bez přehledu nebo tlačítek Zrušit / Poslat znovu');
await klik(p, '#pacientovi'); await p.waitForSelector('#pz_t'); await p.fill('#pz_t', '+420 604 000 777'); await p.fill('#pz_s', 'telefon pacienta');
if (!(await p.inputValue('#pz_txt')).includes('{odkaz}')) chyby.push('zpřístupnění pacientovi: chybí text SMS se značkou {odkaz}');
await p.fill('#pz_txt', 'Dobrý den, MUDr. Ukázková vám zpřístupnila váš paliativní průkaz. Otevřete prosím odkaz v tomto telefonu: {odkaz} (platí 3 dny). Hospic Ukázka'); await p.evaluate(() => localStorage.removeItem('kp_sms_pacient'));
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
await klik(p, '[data-st="nast"]'); await p.waitForSelector('#pd_ok');
await p.evaluate(() => document.querySelector('#pd_o').scrollIntoView({ block: 'center' }));
await foto(p, 'c-nastaveni-pecedoma', { vyska: 1000 });
await klik(p, '.nav button[data-v="lide"]'); await p.waitForSelector('tr[data-oid]');
await p.selectOption('#lf', ''); await p.waitForSelector('tr[data-oid="9"]');
await foto(p, 'c-lide', { vyska: 1300 });
await klik(p, '[data-tid="1"]'); await p.waitForSelector('#tm_ok'); await p.waitForSelector('[data-ttel]');
if ((await p.$$('[data-ttel]')).length !== 2 || (await p.$$('[data-ttel]:checked')).length !== 1) chyby.push('okno týmu: chybí telefony s kartou');
if ((await p.$$('[data-tcl]:checked')).length !== 5) chyby.push('okno týmu nemá zaškrtnuté členy týmu');
await foto(p, 'c-tym-okno');
await p.evaluate(() => KP.closeModal());
// 0.11.86: leták k telefonu – A4 z řádku týmu se zatrženým telefonem
{ const cekej = p.context().waitForEvent('page', { timeout: 10000 }); await klik(p, '[data-tletak="2"]'); const okno = await cekej; await okno.waitForLoadState(); await okno.waitForTimeout(600);
  await okno.setViewportSize({ width: 900, height: 1250 });
  const t = await okno.textContent('body'); if (!t.includes('+420 722 916 951') || !t.includes('Zkušební Marie') || !t.includes('Jak ho použít')) chyby.push('leták k telefonu: chybí číslo, pacienti nebo návod');
  if (await okno.evaluate(() => [...document.images].some((i) => !i.complete || !i.naturalWidth))) chyby.push('leták k telefonu: nenačetlo se logo nebo obrázek telefonu');
  { const pdf = await okno.pdf({ format: 'A4', printBackground: true }); const stran = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; require_fs_ulozit: { const fs = await import('node:fs'); fs.writeFileSync(process.env.LETAK_PDF || '/dev/null', pdf); }
  if (stran !== 1) chyby.push(`leták k telefonu: 20 pacientů se nevešlo na jednu stranu A4 (${stran} stran)`); }
  await okno.screenshot({ path: path.join(VYSTUP, 'c-letak-telefon.png'), fullPage: true }); console.log('  ✓ c-letak-telefon'); await okno.close(); }
await klik(p, '[data-tid="1"]'); await p.waitForSelector('#tm_ok');
await klik(p, '#tm_piny'); await p.waitForSelector('#kpOk'); await klik(p, '#kpOk'); await p.waitForSelector('#pn_tisk');
if ((await p.$$('.modal .tbl tbody tr')).length !== 5) chyby.push('kartičky týmu: čekáno 5 PINů, je ' + (await p.$$('.modal .tbl tbody tr')).length);
if (!(await p.textContent('.modal')).includes('nový PIN')) chyby.push('kartičky týmu: chybí označení nového PINu');
await foto(p, 'c-tym-piny');
await p.evaluate(() => KP.closeModal());
await klik(p, '#l_pd'); await p.waitForSelector('#im_ok');
await p.setViewportSize({ width: 1200, height: 900 }); await foto(p, 'c-lide-import');
await klik(p, '#im_ok'); await p.waitForSelector('#pn_tisk'); await p.waitForTimeout(3600);
await foto(p, 'c-piny'); await p.setViewportSize({ width: 1200, height: 760 });
await p.evaluate(() => KP.closeModal());
await klik(p, 'tr[data-oid="2"]'); await p.waitForSelector('#os_ok');
await foto(p, 'c-osoba');
await p.evaluate(() => KP.closeModal());
await klik(p, '.nav button[data-v="pacienti"]'); await p.waitForSelector('#d_agenda');
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
await p.goto(`${URL}/karta/#p=${TENANT}.PROSLY00`); await p.waitForSelector('#p_chyba');   // prošlý kód z odkazu → hláška a hned možnost načíst nový QR kód
if (!(await p.$('#p_qr')) || !(await p.$('#p_k')) || (await p.evaluate(() => location.hash)) !== '') chyby.push('prošlý kód: chybí tlačítko Načíst QR kód, pole pro kód nebo zůstal odkaz v adrese');
await p.goto(`${URL}/karta/`); await p.waitForSelector('#p_qr');
await foto(p, 'k-parovani');
await klik(p, '#p_qr'); await p.waitForSelector('#qr_v'); await p.waitForTimeout(800);
await foto(p, 'k-qr');
await klik(p, '#qr_zpet');
await p.goto(`${URL}/karta/#p=${TENANT}.TYJRRRQH`); await p.waitForSelector('#p_tel');
await p.fill('#p_tel', '+420 777 000 123'); await klik(p, '#p_ok');
await p.waitForSelector('#unCarer'); await p.waitForTimeout(3500);
if (!(await p.textContent('#rezim')).includes('Karta týmu')) chyby.push('Karta: chybí pruh Karta týmu');
await foto(p, 'k-zamceno');
if (!(await p.$('#t_pridat'))) chyby.push('Karta: na zamčené kartě chybí tlačítko Přidat dalšího pacienta do telefonu');   // 0.11.81
// více průkazů v jednom telefonu (0.11.0): druhý průkaz jen v paměti stránky → obrazovka výběru pacienta, pak zpět k paní Zkušební
await p.evaluate(() => { const k2 = JSON.parse(JSON.stringify(KARTY[0])); k2.zarizeniId = 8; k2.balik.pacient = { ...k2.balik.pacient, kod: 'P-0008', jmeno: 'Josef', prijmeni: 'Příkladný', rok: 1938, pobyt: 'Domov Pohoda, pokoj 12' }; k2.balik.denik = []; k2.fronta = []; KARTY.push(k2); D = null; kresli(); });
await p.waitForSelector('[data-karta]'); await foto(p, 'k-vyber', { vyska: 900 });
if ((await p.$$('[data-karta]')).length !== 2) chyby.push('výběr pacienta neukazuje oba průkazy');
await klik(p, '[data-karta="7"]'); await p.waitForSelector('#unCarer');
if (!/Zkušební/.test(await p.textContent('#top'))) chyby.push('výběr pacienta neotevřel správný průkaz');
await p.evaluate(() => { KARTY.splice(1); kresli(); });   // dál s jedním průkazem jako dřív
await p.waitForSelector('#unCarer');
await p.fill('#zzs_p', 'Jan Rychlý, RZP Zlín 12'); await p.evaluate(() => document.querySelector('#zzs_p').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(300); await p.screenshot({ path: path.join(VYSTUP, 'k-zzs.png') }); console.log('  ✓ k-zzs');
// lékař bez PINu: kód dne (dnešní i včerejší projde, jiný ne), pak zamknout a odemknout PINem týmu
await klik(p, '#unDoc'); await p.fill('#kod', '000000'); await p.fill('#kodJ', 'MUDr. Test'); await klik(p, '#kodOk'); await p.waitForTimeout(600);
if (await p.$('.tile[data-tab]')) chyby.push('špatný kód lékaře odemkl kartu');
await p.fill('#kod', kodDne(dnesLokalne())); await klik(p, '#kodOk'); await p.waitForSelector('.tile[data-tab]', { timeout: 15000 });
if (!/MUDr\. Test/.test(await p.textContent('#work'))) chyby.push('kód dne neodemkl kartu jako lékaře');
await klik(p, '.tile[data-tab="leky"]'); await p.waitForSelector('#lk_seznam table');
await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.hidden = true; });   // hláška o špatném kódu z testu výše
await foto(p, 'k-leky-lekar', { vyska: 1300 });
await p.evaluate(() => window.scrollTo(0, 0));
await klik(p, '#btnZamek'); await p.waitForSelector('#unRodina');
await klik(p, '#unCarer'); await p.fill('#pin', '123456'); await klik(p, '#pinOk');
await p.waitForSelector('.tile[data-tab]', { timeout: 15000 }); await p.waitForTimeout(3500);
await klik(p, '.tile[data-tab="dg"]'); await p.waitForTimeout(200); await foto(p, 'k-diagnoza');
await klik(p, '.tile[data-tab="leky"]'); await p.waitForTimeout(200); await foto(p, 'k-leky');
await klik(p, '.tile[data-tab="karta"]'); await p.waitForTimeout(300);
await foto(p, 'k-odemceno');
await p.evaluate(() => { const el = document.querySelector('.sec.green'); if (el) el.scrollIntoView({ block: 'center' }); });
await p.waitForTimeout(300); await p.screenshot({ path: path.join(VYSTUP, 'k-navsteva.png') }); console.log('  ✓ k-navsteva');
await p.evaluate(() => { const el = document.querySelector('#pdChat'); if (el) el.scrollIntoView({ block: 'center' }); });
await klik(p, '#pdChat'); await p.waitForSelector('#chat_l .msg'); await p.waitForTimeout(300);
await p.screenshot({ path: path.join(VYSTUP, 'k-chat.png') }); console.log('  ✓ k-chat');
await p.evaluate(() => closeModal()); await p.waitForTimeout(200); await klik(p, '.tile[data-tab="zpravy"]'); await p.waitForSelector('#pdVlakno .msg'); await p.waitForTimeout(300);
await foto(p, 'k-zpravy');
await p.evaluate(() => KP.closeModal());
await p.evaluate(() => window.scrollTo(0, 0));
if (!(await p.textContent('.tiles')).includes('Interní poznámky') || !(await p.textContent('.tiles')).includes('Poznámky pacienta')) chyby.push('karta: dlaždice Interní poznámky / Poznámky pacienta chybí');
await klik(p, '.tile[data-tab="odpac"]'); await p.waitForSelector('.chip.vio');
if (!(await p.textContent('#work')).includes('Co je pro mě důležité')) chyby.push('karta: Poznámky pacienta neukazují sdílené přání');
await foto(p, 'k-od-pacienta', { vyska: 1300 });
await klik(p, '.tile[data-tab="denik"]'); await p.waitForSelector('#d_txt'); await p.fill('#d_txt', 'Odpoledne klidná, napila se, bolest 2/10.');
await foto(p, 'k-denik');
await klik(p, '.tile[data-tab="zhorseni"]'); await p.waitForSelector('#btnZ');
await p.click('#z_sym input[value="dušnost"]'); await p.click('#z_akce input[value="podán SOS lék"]');
await foto(p, 'k-zhorseni', { vyska: 1150 });
// videohovor (0.11.45): dlaždice po odemknutí, pak příchozí hovor z centrály na zamčené kartě
await p.evaluate(() => videoPoll()); await p.waitForTimeout(400);
if (!(await p.$('.tile[data-tab="video"]'))) chyby.push('karta: chybí dlaždice Videohovor');
await klik(p, '.tile[data-tab="video"]'); await p.waitForSelector('#vidZahajit'); await foto(p, 'k-video');
await klik(p, '#btnZamek'); await p.waitForSelector('#unRodina');
await p.evaluate(async () => { await fetch('/__mock/video', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 2, mistnost: 'kp-p0007-xyz', stav: 'ZVONI', zahajil: 'CENTRALA', zahajilJmeno: 'MUDr. Petra Ukázková', zahajeno: '2026-10-27 09:20' }) }); await videoPoll(); });
await p.waitForSelector('#vidPrijmout', { timeout: 5000 }); await p.evaluate(() => zvonit(false)); await foto(p, 'k-video-zvoni');
await p.evaluate(async () => { await fetch('/__mock/video', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); await videoPoll(); });
// výměna telefonu (0.11.95): starý telefon (tým odemčený PINem) → dlaždice Tým → Výměna telefonu → QR; nový telefon převezme
await p.evaluate(() => { closeModal(); U = { role: 'sestra', jmeno: 'Lucie', posledni: Date.now() }; tab = 'udaje'; kresli(); });
await p.waitForSelector('#t_prenos'); await klik(p, '#t_prenos'); await p.waitForSelector('#kpOk'); await klik(p, '#kpOk');
await p.waitForSelector('#prenosZrusit', { timeout: 8000 }); await p.waitForTimeout(400);
if (!(await p.$('#modal svg'))) chyby.push('výměna telefonu: starý telefon neukázal QR kód');
await foto(p, 'k-vymena-stary', { vyska: 900 });
{ const n = await stranka({ mobil: true });
  await n.goto(`${URL}/karta/#prenos=K7MPX4RT9QWB`); await n.waitForSelector('#pr_ok');
  await n.waitForFunction(() => (document.querySelector('#pr_tel') || {}).value === '+420 777 000 123', null, { timeout: 8000 });
  await n.fill('#pr_tel', '+420 777 000 456');
  await foto(n, 'k-vymena-novy', { vyska: 900 });
  await klik(n, '#pr_ok'); await n.waitForSelector('#modal h2'); await n.waitForTimeout(300);
  if (!/převzaty/.test(await n.textContent('#modal h2'))) chyby.push('výměna telefonu: nový telefon průkazy nepřevzal');
  if ((await n.evaluate(() => KARTY.length)) !== 1) chyby.push('výměna telefonu: v novém telefonu není převzatý průkaz');
  await n.close(); }
await p.waitForFunction(() => /Hotovo/.test((document.querySelector('#modal h2') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => chyby.push('výměna telefonu: starý telefon se po převzetí nevymazal'));
if ((await p.evaluate(() => KARTY.length)) !== 0) chyby.push('výměna telefonu: ve starém telefonu zůstal průkaz');
await p.close();

console.log('Karta pacienta uvnitř PéčeDoma');
p = await stranka();
await p.goto(`${URL}/pd/#v=ukazka.vstupenka`); await p.waitForSelector('#ulozPlan'); await p.waitForTimeout(400);
await foto(p, 'pd-karta', { vyska: 1100 });
await p.fill('#f_poz', 'úprava z PéčeDoma'); await klik(p, '#ulozPlan'); await p.waitForTimeout(800);
if (!(await p.textContent('#work')).includes('PéčeDoma: MUDr. Petra Ukázková')) chyby.push('/pd/: nová verze plánu z PéčeDoma se po uložení neukázala');
await p.close();

console.log('Můj průkaz (telefon pacienta)');
p = await stranka({ mobil: true });
await p.goto(`${URL}/pacient/#p=${TENANT}.MPK4R7ZD`); await p.waitForSelector('#p_tel');
await p.waitForFunction(() => (document.querySelector('#p_tel') || {}).value === '+420 604 000 777', null, { timeout: 8000 });   // číslo předvyplněné ze serveru
await foto(p, 'p-propojeni');
await klik(p, '#p_ok'); await p.waitForSelector('#np1');
await p.fill('#np1', '258147'); await p.fill('#np2', '258147');
await foto(p, 'p-pin');
await klik(p, '#np_ok'); await p.waitForSelector('.tile[data-tab="prani"]', { timeout: 20000 }); await p.waitForTimeout(3500);
await foto(p, 'p-prehled', { vyska: 1500 });
await p.evaluate(() => { const el = document.querySelector('#pdChat'); if (el) el.scrollIntoView({ block: 'center' }); });
await p.waitForTimeout(300); await p.screenshot({ path: path.join(VYSTUP, 'p-zpravy.png') }); console.log('  ✓ p-zpravy');
await klik(p, '#pdChat'); await p.waitForSelector('#chat_l .msg'); await p.waitForTimeout(300);
await p.screenshot({ path: path.join(VYSTUP, 'p-zpravy-chat.png') }); console.log('  ✓ p-zpravy-chat');
await p.evaluate(() => KP.closeModal());
await klik(p, '.tile[data-tab="prani"]'); await p.waitForSelector('#pr_ok');
await p.fill('#pr_dulezite', 'Zůstat doma s dcerou a vnoučaty, nemít bolesti, mít jasnou hlavu na rozhovory.');
await p.fill('#pr_obavy', 'Dušení a převozu do nemocnice v noci.');
await p.fill('#pr_rozhodovani', 'Raději úleva než léčba za každou cenu.');
await p.fill('#pr_kdo', 'dcera Jana, 777 000 321');
await p.selectOption('#pr_puvod', 'rozhovor'); await p.fill('#pr_rk', 'MUDr. Ukázková, hospic');
await klik(p, '#pr_ok'); await p.waitForSelector('.banner.ok.keep'); await p.waitForTimeout(3300);
await foto(p, 'p-prani', { vyska: 1500 });
await klik(p, '.tile[data-tab="leky"]'); await p.waitForSelector('.lkskup');
if (await p.$('#lk_novy')) chyby.push('Můj průkaz: pacient nesmí mít tlačítko Přidat lék');
if (!(await p.textContent('#rezim')).includes('Karta pacienta a rodiny')) chyby.push('Můj průkaz: chybí pruh Karta pacienta a rodiny');
if (!(await p.textContent('#work')).includes('Předepsané léky')) chyby.push('Můj průkaz: chybí panel Předepsané léky');
if ((await p.$$('.lkskup')).length !== 3) chyby.push('Můj průkaz: předepsané léky nejsou ve 3 skupinách');
await klik(p, '.lkskup.crit [data-pod]');                                   // opioid: Podán
await p.waitForSelector('.lkskup.crit .lbl b');
if (!(await p.textContent('.lkskup.crit')).includes('dnes')) chyby.push('Můj průkaz: záznam podání se nezapsal do řádku léku');
await klik(p, '#pod_hist'); await p.waitForSelector('.modal .chip.ok'); await p.evaluate(() => KP.closeModal());
await p.waitForTimeout(3500);
await foto(p, 'p-leky', { vyska: 1700 });
await klik(p, '.tile[data-tab="poznamky"]'); await p.fill('#pz_t', 'Můžu brát Morphin i přes den, když bolí víc?'); await klik(p, '#pz_ok'); await p.waitForTimeout(300);
await klik(p, '.tile[data-tab="sdilet"]'); await p.waitForSelector('#sd_nahled');
await p.check('.vyber input[value="KARTA"]'); await p.waitForTimeout(3300);   // toast „Uloženo“ zmizí
await foto(p, 'p-sdilet', { vyska: 1200 });
await klik(p, '#sd_nahled'); await p.waitForSelector('#sd_tym');
await foto(p, 'p-nahled');
await klik(p, '#sd_tym'); await klik(p, '#kpOk'); await p.waitForTimeout(500);
const rucni = sdileno.filter((x) => !x.auto), auto = sdileno.filter((x) => x.auto);
if (rucni.length !== 1 || rucni[0].polozky.some((x) => !['PRANI', 'LEKY', 'PODANI', 'OTAZKY', 'POZNAMKA'].includes(x.druh))) chyby.push('sdílení týmu poslalo něco jiného než údaje pacienta');
if (!auto.length || !auto.some((x) => x.polozky.some((p) => p.druh === 'PRANI')) || !auto.some((x) => x.polozky.some((p) => p.druh === 'PODANI'))) chyby.push('automatický přenos přání / podání léků týmu neproběhl');
await klik(p, '.tile[data-tab="nouze"]'); await p.waitForSelector('#nz_kop'); await p.waitForTimeout(3300);
await foto(p, 'p-nouze', { vyska: 1400 });
// zamknutí a znovu odemknutí PINem (data jsou šifrovaná PINem)
await klik(p, '#btnZamek'); await p.waitForSelector('#pin');
await foto(p, 'p-zamek');
// 0.11.55: lékař volá z centrály → zamčený Můj průkaz zazvoní (token jen pro zvonění, bez PINu), Přijmout otevře hovor
await p.evaluate(async () => { await fetch('/__mock/video', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 5, mistnost: 'kp-p0007-pac', stav: 'ZVONI', zahajil: 'CENTRALA', zahajilJmeno: 'MUDr. Petra Ukázková', zahajeno: '2026-10-27 09:40' }) }); await videoPoll(); });
await p.waitForSelector('#vidPrijmout');
if (!(await p.$('#pin'))) chyby.push('zvonění na zamčeném Mém průkazu smazalo zámek');
await foto(p, 'p-video-zvoni');
await klik(p, '#vidPrijmout'); await p.waitForSelector('.videocall iframe');
if (!(await p.textContent('.videocall-bar')).includes('Petra Ukázková')) chyby.push('okno hovoru v Mém průkazu nemá jméno volajícího');
await klik(p, '#vidKonec'); await p.waitForTimeout(400);
if (await p.$('.videocall')) chyby.push('Ukončit v Mém průkazu nezavřelo okno hovoru');
await p.evaluate(async () => { await fetch('/__mock/video', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); await videoPoll(); });
await p.fill('#pin', '111111'); await klik(p, '#pinOk'); await p.waitForTimeout(1500);
if (await p.$('.tile[data-tab]')) chyby.push('špatný PIN odemkl Můj průkaz');
await p.fill('#pin', '258147'); await klik(p, '#pinOk'); await p.waitForSelector('.tile[data-tab="leky"]', { timeout: 20000 });
await klik(p, '.tile[data-tab="leky"]');
if (!(await p.textContent('#work')).includes('Furosemid')) chyby.push('po odemknutí chybí vlastní léky pacienta');
await p.close();

console.log('Průkaz pro plán péče (prototyp)');
p = await stranka({ mobil: true });
await p.goto(`${URL}/prukaz/`); await p.waitForSelector('#u_nova'); await foto(p, 'q-uvod');
await p.goto(`${URL}/prukaz/?ukazka=zamek`); await p.waitForSelector('#z_odemk'); await foto(p, 'q-zamek');
await p.goto(`${URL}/prukaz/?ukazka=1&tab=prehled`); await p.waitForSelector('#p_profil'); await foto(p, 'q-prehled');
await p.goto(`${URL}/prukaz/?ukazka=1&tab=zdravi`); await p.waitForSelector('#d_pridat'); await foto(p, 'q-zdravi');
await p.goto(`${URL}/prukaz/?ukazka=1&tab=budouci`); await p.waitForSelector('[data-bu="plan"]'); await foto(p, 'q-budouci');
await p.goto(`${URL}/prukaz/?ukazka=1&tab=krize`); await p.waitForSelector('#kr_ok'); await foto(p, 'q-krize');
await p.goto(`${URL}/prukaz/?ukazka=1&tab=sdilet`); await p.waitForSelector('#sd_nahled'); await klik(p, '#sd_nahled'); await p.waitForSelector('#sd_potvrd'); await p.waitForTimeout(300); await foto(p, 'q-sdilet'); await p.evaluate(() => closeModal());
await p.goto(`${URL}/prukaz/?ukazka=1&tab=bezpecnost`); await p.waitForSelector('#b_zaloha'); await foto(p, 'q-bezpecnost');
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
