/**
 * AI rozbor propouštěcí zprávy – VŽDY nad anonymizovaným textem.
 * Identita pacienta zůstává na serveru (mapa značek), AI dostane jen text se značkami a výsledek
 * se k pacientovi přiřadí zpět až tady. Bez ANTHROPIC_API_KEY běží lokální heuristika (stejný výstup).
 * AI nic nerozhoduje: předvyplní formulář a upozorní na chybějící údaje, lékař potvrdí.
 * 0.11.139 (právní posouzení MDR 24. 11. 2026): rozbor je jen „přepis ze zprávy“ – opisuje údaje, které zpráva
 * VÝSLOVNĚ uvádí, s citací věty; nic neodvozuje, nehodnotí a nedoporučuje. Cíl péče a limity jen z výslovné věty,
 * jinak prázdné (žádná výchozí hodnota) a volí je lékař. „chybi“ = jen seznam nevyplněných polí formuláře.
 * Každá nová funkce, která by z údajů pacienta něco odvozovala nebo doporučovala, se před nasazením posoudí (MDR).
 */
import { config } from './config.js';
import { anonymizuj, obnov } from './anonym.js';
import { identitaZeZpravy, RE_STITEK_RC } from './identita.js';

const LIMITY = ['KPR', 'Umělá plicní ventilace', 'Hospitalizace', 'Antibiotika i.v.', 'Infuze / i.v. výživa', 'Sonda / PEG', 'Dialýza', 'Transfuze'];

const POLE_FORMULARE = ['Diagnózy', 'Alergie', 'Medikace', 'SOS medikace', 'Funkční stav', 'Cíl péče', 'Dříve vyslovené přání', 'Osoba pro zástupné rozhodování', 'Kontakty'];

const POKYNY = `Jsi přepisovatel lékařské zprávy. Údaje, které zpráva VÝSLOVNĚ uvádí, opiš do polí formuláře plánu péče. Nic neodvozuj, nehodnoť, nedoplňuj a nic nedoporučuj; o obsahu plánu péče rozhoduje lékař.
Text je anonymizovaný: osoby, data a telefony jsou nahrazeny značkami v hranatých závorkách ([PACIENT], [OSOBA_1], [TELEFON_1], [DATUM_1]…). Značky ponech přesně tak, jak jsou – nedoplňuj ani nehádej skutečná jména.
Vrať POUZE JSON bez komentáře v tomto tvaru:
{"dg":"diagnózy jednou větou, oddělené středníkem",
 "alergie":"…nebo 'žádné známé'",
 "medikace":["lék dávka schéma", …],
 "opioidy":["opioid dávka schéma (pravidelně podávaný)", …],
 "parenteralni":["lék dávka cesta podání (injekce, infuze – podává sestra)", …],
 "sos":["lék dávka cesta indikace", …],
 "funkce":"obvyklý funkční stav",
 "pobyt":"kam byl propuštěn",
 "cil":"symptom|limited|full nebo '' (prázdné)",
 "limity":[podmnožina z ${JSON.stringify(LIMITY)}],
 "doklad":{"dvp":true|false,"datum":"[DATUM_n] nebo ''","zprava":"odkud plyne rozhodnutí"},
 "kontakty":[{"jmeno":"[OSOBA_n], vztah","tel":"[TELEFON_n]","skupina":"ROZHODUJE|INFORMOVAT|PECUJE"}],
 "chybi":["název pole z ${JSON.stringify(POLE_FORMULARE)}, ke kterému zpráva nic neuvádí"],
 "citace":{"cil":"doslovná věta ze zprávy, ve které je cíl péče nebo limitace výslovně uvedena, jinak ''"}}
Léky hledej v celé zprávě: Ter. / Chronická terapie, Analgetická i Algeziologická terapie, SOS, a také řádky „Rp.“ (předepsané léky) – lék z Rp., který je v terapii pod jiným názvem (MATRIFEN = TTS fentanyl), neuváděj dvakrát. Do "opioidy" jen opioidy (fentanyl, morfin, oxykodon…), ostatní analgetika do "medikace".
cil vyplň JEN tehdy, když zpráva cíl péče výslovně uvádí (např. „cíl péče: symptomatická léčba“ → symptom; „léčba bez resuscitace a intenzivní péče“ → limited; „plný rozsah léčby“ → full). Z diagnóz, prognózy, zmínky o paliativní péči ani z limitací cíl NEodvozuj – pak "cil":"".
Limitaci uveď jen tehdy, když ji zpráva výslovně uvádí jako přání pacienta nebo rozhodnutí (nepřeje si resuscitaci / DNR → KPR, nepřeje si ventilátor → Umělá plicní ventilace, další hospitalizaci si nepřeje / jen výjimečně → Hospitalizace); samotná zmínka slova nestačí.
Do "chybi" dávej jen názvy polí, ke kterým zpráva nic neuvádí – žádná doporučení, rady ani hodnocení.`;

