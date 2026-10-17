/**
 * Karta pacienta – server. Tři aplikace na jednom endpointu:
 *   /tenanti/   správa tenantů (provozovatel platformy)
 *   /centrala/  centrální aplikace (garant, tým kolem pacienta)
 *   /karta/     karta pacienta na mobil (PWA, offline, synchronizace)
 *   /demo/      původní lokální prototyp (data jen v prohlížeči)
 * API: /api/admin/*, /api/c/*, /api/d/*, /api/health
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, zkontrolujKonfiguraci } from './config.js';
import { pool } from './db.js';
import { admin } from './routes/admin.js';
import { central } from './routes/central.js';
import { device } from './routes/device.js';

const koren = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', express.json({ limit: '12mb' }));

app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try { const p = await pool(); await p.request().query('SELECT 1 AS x'); } catch (e) { db = 'chyba: ' + String(e.message).slice(0, 80); }
  res.json({ ok: db === 'ok', aplikace: 'clb-kartapacienta', verze: config.verze, db, cas: new Date().toISOString(), konfigurace: zkontrolujKonfiguraci() });
});
app.use('/api/admin', admin);
app.use('/api/c', central);
app.use('/api/d', device);
app.use('/api', (req, res) => res.status(404).json({ ok: false, chyba: 'Neznámý endpoint' }));

// statické aplikace; service worker karty smí řídit celé /karta/
app.use('/karta', (req, res, next) => { if (req.path === '/sw.js') res.setHeader('Service-Worker-Allowed', '/karta/'); next(); });
app.use(express.static(path.join(koren, 'public'), {
  extensions: ['html'],
  setHeaders: (res, f) => { if (/\.(html|js|webmanifest)$/.test(f)) res.setHeader('Cache-Control', 'no-cache'); },
}));

const chyby = zkontrolujKonfiguraci();
if (chyby.length) console.warn('POZOR – v .env chybí:', chyby.join(', '));
app.listen(config.port, config.host, () => console.log(`clb-kartapacienta ${config.verze} na http://${config.host}:${config.port}`));
