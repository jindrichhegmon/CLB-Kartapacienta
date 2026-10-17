/**
 * AI rozbor propouštěcí zprávy – VŽDY nad anonymizovaným textem.
 * Identita pacienta zůstává na serveru (mapa značek), AI dostane jen text se značkami a výsledek
 * se k pacientovi přiřadí zpět až tady. Bez ANTHROPIC_API_KEY běží lokální heuristika (stejný výstup).
 * AI nic nerozhoduje: předvyplní formulář a upozorní na chybějící údaje, lékař potvrdí.
 */
import { config } from './config.js';
import { anonymizuj, obnov } from './anonym.js';

const LIMITY = ['KPR', 'Umělá plicní ventilace', 'Hospitalizace', 'Antibiotika i.v.', 'Infuze / i.v. výživa', 'Sonda / PEG', 'Dialýza', 'Transfuze'];

const POKYNY = `Jsi asistent paliativního lékaře. Z propouštěcí zprávy vytěž údaje pro krizový plán péče.
Text je anonymizovaný: osoby, data a telefony jsou nahrazeny značkami v hranatých závorkách ([PACIENT], [OSOBA_1], [TELEFON_1], [DATUM_1]…). Značky ponech přesně tak, jak jsou – nedoplňuj ani nehádej skutečná jména.
Vrať POUZE JSON bez komentáře v tomto tvaru:
{"dg":"diagnózy jednou větou, oddělené středníkem",
 "alergie":"…nebo 'žádné známé'",
 "medikace":["lék dávka schéma", …],
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
export function lokalniRozbor(t) {
  const lines = t.split('\n').map((l) => l.trim());
  const sekce = (nazvy) => {
    const i = lines.findIndex((l) => nazvy.some((n) => l.toLowerCase().startsWith(n)));
    if (i < 0) return [];
    const out = [];
    for (let j = i + 1; j < lines.length; j++) { if (!lines[j]) break; if (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^:]{2,40}:/.test(lines[j])) break; out.push(lines[j]); }
    return out;
  };
  const a = { chybi: [], citace: {} };
  const pb = t.match(/Propuštěn[ao]? do:\s*([^\n]+)/i); a.pobyt = pb ? pb[1].trim() : '';
  a.dg = sekce(['diagnózy', 'diagnozy', 'dg.']).map((l) => l.replace(/^[A-Z]\d{2}(\.\d)?\s*/, '')).join('; ');
  const al = t.match(/Alergie:\s*([^\n]+)/i); a.alergie = al ? al[1].trim() : '';
  a.medikace = sekce(['medikace při propuštění', 'medikace', 'terapie']);
  const sos = t.match(/SOS medikace:\s*([^\n]+)/i);
  a.sos = sos ? sos[1].split(/,\s*(?=[a-záčďéěíňóřšťúůýž]+\s\d)/i).map((s) => s.trim()) : [];
  const fs = t.match(/Funkční stav:\s*([^\n]+)/i); a.funkce = fs ? fs[1].trim() : '';
  const cilS = (t.match(/[^.\n]*(nepřeje|resuscit|ventilátor|cíl[eů]? péče|paliativ|symptomatick)[^.\n]*\./i) || [''])[0];
  a.citace.cil = cilS.trim();
  a.limity = [];
  if (/resuscit|KPR|DNR/i.test(t)) a.limity.push('KPR');
  if (/ventil/i.test(t)) a.limity.push('Umělá plicní ventilace');
  if (/hospitalizaci jen|bez hospitalizac|další hospitalizac/i.test(t)) a.limity.push('Hospitalizace');
  a.cil = /symptomatick|komfort|paliativní péč/i.test(t) ? 'symptom' : (a.limity.length ? 'limited' : 'full');
  const dvp = /dříve vyslovené přání/i.test(t) && !/nebylo sepsáno|není sepsáno/i.test(t);
  a.doklad = { dvp, datum: '', zprava: (t.split('\n')[0] || '').trim() };
  a.kontakty = [...t.matchAll(/(syn|dcera|manžel(?:ka)?|opatrovník)\s+(\[OSOBA_\d+\]|[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^,\n]+?),\s*tel\.?\s*(\[TELEFON_\d+\]|[\d ]{9,})/gi)]
    .map((m) => ({ jmeno: `${m[2].trim()}, ${m[1].toLowerCase()}`, tel: m[3].trim(), skupina: /opatrovník/i.test(m[1]) ? 'ROZHODUJE' : 'INFORMOVAT' }));
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
export async function rozborZpravy(text, znamo = {}) {
  const a = anonymizuj(text, znamo);
  if (a.blokovano) {
    return { blokovano: true, duvod: 'Po anonymizaci v textu zůstalo něco, co vypadá jako identifikátor (' + a.zbytky.join(', ') + '). Dotaz na AI nebyl odeslán.', pocetNahrad: a.pocetNahrad, anonymniText: a.text };
  }
  let surovy, zdroj = 'lokalne', model = null;
  if (config.ai.apiKey) {
    try { surovy = await zavolejClaude(a.text); zdroj = 'ai'; model = config.ai.model; }
    catch (e) { surovy = lokalniRozbor(a.text); zdroj = 'lokalne'; surovy.chybi = [...(surovy.chybi || []), `AI nedostupná (${String(e.message).slice(0, 80)}), použit lokální rozbor.`]; }
  } else {
    surovy = lokalniRozbor(a.text);
  }
  surovy.limity = (surovy.limity || []).filter((l) => LIMITY.includes(l));
  if (!['symptom', 'limited', 'full'].includes(surovy.cil)) surovy.cil = 'symptom';
  // identita pacienta: jméno se z textu nevytěžuje přes AI – z hlavičky si ho vezme server sám
  const hlavicka = String(text).match(/Pacient(?:ka)?\s*:?\s*([^,\n]+?)\s*,\s*nar\.\s*(\d{1,2}\.\s?\d{1,2}\.\s?)?(\d{4})/i);
  const identita = hlavicka ? { jmenoCele: hlavicka[1].trim(), rok: Number(hlavicka[3]) } : {};
  return { blokovano: false, vysledek: { ...obnov(surovy, a.mapa), ...identita }, anonymniText: a.text, pocetNahrad: a.pocetNahrad, zdroj, model };
}
