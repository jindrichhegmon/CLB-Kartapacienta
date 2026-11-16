/**
 * Kontrola čtení zpráv na serveru (0.11.126): text z PDF bez textové vrstvy (OCR) na smyšleném dekurzu z test/.
 * Spouští ho nasazení (deploy/vps-deploy.sh) po instalaci knihoven; ručně: node scripts/ocr-kontrola.mjs
 * Vypíše „OCR: OK …“ s časem a pamětí, nebo chybu. Nic nezapisuje, nic neposílá ven.
 */
import fs from 'node:fs';
import { textZeZpravy, ukonciOcr } from '../src/pdftext.js';
import { lokalniRozbor } from '../src/ai.js';

const t0 = Date.now();
try {
  const z = await textZeZpravy(fs.readFileSync(new URL('../test/zprava-medistar-bez-textu.pdf', import.meta.url)), 'application/pdf');
  const r = lokalniRozbor(z.text);
  const mb = Math.round(process.memoryUsage().rss / 1e6);
  const ok = z.ocr && /R52\.1/.test(r.dg) && r.opioidy.length > 0;
  console.log(`${ok ? 'OCR: OK' : 'OCR: POZOR – text přečten jen částečně'} (${z.stran} str., ${z.text.length} znaků, ${((Date.now() - t0) / 1000).toFixed(1)} s, paměť ${mb} MB)`);
  await ukonciOcr();
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.log('OCR: CHYBA – ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | '));
  process.exit(1);
}
