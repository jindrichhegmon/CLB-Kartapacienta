/**
 * Založí / doplní tabulky A_KP_* v PeceDomaPlus (skripty sql/*.sql, idempotentní).
 *   npm run migrate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { davka, pool } from '../src/db.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  process.stdout.write(`${f} … `);
  const sady = await davka(fs.readFileSync(path.join(dir, f), 'utf8'));
  console.log('ok');
  const posledni = sady[sady.length - 1];
  if (posledni && posledni.length && posledni[0].tabulka) console.table(posledni);
}
(await pool()).close();
