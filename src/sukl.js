/**
 * Seznam léčiv SÚKL (0.11.124) – stejná databáze jako Průkaz pacienta: soubor leky.json z otevřených dat SÚKL (DLP),
 * který repozitář DialogusPrukaz jednou měsíčně obnoví (nastroje/sukl-leky.mjs) a nasadí na ${KP_PRUKAZ_ADRESA}/prukaz/data/leky.json.
 * Server si ho jednou za den stáhne odtud; do té doby (a bez spojení) použije kopii v repozitáři data/sukl-leky.json.
 * Formát: { verze, formy:{kód:název}, leky:[[kódSÚKL, název, síla, forma]], ean, kody }. Veřejná data, nic o pacientech.
 */
import fs from 'node:fs';
import { config } from './config.js';

const KOPIE = new URL('../data/sukl-leky.json', import.meta.url);
const OBNOVA_MS = 24 * 3600e3;
export const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

let index = null, nacteno = 0, stahuji = null;

export function indexSukl(j) {
  const formy = j.formy || {};
  const polozky = (j.leky || []).map(([kod, nazev, sila, forma]) => ({ kod: kod || '', nazev, sila: sila || '', forma: forma || '', formaText: formy[forma] || forma || '', n: norm(nazev) }));
  const prvni = new Map();
  for (const p of polozky) { const w = p.n.split(' ')[0]; if (w.length >= 3) { if (!prvni.has(w)) prvni.set(w, []); prvni.get(w).push(p); } }
  return {
    verze: j.verze || '', pocet: polozky.length,
    /** našeptávač – stejné pořadí jako v Průkazu: názvy začínající dotazem (kratší dřív), pak obsahující */
    hledej(q, kolik = 8) {
      const x = norm(q); if (x.length < 2) return [];
      const zac = [], obs = [];
      for (const p of polozky) { if (p.n.startsWith(x)) zac.push(p); else if (x.length >= 3 && p.n.includes(x)) obs.push(p); if (zac.length >= 200) break; }
      const vid = new Set();
      return [...zac.sort((a, b) => a.n.length - b.n.length), ...obs].filter((p) => { const k = p.n + '|' + p.sila + '|' + p.forma; if (vid.has(k)) return false; vid.add(k); return true; }).slice(0, kolik);
    },
    /** lék podle textu ze zprávy („Palexia SR 150-0-50“) – první slovo názvu a síla */
    najdiVTextu(t) {
      for (const w of norm(t).split(/[^a-z0-9]+/).filter((s) => s.length >= 4).slice(0, 2)) {
        const k = prvni.get(w); if (!k) continue;
        const sila = (String(t).match(/\d+(?:[.,]\d+)?/) || [''])[0].replace(',', '.');
        return k.find((p) => sila && p.sila.replace(',', '.').startsWith(sila)) || k[0];
      }
      return null;
    },
  };
}

function nactiKopii() {
  try { return indexSukl(JSON.parse(fs.readFileSync(KOPIE, 'utf8'))); } catch { return indexSukl({}); }
}
async function stahni() {
  const r = await fetch(`${config.prukazAdresa}/prukaz/data/leky.json`, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j.leky) || j.leky.length < 1000) throw new Error('neúplný seznam');
  return indexSukl(j);
}
/** Seznam (hned z paměti nebo z kopie); jednou za den se na pozadí obnoví z Průkazu. */
export function seznamSukl() {
  if (!index) { index = nactiKopii(); nacteno = 0; }
  // v testech jen kopie (bez stahování)
  if (Date.now() - nacteno > OBNOVA_MS && !stahuji && process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
    stahuji = stahni().then((x) => { if (x.pocet) index = x; nacteno = Date.now(); })
      .catch(() => { nacteno = Date.now() - OBNOVA_MS + 3600e3; })   // zkusit znovu za hodinu
      .finally(() => { stahuji = null; });
  }
  return index;
}
export const lekText = (p) => [p.nazev, p.sila].filter(Boolean).join(' ');
