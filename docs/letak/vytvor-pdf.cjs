/**
 * Vytvoří PDF letáku z karta-pacienta-letak.html (Chromium přes Playwright, A4).
 *   node docs/letak/vytvor-pdf.cjs            → docs/letak/Karta-pacienta-letak.pdf
 *   node docs/letak/vytvor-pdf.cjs karta-pacienta-strucny.html Karta-pacienta-strucny.pdf   (zkrácená verze pro partnery)
 * Vyžaduje nainstalovaný Playwright s Chromiem (npx playwright install chromium).
 */
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const slozka = __dirname;
  const vstup = 'file://' + path.join(slozka, process.argv[2] || 'karta-pacienta-letak.html');
  const vystup = path.join(slozka, process.argv[3] || 'Karta-pacienta-letak.pdf');
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(vstup, { waitUntil: 'load' });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: vystup, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log('PDF:', vystup);
})();
