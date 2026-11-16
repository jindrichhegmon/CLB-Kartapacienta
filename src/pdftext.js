/**
 * Text z PDF (0.11.120) – textová vrstva zprávy (např. Medistar), bez OCR. Knihovna pdfjs-dist se načte až při prvním použití.
 * Vrací prostý text (řádky podle PDF); u skenu bez textové vrstvy prázdný řetězec.
 */
let pdfjs = null;
export async function textZPdf(buf, { maxStran = 30 } = {}) {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf);
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  let t = '';
  try {
    for (let i = 1; i <= Math.min(doc.numPages, maxStran); i++) {
      const c = await (await doc.getPage(i)).getTextContent();
      t += c.items.map((x) => (x.str || '') + (x.hasEOL ? '\n' : '')).join('') + '\n';
    }
  } finally { await doc.destroy(); }
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
