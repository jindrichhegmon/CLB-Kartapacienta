/**
 * Text ze zprávy v PDF nebo z fotky (0.11.120 textová vrstva, 0.11.122 OCR).
 * - PDF s textem (Medistar „Uložit jako PDF“): text přímo z PDF.
 * - PDF bez textu („Microsoft Print to PDF“ převede písmena na křivky, sken) a fotka JPG/PNG: rozpoznání textu (OCR)
 *   přímo na tomto serveru – tesseract.js s češtinou z balíčku @tesseract.js-data/ces, nic se nikam neposílá.
 * Knihovny se načtou až při prvním použití; OCR jede vždy jen jedno (fronta), worker se po 5 min nečinnosti ukončí.
 * Opakované hlavičky stran (zařízení, pacient, adresa) a čísla stran se ze stran 2+ vynechají.
 */
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
let pdfjs = null;
const nactiPdfjs = async () => (pdfjs ||= await import('pdfjs-dist/legacy/build/pdf.mjs'));
const doPole = (buf) => new Uint8Array(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf);
const OCR_MAX_STRAN = 8;
const OCR_MERITKO = 3;   // A4 → cca 1790 × 2530 px (≈ 216 dpi), čte se spolehlivě i drobné písmo

/** Jen textová vrstva PDF (rychlé). U PDF bez textu vrátí prázdný řetězec. */
export async function textZPdf(buf, { maxStran = 30 } = {}) {
  const { getDocument } = await nactiPdfjs();
  const doc = await getDocument({ data: doPole(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  const stranky = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, maxStran); i++) {
      const c = await (await doc.getPage(i)).getTextContent();
      stranky.push(c.items.map((x) => (x.str || '') + (x.hasEOL ? '\n' : '')).join(''));
    }
  } finally { await doc.destroy(); }
  return slozStranky(stranky);
}

/**
 * Text ze zprávy: PDF (textová vrstva, jinak OCR) nebo obrázek (OCR).
 * Vrací { text, ocr: true|false, stran }.
 */
export async function textZeZpravy(buf, mime) {
  if (mime === 'image/jpeg' || mime === 'image/png') return { text: slozStranky([await rozpoznej(Buffer.from(buf))]), ocr: true, stran: 1 };
  const t = await textZPdf(buf);
  if (t.replace(/\s/g, '').length >= 40) return { text: t, ocr: false };
  const { text, stran } = await ocrZPdf(buf);
  return { text, ocr: true, stran };
}

/** PDF bez textu → obrázky stran → OCR. */
export async function ocrZPdf(buf, { maxStran = OCR_MAX_STRAN } = {}) {
  const { getDocument } = await nactiPdfjs();
  const { createCanvas } = require('@napi-rs/canvas');
  class Platna { create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; } reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; } destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; } }
  const doc = await getDocument({ data: doPole(buf), isEvalSupported: false, disableFontFace: true, verbosity: 0, CanvasFactory: Platna }).promise;
  const stranky = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, maxStran); i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: OCR_MERITKO });
      const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      stranky.push(await rozpoznej(c.toBuffer('image/png')));
      page.cleanup();
    }
  } finally { await doc.destroy(); }
  return { text: slozStranky(stranky), stran: stranky.length };
}

/* ---- OCR: jeden worker, fronta, ukončení po nečinnosti ---- */
let worker = null, fronta = Promise.resolve(), casovac = null;
async function dejWorker() {
  if (worker) return worker;
  const { createWorker } = require('tesseract.js');
  const langPath = path.join(path.dirname(require.resolve('@tesseract.js-data/ces/package.json')), '4.0.0_best_int');
  worker = createWorker('ces', 1, { langPath, gzip: true, cacheMethod: 'none' });
  try { return await worker; } catch (e) { worker = null; throw e; }
}
function rozpoznej(obrazek) {
  const prace = fronta.then(async () => {
    clearTimeout(casovac);
    const w = await dejWorker();
    try { return (await w.recognize(obrazek)).data.text || ''; } finally {
      casovac = setTimeout(async () => { const x = worker; worker = null; try { await (await x).terminate(); } catch { /* nic */ } }, 5 * 60e3);
      casovac.unref?.();
    }
  });
  fronta = prace.catch(() => {});
  return prace;
}

/** Ukončí OCR worker (testy, ukončení serveru). */
export async function ukonciOcr() {
  clearTimeout(casovac);
  const x = worker; worker = null;
  if (x) { try { await (await x).terminate(); } catch { /* nic */ } }
}

/* ---- úklid textu: opakované hlavičky a čísla stran ---- */
export function slozStranky(stranky) {
  const radky = stranky.map((s) => String(s).replace(/\r/g, '').split('\n').map((l) => l.replace(/[ \t]+$/g, '')));
  const klic = (l) => l.replace(/\s+/g, ' ').trim();
  // řádek z horních 8 řádků, který je i na jiné straně, je hlavička – na stranách 2+ se vynechá
  const hlavicky = new Set();
  if (radky.length > 1) {
    const pocet = new Map();
    radky.forEach((r) => new Set(r.filter((l) => klic(l)).slice(0, 8).map(klic)).forEach((k) => pocet.set(k, (pocet.get(k) || 0) + 1)));
    pocet.forEach((n, k) => { if (n > 1 && k.length > 3) hlavicky.add(k); });
  }
  const ven = radky.map((r, i) => {
    let x = i > 0 ? r.filter((l) => !hlavicky.has(klic(l))) : r;
    // samotné číslo strany na konci (OCR i textová vrstva)
    while (x.length && !klic(x[x.length - 1])) x = x.slice(0, -1);
    if (x.length && /^(-\s*)?\d{1,2}(\s*-)?$|^(strana|str\.)\s*\d+(\s*(\/|z)\s*\d+)?$/i.test(klic(x[x.length - 1]))) x = x.slice(0, -1);
    return x.join('\n');
  });
  return ven.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