/* 0.11.138: při přetížení nebo dočasné chybě AI služby (429, 5xx, 529) jedno opakování po 3 s, než se přejde na rozbor podle pravidel */
async function zavolejClaude(text) {
  try { return await zavolejClaudeJednou(text); }
  catch (e) {
    if (!/^AI (429|5\d\d)\b/.test(e.message)) throw e;
    await new Promise((ok) => setTimeout(ok, 3000));
    return zavolejClaudeJednou(text);
  }
}
async function zavolejClaudeJednou(text) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.ai.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: config.ai.model, max_tokens: 2000,
      system: POKYNY,
      messages: [{ role: 'user', content: `Propouštěcí zpráva (anonymizovaná):\n\n${text}` }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const out = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI nevrátila JSON');
  return JSON.parse(m[0]);
}

/** Lokální heuristika (bez sítě) – stejný tvar výstupu jako AI. */
const VELKE = 'A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ';
const prvniSlovo = (x) => String(x).toLowerCase().replace(/^[-–•*\s]+/, '').split(/[\s.,]+/)[0];
const prazdne = (x) => /^(sine|ne|není|nejsou|žádn[áéý]|0|-+|—)\.?$/i.test(String(x).trim());
/** bez opakování podle prvního slova (název léku); ponechá poslední výskyt (terapie na konci zprávy je novější) */
const bezOpakovani = (a) => a.filter((x, i) => !a.slice(i + 1).some((y) => prvniSlovo(y) === prvniSlovo(x)));
/* 0.11.137: léčivo podle obchodního názvu i účinné látky – opioidy se poznají podle názvu (fentanyl, MATRIFEN, MST…), a lék z „Rp.“,
   který už je v terapii pod jiným jménem (MATRIFEN = TTS fentanyl, canabis = konopí), se nezdvojí */
const bezDia = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const LATKY = [
  ['fentanyl', /\b(fentanyl\w*|matrifen|durogesic|fentalis|effentora|instanyl|abstral|breakyl)\b/, true],
  ['morfin', /\b(morfin\w*|morphin\w*|mst|sevredol|vendal|oramorph)\b/, true],
  ['oxykodon', /\b(oxy[ck]odon\w*|oxycontin|oxynorm|targin|dolocodon|oxykodon)\b/, true],
  ['hydromorfon', /\b(hydromorfon\w*|jurnista|palladone)\b/, true],
  ['buprenorfin', /\b(buprenorfin\w*|transtec|bupretec|norspan)\b/, true],
  ['tramadol', /\b(tramadol\w*|tramal|tralgit|zaldiar|doreta)\b/, true],
  ['tapentadol', /\b(tapentadol\w*|palexia)\b/, true],
  ['metadon', /\b(m[e]?thadon\w*|metadon\w*)\b/, true],
  ['piritramid', /\b(piritramid\w*|dipidolor)\b/, true],
  ['sufentanil', /\bsufentanil\w*\b/, true],
  ['kodein', /\b(kodein\w*|codein\w*|dhc)\b/, true],
  ['konopi', /\b(konop\w*|cannabis|canabis|cannabis\w*)\b/, false],
  ['metamizol', /\b(metamizol\w*|novalgin|algifen)\b/, false],
];
const latka = (x) => { const n = bezDia(x); const l = LATKY.find(([, re]) => re.test(n)); return l ? l[0] : prvniSlovo(n); };
const jeOpioid = (x) => { const n = bezDia(x); return LATKY.some(([, re, op]) => op && re.test(n)); };
/** Medistar „Rp.“ = předepsaný lék: „Rp. Vysoce návyková látka - 6x MATRIFEN 25mcg/h tdr emp 5 iii Dávkování: 1x3 dny“ → „MATRIFEN 25mcg/h 1x3 dny“;
    dávkování může být i na dalším řádku („Rozpis: … D. S.: 1 tob na noc“) */
