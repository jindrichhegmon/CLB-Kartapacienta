/**
 * AI rozbor propouštěcí zprávy – VŽDY nad anonymizovaným textem.
 * Identita pacienta zůstává na serveru (mapa značek), AI dostane jen text se značkami a výsledek
 * se k pacientovi přiřadí zpět až tady. Bez ANTHROPIC_API_KEY běží lokální heuristika (stejný výstup).
 * AI nic nerozhoduje: předvyplní formulář a upozorní na chybějící údaje, lékař potvrdí.
 */
import { config } from './config.js';
import { anonymizuj, obnov } from './anonym.js';
import { identitaZeZpravy } from './identita.js';

const LIMITY = ['KPR', 'Umělá plicní ventilace', 'Hospitalizace', 'Antibiotika i.v.', 'Infuze / i.v. výživa', 'Sonda / PEG', 'Dialýza', 'Transfuze'];

const POKYNY = `Jsi asistent paliativního lékaře. Z propouštěcí zprávy vytěž údaje pro krizový plán péče.
Text je anonymizovaný: osoby, data a telefony jsou nahrazeny značkami v hranatých závorkách ([PACIENT], [OSOBA_1], [TELEFON_1], [DATUM_1]…). Značky ponech přesně tak, jak jsou – nedoplňuj ani nehádej skutečná jména.
Vrať POUZE JSON bez komentáře v tomto tvaru:
{"dg":"diagnózy jednou větou, oddělené středníkem",
 "alergie":"…nebo 'žádné známé'",
 "medikace":["lék dávka schéma", …],
 "opioidy":["opioid dávka schéma (pravidelně podávaný)", …],
 "sos":["lék dávka cesta indikace", …],
 "funkce":"obvyklý funkční stav",
 "pobyt":"kam byl propuštěn",
 "cil":"symptom|limited|full",
 "limity":[podmnožina z ${JSON.stringify(LIMITY)}],
 "doklad":{"dvp":true|false,"datum":"[DATUM_n] nebo ''","zprava":"odkud plyne rozhodnutí"},
 "kontakty":[{"jmeno":"[OSOBA_n], vztah","tel":"[TELEFON_n]","skupina":"ROZHODUJE|INFORMOVAT|PECUJE"}],
 "chybi":["co ve zprávě chybí pro krizový plán (DVP, určená osoba, SOS léky, funkční stav, zápis o cílech péče…)"],
 "citace":{"cil":"věta ze zprávy, ze které plyne cíl a limitace"}}
cil: symptom = jen úleva od obtíží; limited = léčba bez resuscitace a intenzivní péče; full = plná léčba.
Limitaci uveď jen tehdy, když ji zpráva výslovně uvádí (nepřeje si resuscitaci → KPR, ventilátor → Umělá plicní ventilace, hospitalizace jen výjimečně → Hospitalizace).`;

