/**
 * Vzorová data pro nového tenanta (volba „vložit ukázková data“ při založení).
 * Jména, čísla a léky jsou smyšlené. Vše vzniká v kontextu tenanta (q z vTenantu).
 */
import { ulozPlan, zapisDenik, dalsiKod } from './kp.js';

const POSKYTOVATELE = [
  { klic: 'nem', Nazev: 'Krajská nemocnice – paliativní tým (ukázka)', Typ: 'NEMOCNICE', Telefon24: '577 550 000' },
  { klic: 'hos', Nazev: 'Mobilní hospic (ukázka)', Typ: 'HOSPIC', Telefon24: '777 000 000' },
  { klic: 'pl', Nazev: 'MUDr. Malá – praktická lékařka (ukázka)', Typ: 'PL', Telefon24: '577 000 000' },
  { klic: 'dom', Nazev: 'Domov pro seniory (ukázka)', Typ: 'DOMOV', Telefon24: '577 333 000' },
];

const PACIENTI = [
  {
    jmeno: 'Jan', prijmeni: 'NOVÁK', rok: 1944, pohlavi: 'muž', pobyt: 'Domov pro seniory, pokoj 12', garant: 'hos', tym: ['hos', 'pl', 'dom'],
    plan: { cil: 'symptom', limity: ['KPR', 'Umělá plicní ventilace', 'Hospitalizace'], doklad: { dvp: true, datum: '2026-10-10', original: 'Domov pro seniory, karta klienta', zprava: 'Krajská nemocnice, interní odd., 9. 10. 2026' },
      dg: 'Pokročilé chronické srdeční selhání (NYHA IV), ICHS, DM 2. typu', funkce: 'Chodí s doprovodem po pokoji, orientovaný, komunikuje. Dušnost při minimální námaze.', alergie: 'penicilin',
      sos: ['morfin 5 mg s.c. při dušnosti nebo bolesti, max. 6× denně', 'midazolam 2,5 mg s.c. při neklidu'], medikace: ['furosemid 40 mg 1-0-0', 'bisoprolol 2,5 mg 1-0-0', 'morfin ret. 10 mg 1-0-1'] },
    kontakty: [['Mobilní hospic (24/7)', '777 000 000', 'PECUJE', 'volat jako první'], ['Jana Nováková, dcera', '737 000 000', 'ROZHODUJE', 'určená osoba'], ['Petr Novák, syn', '608 000 000', 'INFORMOVAT', '']],
    denik: [['Změna stavu', 'Otoky DK beze změny, dušnost v klidu nepřítomná, spal dobře.', 'sestra Kovářová', 'sestra'], ['Podán SOS lék', 'Dušnost, neklid. Podán morfin 5 mg s.c. Volán hospic, po 30 min klid.', 'sestra Dlouhá', 'sestra']],
  },
  {
    jmeno: 'Marie', prijmeni: 'PROCHÁZKOVÁ', rok: 1938, pohlavi: 'žena', pobyt: 'doma, s dcerou', garant: 'pl', tym: ['pl', 'hos'],
    plan: { cil: 'symptom', limity: ['KPR', 'Umělá plicní ventilace', 'Sonda / PEG', 'Antibiotika i.v.'], doklad: { dvp: false, datum: '', original: '', zprava: 'Zápis o rozhovoru s opatrovníkem – PL, 2. 7. 2026' },
      dg: 'Pokročilá Alzheimerova demence, CHOPN III', funkce: 'Imobilní, nekomunikuje slovně, kašovitá strava s dopomocí.', alergie: 'žádné známé',
      sos: ['paracetamol 500 mg čípek při bolesti', 'morfin 2,5 mg s.c. při dušnosti dle hospice'], medikace: ['tiotropium inh. 1-0-0', 'memantin 10 mg 1-0-0'] },
    kontakty: [['Tomáš Procházka, syn – opatrovník', '606 000 000', 'ROZHODUJE', 'rozhodnutí soudu 2024'], ['Eva Procházková, dcera', '723 000 000', 'PECUJE', 'pečuje doma']],
    denik: [['Pozorování rodiny', 'Maminka méně pije, spí většinu dne.', 'Eva Procházková', 'rodina']],
  },
];

export async function naplnDemo(q, { uzivatelId, jmeno }) {
  const ids = {};
  for (const p of POSKYTOVATELE) {
    const r = await q.one(`INSERT INTO dbo.A_KP_Poskytovatel (Nazev, Typ, Telefon24) OUTPUT inserted.PoskytovatelID VALUES (@n, @t, @tel)`, { n: p.Nazev, t: p.Typ, tel: p.Telefon24 });
    ids[p.klic] = r.PoskytovatelID;
  }
  const s = { uzivatelId, jmeno };
  const platnost = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  for (const p of PACIENTI) {
    const kod = await dalsiKod(q);
    const pac = await q.one(`INSERT INTO dbo.A_KP_Pacient (KodPrukazu, Jmeno, Prijmeni, RokNarozeni, Pohlavi, Pobyt, ZalozilUzivatelID)
      OUTPUT inserted.PacientID VALUES (@k, @j, @p, @r, @po, @pb, @u)`, { k: kod, j: p.jmeno, p: p.prijmeni, r: p.rok, po: p.pohlavi, pb: p.pobyt, u: uzivatelId });
    const id = pac.PacientID;
    await q.exec(`INSERT INTO dbo.A_KP_Garance (PacientID, PoskytovatelID, Stav, Od, NavrhlUzivatelID) VALUES (@p, @ps, 'PLATNA', SYSDATETIME(), @u)`, { p: id, ps: ids[p.garant], u: uzivatelId });
    for (const t of p.tym) await q.exec(`INSERT INTO dbo.A_KP_Tym (PacientID, PoskytovatelID, Role) VALUES (@p, @ps, @r)`, { p: id, ps: ids[t], r: t === p.garant ? 'GARANT' : 'PECE' });
    await ulozPlan(q, { pacientId: id, data: p.plan, platnostDo: platnost, s, typ: 'ZALOZENI', poznamka: 'ukázková data' });
    let i = 0;
    for (const [j, tel, sk, poz] of p.kontakty) await q.exec(`INSERT INTO dbo.A_KP_Kontakt (PacientID, Jmeno, Telefon, Skupina, Poznamka, Poradi) VALUES (@p, @j, @t, @s, @poz, @o)`, { p: id, j, t: tel, s: sk, poz: poz || null, o: (i += 10) });
    await zapisDenik(q, { pacientId: id, typ: 'Založení', text: 'Ukázkový průkaz založen při založení tenanta.', autor: jmeno, role: 'lekar', uzivatelId });
    for (const [typ, txt, autor, role] of p.denik) await zapisDenik(q, { pacientId: id, typ, text: txt, autor, role });
  }
  // správce tenanta je v týmu všech ukázkových pacientů přes svého poskytovatele
  await q.exec(`INSERT INTO dbo.A_KP_Tym (PacientID, PoskytovatelID, Role)
    SELECT p.PacientID, u.PoskytovatelID, 'LEKAR' FROM dbo.A_KP_Pacient p CROSS JOIN dbo.A_KP_Uzivatel u
    WHERE u.UzivatelID = @u AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_Tym t WHERE t.PacientID = p.PacientID AND t.PoskytovatelID = u.PoskytovatelID)`, { u: uzivatelId });
}