function lekyRp(radky) {
  return radky.flatMap((l, i) => {
    const m = l.match(/^Rp\.?\s*(.+)$/i); if (!m) return [];
    let t = m[1].replace(/^(?:vysoce\s+)?návyková látka\s*[-–:]\s*/i, '').replace(/^\d+\s*:?\s*x\s*/i, '').trim();
    let dav = ''; const d = t.match(/\s*Dávkování\s*:\s*(.*)$/i);
    if (d) { dav = d[1].trim(); t = t.slice(0, d.index).trim(); }
    else { const dal = radky[i + 1] || ''; const ds = /^Rozpis\s*:/i.test(dal) && dal.match(/D\.\s?S\.\s*:?\s*(.+)$/i); if (ds) dav = ds[1].trim(); }
    const sila = t.match(/^(.+?\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|ug|g|ml|%|iu|m\.j\.)(?:\/(?:ml|h|dávku|dav|tbl|g))?)(?=\s|$)/i);
    const nazev = (sila ? sila[1] : t).replace(/[\s,;.]+$/, '');
    return nazev.length >= 3 ? [[nazev, dav].filter(Boolean).join(' ')] : [];
  });
}
export function lokalniRozbor(t) {
  // 0.11.129: Medistar píše „Ter.: Chronická medikace: lék, lék…“ – zkratka před nadpisem se vynechá, samotné „Ter.:“ je Terapie
  const lines = t.split('\n').map((l) => l.trim()).map((l) => l.replace(new RegExp(`^Ter\\.\\s*:\\s*(?=[${VELKE}][^:]{2,40}:)`, 'i'), '').replace(/^Ter\.\s*:/i, 'Terapie:'));
  const jeNadpis = (l) => new RegExp(`^[${VELKE}][^:]{2,40}:`).test(l) || /^(MUDr|MDDr|Mgr|Bc|PhDr|Ing|prim\.)\b/i.test(l) || /^-{2,}/.test(l) || /^Rp\.\s/.test(l);   // 0.11.137: „Rp.“ (předpis) ukončí seznam terapie
  // jenKody: za textem na řádku nadpisu („Dg.: R52.1“) pokračují jen další řádky s kódem MKN, ne volný text zprávy
  const sekceOd = (i, { jenKody = false } = {}) => {
    const out = [];
    // 0.11.120: text hned za nadpisem na stejném řádku („Dg.: C50.9 …, I50.0 …“ – zprávy z Medistaru)
    const zaNadpisem = lines[i].includes(':') ? lines[i].replace(/^[^:]*:\s*/, '').trim() : '';
    if (zaNadpisem) out.push(zaNadpisem);
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j] || jeNadpis(lines[j])) break;
      // 0.11.137: pod „Dg.:“ i krátké diagnózy slovy („M Parkinson, Lumboischialgie“, „Sy neklidných nohou“) – ne věty volného textu
      if (jenKody && zaNadpisem && !/^[A-TV-Z]\d{2}/.test(lines[j]) && !(lines[j].length <= 60 && lines[j].split(/\s+/).length <= 6 && !/[.:]$/.test(lines[j]) && !/\d{1,2}\.\d{1,2}\.\d{2,4}/.test(lines[j]))) break;
      out.push(lines[j]);
    }
    return out;
  };
  const zacina = (l, nazvy) => nazvy.some((n) => l.toLowerCase().startsWith(n));
  const sekce = (nazvy) => { const i = lines.findIndex((l) => zacina(l, nazvy)); return i < 0 ? [] : sekceOd(i); };
  const vsechnySekce = (nazvy, o) => lines.flatMap((l, i) => (zacina(l, nazvy) ? sekceOd(i, o) : []));
  // hodnota pole „Název: hodnota“ i uprostřed řádku (Medistar dává víc polí na řádek: „Pohyblivost: … Aktivita: …“)
  const pole = (nazev) => {
    const m = t.match(new RegExp(`(?:^|[\\s,;])${nazev}\\s*:[ \\t]*([^\\n]*)`, 'i'));
    if (!m) return '';
    return m[1].split(new RegExp(`\\s+(?=[${VELKE}][a-záčďéěíňóřšťúůýž -]{2,30}:)`))[0].trim().replace(/[.,;]$/, '');
  };
  const a = { chybi: [], citace: {} };
  const pb = t.match(/Propuštěn[ao]? do:\s*([^\n]+)/i); a.pobyt = pb ? pb[1].trim() : '';
  // diagnózy i s kódem MKN (Karta k nim doplní popisy z číselníku); víc diagnóz na řádku oddělených čárkou před kódem;
  // ze všech míst zprávy (Medistar: „Dg.: R52.1“ nahoře a „Diagnóza: …“ slovy v Základních informacích)
  const dgVse = vsechnySekce(['diagnózy', 'diagnozy', 'diagnóza', 'dg.', 'dg:'], { jenKody: true })
    .flatMap((l) => l.split(/[,;]\s*(?=[A-TV-Z]\d{2})/)).map((l) => l.trim().replace(/\.$/, '').replace(/^([a-tv-z])(?=\d{2}(?:\.\d)?(?:\s|$))/, (c) => c.toUpperCase()).replace(/^([A-TV-Z]\d{2}(?:\.\d{1,2})?)\s{2,}/, '$1 '))   // kód MKN velkým (OCR čte „c61“)
    .filter((l) => l && !prazdne(l));
  a.dg = dgVse.filter((x, i) => dgVse.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i).join('; ');
  const al = t.match(/Alergie:\s*([^\n]+)/i); a.alergie = al ? al[1].trim() : '';
  // léky: víc na řádku oddělených čárkou před názvem; řádky „při bolesti / v případě / SOS …“ jsou SOS medikace;
  // 0.11.122: Medistar dekurz – přednost má „Chronická terapie“ (Ter.: na konci zprávy), seznamy s pomlčkami
  const CHRON = ['chronická terapie', 'chronická medikace'];
  const zdrojLeku = lines.some((l) => zacina(l, CHRON)) ? sekce(CHRON) : sekce(['medikace při propuštění', 'medikace', 'terapie']);
  // 0.11.137: čárka odděluje lék i před názvem na konci řádku („Sortis 10 mg, Stacyl“) a před názvem malým písmenem („Nakom 5xdenně, chlorprotixen 0-0-1“)
  const ROZDEL = new RegExp(`,\\s*(?=(?:[${VELKE}][A-Za-z${VELKE}áčďéěíňóřšťúůýž]+|(?!(?:při|nejvýš|maximálně|max|dle|podle|nebo|ráno|večer|denně|týdně|obden|jinak|pouze)(?=[\\s,;.]|$))[a-záčďéěíňóřšťúůýž]{5,})(?:[\\s,;]|$))`);
  const rozdel = (radky) => radky.flatMap((l) => l.split(ROZDEL)).map((l) => l.replace(/^[-–•*,\s]+/, '').replace(/[\s,;]+$/, '').trim()).filter((l) => l && !prazdne(l));
  const leky = rozdel(zdrojLeku);
  const jeSos = (l) => /^(při\s|v případě|dle potřeby|SOS\b)/i.test(l);
  // opioidy a analgetika: „Opioidy: …“ (Základní informace), „Analgetická terapie: …“, „Algeziologická terapie: …“ (Ter.:, i přes víc řádků);
  // 0.11.137: z těchto i z chronické terapie a z „Rp.“ jdou do Opioidů jen opioidy (podle názvu), ostatní do Paliativní terapie
  const analg = rozdel(vsechnySekce(['opioidy', 'analgetická terapie', 'algeziologická terapie', 'analgetika']));
  const terapie = [...leky, ...analg];
  const rp = lekyRp(lines).filter((x) => !terapie.some((y) => latka(y) === latka(x)));   // předepsaný lék, který v terapii ještě není
  const pravidelne = [...terapie, ...rp].filter((l) => !jeSos(l));
  a.opioidy = bezOpakovani(pravidelne.filter(jeOpioid));
  // 0.11.131: parenterální léky (injekce, infuze) – „Parenterální medikace: …“ / „Parenterální terapie: …“
  a.parenteralni = bezOpakovani([...t.matchAll(/^[ \t]*Parenterální (?:medikace|terapie)[ \t]*:[ \t]*([^\n]*)/gim)].map((m) => m[1].trim().replace(/[.,;]$/, '')).filter((x) => x && !prazdne(x)));
  a.medikace = bezOpakovani(pravidelne.filter((l) => !jeOpioid(l))).filter((l) => !a.opioidy.some((o) => prvniSlovo(o) === prvniSlovo(l)));
  // SOS medikace: na stejném řádku, nebo (Medistar „SOS Medikace:“ bez textu) na řádku pod ním
  const sosRadky = lines.flatMap((l, i) => {
    const m = l.match(/^[S5][O0][S5](?:\s*medikace)?\s*:\s*(.*)$/i);   // OCR čte „SOS“ i jako „SO5“ / „505“; 0.11.137: i samotné „SOS:“
    if (!m) return [];
    const v = m[1].trim() || (lines[i + 1] && !jeNadpis(lines[i + 1]) ? lines[i + 1] : '');
    return v && !prazdne(v) ? v.split(/,\s*(?=[a-záčďéěíňóřšťúůýž]+\s\d)/i).map((x) => x.trim()) : [];
  });
  a.sos = bezOpakovani([...sosRadky, ...leky.filter(jeSos), ...lines.filter((l) => /^(při bolesti|při dušnosti|při neklidu|při zvracení)\b/i.test(l) && !leky.includes(l))]);
  const fs = t.match(/Funkční stav:\s*([^\n]+)/i); a.funkce = fs ? fs[1].trim() : '';
  if (!a.funkce) {   // Medistar: PPS a pole z hodnocení (Pohyblivost, Soběstačnost, Co pacient zvládne)
    const pps = (t.match(/PPS[\s\-–—]*Hodnocení\s*:\s*(\d{1,3})/i) || [])[1];   // „-- PPS --“ (OCR i „—-“)
    const male = (x) => x.charAt(0).toLowerCase() + x.slice(1);
    a.funkce = [pps ? `PPS ${pps} %` : '', ...[['Pohyblivost', 'pohyblivost'], ['Soběstačnost', 'soběstačnost'], ['Co pacient zvládne', 'zvládne']]
      .map(([n, k]) => { const v = pole(n); return v ? `${k}: ${male(v)}` : ''; })].filter(Boolean).join('; ');
  }
  // 0.11.139: cíl a limitace jen z věty, která je výslovně uvádí (přání pacienta / rozhodnutí) – citace té věty; nic se neodvozuje
  const vety = lines.filter((l) => !/IČO|s\.r\.o\.|o\.p\.s\.|příspěvková/i.test(l)).join('\n').match(/[^.\n]+[.\n]?/g) || [];
  const RE_LIM = /((?:si\s+)?nepřeje(?:\s+si)?|nepřál[ao]?\s+by\s+si|odmít[áa]|\bDNR\b|\bDNAR\b|neresuscitovat|bez\s+(?:KPR|resuscitace))/i;
  const limVeta = vety.find((v) => RE_LIM.test(v)) || '';
  const RE_CIL = /(cíl(?:em)?\s+péče\s*(?:je|:)|pouze\s+symptomatick|jen\s+symptomatick|výhradně\s+symptomatick|plný\s+rozsah\s+léčby|plná\s+léčba)/i;
  const cilVeta = vety.find((v) => RE_CIL.test(v)) || '';
  a.limity = [];
  if (limVeta) {
    const zaKlicem = limVeta.slice(limVeta.search(RE_LIM));
    if (/resuscit|KPR|DNA?R/i.test(zaKlicem)) a.limity.push('KPR');
    if (/ventil|UPV|intubac/i.test(zaKlicem)) a.limity.push('Umělá plicní ventilace');
  }
  const hospVeta = vety.find((v) => /(nepřeje|odmítá)[^.]*hospitaliz|hospitalizaci\s+jen|bez\s+(?:další\s+)?hospitalizac/i.test(v)) || '';
  if (hospVeta) a.limity.push('Hospitalizace');
  a.cil = !cilVeta ? '' : /symptomatick|komfort|úlev/i.test(cilVeta) ? 'symptom' : /bez\s+resusc|bez\s+intenzivní/i.test(cilVeta) ? 'limited' : /plný|plná/i.test(cilVeta) ? 'full' : '';
  a.citace.cil = [...new Set([cilVeta, limVeta, hospVeta].map((x) => x.trim()).filter(Boolean))].join(' … ');
  const dvp = /dříve vyslovené přání/i.test(t) && !/nebylo sepsáno|není sepsáno/i.test(t);
  const typ = pole('Typ vyšetření');
  a.doklad = { dvp, datum: '', zprava: typ ? `Medistar – ${typ}` : (t.split('\n')[0] || '').trim() };
  a.kontakty = [...t.matchAll(/(syn|dcera|manžel(?:ka)?|opatrovník)\s+(\[OSOBA_\d+\]|[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^,\n]+?),\s*tel\.?\s*(\[TELEFON_\d+\]|[\d ]{9,})/gi)]
    .map((m) => ({ jmeno: `${m[2].trim()}, ${m[1].toLowerCase()}`, tel: m[3].trim(), skupina: /opatrovník/i.test(m[1]) ? 'ROZHODUJE' : 'INFORMOVAT' }));
  // 0.11.139: „chybi“ = jen pole formuláře, ke kterým zpráva nic neuvádí (bez doporučení)
  const pecujici = pole('Jméno a příjmení pečující osoby') || pole('Pečující osoba');
  if (pecujici && !/\d{3}|TELEFON/.test(pecujici) && !a.kontakty.length) a.chybi.push(`Kontakty: pečující osoba (${pecujici}) je ve zprávě bez jména a telefonu.`);
  if (!a.cil) a.chybi.push('Cíl péče: zpráva ho výslovně neuvádí – zvolí lékař.');
  if (!dvp) a.chybi.push('Dříve vyslovené přání: zpráva neuvádí sepsané přání.');
  if (!/opatrovník|určená osoba|zástupn/i.test(t)) a.chybi.push('Osoba pro zástupné rozhodování: zpráva ji neuvádí.');
  if (!a.funkce) a.chybi.push('Funkční stav: zpráva ho neuvádí.');
  if (!a.sos.length) a.chybi.push('SOS medikace: zpráva ji neuvádí.');
  return a;
}

