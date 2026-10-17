/** Pomocné funkce pro Express: chyby, async obálka, jednoduché omezení pokusů, IP. */

export const chyba = (zprava, status = 400) => Object.assign(new Error(zprava), { status });

/** Obalí async handler – chyby pošle jako JSON { ok:false, chyba }. */
export const h = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json({ ok: true, ...(out || {}) });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(new Date().toISOString(), req.method, req.path, e);
    const zprava = status >= 500 && !e.verejna ? 'Chyba serveru: ' + String(e.message || e).slice(0, 160) : e.message;
    if (!res.headersSent) res.status(status).json({ ok: false, chyba: zprava });
  }
};

export const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().slice(0, 45);

/** Omezení pokusů (přihlášení, PIN, párování): max N za okno na klíč. */
const pokusy = new Map();
export function omez(klic, max = 8, oknoMs = 10 * 60 * 1000) {
  const nyni = Date.now();
  const z = pokusy.get(klic) || { n: 0, od: nyni };
  if (nyni - z.od > oknoMs) { z.n = 0; z.od = nyni; }
  z.n++;
  pokusy.set(klic, z);
  if (z.n > max) throw chyba('Příliš mnoho pokusů – zkuste to prosím za několik minut', 429);
}
export const omezReset = (klic) => pokusy.delete(klic);
setInterval(() => { const n = Date.now(); for (const [k, z] of pokusy) if (n - z.od > 3600000) pokusy.delete(k); }, 600000).unref();

/** Bearer token z hlavičky Authorization. */
export const bearer = (req, typ = 'Bearer') => {
  const a = String(req.headers.authorization || '');
  return a.startsWith(typ + ' ') ? a.slice(typ.length + 1).trim() : '';
};

export const text = (v, max = 500) => String(v ?? '').trim().slice(0, max);
export const cislo = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