async function zavolejClaude(text) {
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
export function lokalniRozbor(t) {
  const lines = t.split('\n').map((l) => l.trim());
  const jeNadpis = (l) => new RegExp(`^[${VELKE}][^:]{2,40}:`).test(l) || /^(MUDr|MDDr|Mgr|Bc|PhDr|Ing|prim\.)\b/i.test(l) || /^-{2,}/.test(l);
  // jenKody: za textem na řádku nadpisu („Dg.: R52.1“) pokračují jen další řádky s kódem MKN, ne volný text zprávy
  const sekceOd = (i, { jenKody = false } = {}) => {
    const out = [];
    // 0.11.120: text hned za nadpisem na stejném řádku („Dg.: C50.9 …, I50.0 …“ – zprávy z Medistaru)
    const zaNadpisem = lines[i].includes(':') ? lines[i].replace(/^[^:]*:\s*/, '').trim() : '';
    if (zaNadpisem) out.push(zaNadpisem);
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j] || jeNadpis(lines[j])) break;
      if (jenKody && zaNadpisem && !/^[A-TV-Z]\d{2}/.test(lines[j])) break;
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
    .flatMap((l) => l.split(/[,;]\s*(?=[A-TV-Z]\d{2})/)).map((l) => l.trim().replace(/\.$/, '')).filter((l) => l && !prazdne(l));
  a.dg = dgVse.filter((x, i) => dgVse.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i).join('; ');
  const al = t.match(/Alergie:\s*([^\n]+)/i); a.alergie = al ? al[1].trim() : '';
  // léky: víc na řádku oddělených čárkou před názvem; řádky „při bolesti / v případě / SOS …“ jsou SOS medikace;
  // 0.11.122: Medistar dekurz – přednost má „Chronická terapie“ (Ter.: na konci zprávy), seznamy s pomlčkami
  const zdrojLeku = lines.some((l) => zacina(l, ['chronická terapie'])) ? sekce(['chronická terapie']) : sekce(['medikace při propuštění', 'medikace', 'terapie', 'chronická medikace']);
  const leky = zdrojLeku.flatMap((l) => l.split(new RegExp(`,\\s*(?=[${VELKE}][A-Za-z${VELKE}áčďéěíňóřšťúůýž]+\\s)`))).map((l) => l.replace(/^[-–•*]\s*/, '').trim()).filter((l) => l && !prazdne(l));
  const jeSos = (l) => /^(při\s|v případě|dle potřeby|SOS\b)/i.test(l);
  // opioidy: „Opioidy: …“ (Základní informace) a „Analgetická terapie: …“ (Ter.:)
  a.opioidy = bezOpakovani([...t.matchAll(/^[ \t]*(?:Opioidy|Analgetická terapie|Analgetika)[ \t]*:[ \t]*([^\n]*)/gim)].map((m) => m[1].trim()).filter((x) => x && !prazdne(x)));
  a.medikace = bezOpakovani(leky.filter((l) => !jeSos(l))).filter((l) => !a.opioidy.some((o) => prvniSlovo(o) === prvniSlovo(l)));
  // SOS medikace: na stejném řádku, nebo (Medistar „SOS Medikace:“ bez textu) na řádku pod ním
  const sosRadky = lines.flatMap((l, i) => {
    const m = l.match(/^[S5][O0][S5]\s*medikace\s*:\s*(.*)$/i);   // OCR čte „SOS“ i jako „SO5“ / „505“
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
  // citace cíle péče – ne z hlavičky zařízení („Centrum … paliativní medicínu s.r.o.“)
  const cilS = (lines.filter((l) => !/IČO|s\.r\.o\.|o\.p\.s\.|příspěvková/i.test(l)).join('\n').match(/[^.\n]*(nepřeje|resuscit|ventilátor|cíl[eů]? péče|paliativ|symptomatick)[^.\n]*\./i) || [''])[0];
  a.citace.cil = cilS.trim();
  a.limity = [];
  if (/resuscit|KPR|DNR/i.test(t)) a.limity.push('KPR');
  if (/ventil/i.test(t)) a.limity.push('Umělá plicní ventilace');
  if (/hospitalizaci jen|bez hospitalizac|další hospitalizac/i.test(t)) a.limity.push('Hospitalizace');
  a.cil = /symptomatick|komfort|paliativní péč/i.test(t) ? 'symptom' : (a.limity.length ? 'limited' : 'full');
  const dvp = /dříve vyslovené přání/i.test(t) && !/nebylo sepsáno|není sepsáno/i.test(t);
  const typ = pole('Typ vyšetření');
  a.doklad = { dvp, datum: '', zprava: typ ? `Medistar – ${typ}` : (t.split('\n')[0] || '').trim() };
  a.kontakty = [...t.matchAll(/(syn|dcera|manžel(?:ka)?|opatrovník)\s+(\[OSOBA_\d+\]|[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^,\n]+?),\s*tel\.?\s*(\[TELEFON_\d+\]|[\d ]{9,})/gi)]
    .map((m) => ({ jmeno: `${m[2].trim()}, ${m[1].toLowerCase()}`, tel: m[3].trim(), skupina: /opatrovník/i.test(m[1]) ? 'ROZHODUJE' : 'INFORMOVAT' }));
  const pecujici = pole('Jméno a příjmení pečující osoby') || pole('Pečující osoba');
  if (pecujici && !/\d{3}|TELEFON/.test(pecujici) && !a.kontakty.length) a.chybi.push(`Pečující osoba (${pecujici}) je ve zprávě bez jména a telefonu – doplňte ji v Kontaktech.`);
  if (!dvp) a.chybi.push('Dříve vyslovené přání není sepsáno. Bez něj je limitace pro ZZS jen informací; doporučeno sepsat s úředně ověřeným podpisem.');
  if (!/opatrovník|určená osoba|zástupn/i.test(t)) a.chybi.push('Ve zprávě není určena osoba pro zástupné rozhodování.');
  if (!a.funkce) a.chybi.push('Chybí popis obvyklého funkčního stavu.');
  if (!a.sos.length) a.chybi.push('Chybí SOS medikace.');
  if (/kyslík/i.test(t)) a.chybi.push('Pacient je na domácím kyslíku – ověřit zajištění koncentrátoru.');
  if (!cilS) a.chybi.push('Zpráva neobsahuje zápis o rozhovoru o cílech péče; cíl je nutné stanovit a zapsat.');
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
  if (a.blokovano && !priBlokuLokalne) {
    return { blokovano: true, duvod: 'Po anonymizaci v textu zůstalo něco, co vypadá jako identifikátor (' + a.zbytky.join(', ') + '). Dotaz na AI nebyl odeslán.', pocetNahrad: a.pocetNahrad, anonymniText: a.text, identita };
  }
  let surovy, zdroj = 'lokalne', model = null;
  if (a.blokovano) {   // priBlokuLokalne: do AI nic neodejde, zprávu rozebere server sám podle pravidel
    surovy = lokalniRozbor(a.text);
    surovy.chybi = [`AI rozbor se neodeslal – v textu zůstalo něco, co vypadá jako identifikátor (${a.zbytky.join(', ')}). Zprávu rozebral server sám podle pravidel.`, ...(surovy.chybi || [])];
  } else if (config.ai.apiKey) {
    try { surovy = await zavolejClaude(a.text); zdroj = 'ai'; model = config.ai.model; }
    catch (e) { surovy = lokalniRozbor(a.text); zdroj = 'lokalne'; surovy.chybi = [...(surovy.chybi || []), `AI nedostupná (${String(e.message).slice(0, 80)}), použit lokální rozbor.`]; }
  } else {
    surovy = lokalniRozbor(a.text);
  }
  surovy.limity = (surovy.limity || []).filter((l) => LIMITY.includes(l));
  if (!['symptom', 'limited', 'full'].includes(surovy.cil)) surovy.cil = 'symptom';
  // identita pacienta: jméno se z textu nevytěžuje přes AI – z hlavičky si ho vezme server sám (src/identita.js)
  const zHlavicky = identita.jmenoCele ? { jmenoCele: identita.jmenoCele, ...(identita.rok ? { rok: identita.rok } : {}) } : {};
  return { blokovano: false, aiBlokovano: a.blokovano, vysledek: { ...obnov(surovy, a.mapa), ...zHlavicky }, identita, anonymniText: a.text, pocetNahrad: a.pocetNahrad, zdroj, model };
}