/**
 * Rozbor zprávy. znamo = identifikátory pacienta z databáze (pokud už existuje).
 * Vrací { vysledek (s obnovenými hodnotami), anonymniText, pocetNahrad, blokovano, zdroj, model }.
 */
export async function rozborZpravy(text, znamo = {}, { priBlokuLokalne = false } = {}) {
  // 0.11.129: identita z hlavičky zprávy (jméno, RČ, adresa, telefon) – čte ji server; co z ní není známo z databáze,
  // doplní se do anonymizace, aby se skrylo i u pacienta, který v Kartě ještě není
  const identita = identitaZeZpravy(text);
  const z = { ...znamo, jmeno: znamo.jmeno || identita.jmeno, prijmeni: znamo.prijmeni || identita.prijmeni, rc: znamo.rc || identita.rc,
    datumNarozeni: znamo.datumNarozeni || identita.datumNarozeni, adresa: znamo.adresa || identita.adresa, telefony: [...(znamo.telefony || []), ...(identita.telefon ? [identita.telefon] : [])] };
  const a = anonymizuj(text, z);
  // 0.11.134: zpráva má hlavičku pacienta nebo rodné číslo, ale jméno z ní neznáme (ani z Karty) → nelze ověřit, že je skryté; do AI nic
  if (!z.prijmeni && (new RegExp(`${RE_STITEK_RC}\\s*\\d{6}|(?<!\\d)\\d{6}\\s?\\/\\s?\\d{3,4}(?!\\d)`).test(text) || /Pacient(?:ka)?\s*:|Jméno a příjmení/i.test(text))) {
    a.blokovano = true; a.zbytky = [...a.zbytky, 'jméno pacienta se z hlavičky zprávy nepodařilo přečíst'];
  }
  if (a.blokovano && !priBlokuLokalne) {
    return { blokovano: true, duvod: 'Po anonymizaci v textu zůstalo něco, co vypadá jako identifikátor (' + a.zbytky.join(', ') + '). Dotaz na AI nebyl odeslán.', pocetNahrad: a.pocetNahrad, anonymniText: a.text, identita };
  }
  let surovy, zdroj = 'lokalne', model = null, chybaAi = null;
  if (a.blokovano) {   // priBlokuLokalne: do AI nic neodejde, zprávu rozebere server sám podle pravidel
    surovy = lokalniRozbor(a.text);
    surovy.chybi = [`AI rozbor se neodeslal – v textu zůstalo něco, co vypadá jako identifikátor (${a.zbytky.join(', ')}). Zprávu rozebral server sám podle pravidel.`, ...(surovy.chybi || [])];
  } else if (config.ai.apiKey) {
    try { surovy = await zavolejClaude(a.text); zdroj = 'ai'; model = config.ai.model; }
    catch (e) {
      chybaAi = String(e.message || e).replace(/\s+/g, ' ').slice(0, 300);
      console.warn('AI rozbor selhal, použit rozbor podle pravidel:', chybaAi);
      surovy = lokalniRozbor(a.text); zdroj = 'lokalne'; surovy.chybi = [...(surovy.chybi || []), `AI nedostupná (${chybaAi.slice(0, 80)}), použit lokální rozbor.`];
    }
  } else {
    chybaAi = 'na serveru chybí ANTHROPIC_API_KEY';
    surovy = lokalniRozbor(a.text);
  }
  surovy.limity = (surovy.limity || []).filter((l) => LIMITY.includes(l));
  if (!['symptom', 'limited', 'full'].includes(surovy.cil)) surovy.cil = '';   // 0.11.139: žádná výchozí hodnota – cíl volí lékař
  // identita pacienta: jméno se z textu nevytěžuje přes AI – z hlavičky si ho vezme server sám (src/identita.js)
  const zHlavicky = identita.jmenoCele ? { jmenoCele: identita.jmenoCele, ...(identita.rok ? { rok: identita.rok } : {}) } : {};
  return { blokovano: false, aiBlokovano: a.blokovano, vysledek: { ...obnov(surovy, a.mapa), ...zHlavicky }, identita, anonymniText: a.text, pocetNahrad: a.pocetNahrad, zdroj, model, chybaAi };
}
