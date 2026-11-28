/**
 * Zpráva do Průkazu – /api/z/* (0.11.148). Veřejné API bez přihlášení a bez vazby na Kartu pacienta (žádný tenant, nic do databáze).
 *   POST /rozbor          { mime, nazev, data(base64) } → { vysledek:{dg, alergie, medikace, opioidy, parenteralni, sos, chybi}, zdroj, pocetNahrad }
 *                         zpráva se přečte (i OCR) a rozebere přes rozborZpravy() – do AI jde jen anonymizovaný text (bez jména, RČ,
 *                         adresy, telefonů); identita se nevrací ani neukládá, soubor se zahodí
 *   POST /zasilka         { id, sifra } → { platnostDo }      zašifrované údaje (klíč zná jen aplikace a Průkaz – src/zasilka.js)
 *   POST /zasilka/stav    { id } → { ceka }
 *   POST /zasilka/zrusit  { id }
 *   POST /vyzvednout      { id } → { sifra }                  Průkaz pacienta – jednou, pak se zásilka smaže
 * Proti zneužití: limity na IP a denní strop rozborů pro celý server (AI něco stojí).
 */
import { Router } from 'express';
import { h, chyba, omez, ip, text } from '../http.js';
import { textZeZpravy } from '../pdftext.js';
import { rozborZpravy } from '../ai.js';
import { zalozZasilku, vyzvedniZasilku, zrusZasilku, cekaZasilka, ZASILKA_ID_RE } from '../zasilka.js';

export const zprava = Router();
const MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const DENNE_MAX = Number(process.env.KP_ZPRAVA_DENNE_MAX || 400);
let den = '', dnes = 0;
const pocitej = () => { const d = new Date().toISOString().slice(0, 10); if (d !== den) { den = d; dnes = 0; } if (++dnes > DENNE_MAX) throw chyba('Rozbor zpráv je pro dnešek vyčerpaný – zkuste to prosím zítra', 429); };
const id = (b) => { const x = String((b || {}).id || ''); if (!ZASILKA_ID_RE.test(x)) throw chyba('Neplatný kód zprávy'); return x; };
const radky = (v) => (Array.isArray(v) ? v : String(v || '').split(/\r?\n/)).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 60).map((x) => x.slice(0, 300));

zprava.post('/rozbor', h(async (req) => {
  const b = req.body || {};
  const mime = text(b.mime, 80);
  if (!MIME.includes(mime)) throw chyba('Nahrajte zprávu v PDF nebo fotku zprávy (JPG, PNG)');
  const data = b.data ? Buffer.from(String(b.data), 'base64') : null;
  if (!data || !data.length) throw chyba('Chybí soubor se zprávou');
  if (data.length > 8 * 1024 * 1024) throw chyba('Soubor je větší než 8 MB');
  omez('zprava-rozbor:' + ip(req), 20, 3600e3);
  pocitej();
  const t0 = Date.now();
  let z;
  try { z = await textZeZpravy(data, mime); } catch (e) { throw chyba('Zprávu se nepodařilo přečíst: ' + String(e.message || e).slice(0, 160)); }
  if (z.text.replace(/\s/g, '').length < 40) throw chyba(z.ocr ? 'Ve zprávě se nepodařilo rozpoznat text (nečitelný sken nebo fotka)' : 'Zpráva neobsahuje text');
  const r = await rozborZpravy(z.text.slice(0, 60000), { telefony: [], osoby: [] }, { priBlokuLokalne: true });
  const v = r.vysledek || {};
  /* pojistka: kdyby se jméno nebo RČ pacienta dostalo do navržených řádků (rozbor vrací text s obnovenými zástupnými značkami),
     v odpovědi se nahradí „…“ – jméno patří jen do Průkazu, kam si ho pacient napíše sám */
  const id0 = r.identita || {}, rcCisla = String(id0.rc || '').replace(/\D/g, '');
  const hledej = [id0.jmenoCele, id0.prijmeni, id0.adresa].filter((x) => x && String(x).length >= 3).map((x) => new RegExp(String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
  const bez = (s) => { let x = String(s); for (const re of hledej) x = x.replace(re, '…'); if (rcCisla.length >= 9) x = x.replace(/\d{6}\s?\/?\s?\d{3,4}/g, (m) => (m.replace(/\D/g, '') === rcCisla ? '…' : m)); return x; };
  const radkyB = (pole) => radky(pole).map(bez);
  // jen anonymní souhrn do logu serveru (bez obsahu a bez identity)
  console.log(`[zprava] rozbor ${Math.round(data.length / 1024)} kB · ${z.ocr ? 'OCR ' : ''}${Math.round((Date.now() - t0) / 1000)} s · ${r.zdroj}${r.aiBlokovano ? ' (AI blokováno)' : ''} · skryto ${r.pocetNahrad || 0} · ${ip(req)}`);
  // identita (jméno, RČ, adresa…) se nevrací – aplikace ani Průkaz ji nedostanou
  return { vysledek: { dg: radkyB(v.dg), alergie: radkyB(String(v.alergie || '').split(/[;\n]/)), medikace: radkyB(v.medikace), opioidy: radkyB(v.opioidy), parenteralni: radkyB(v.parenteralni), sos: radkyB(v.sos), chybi: radkyB(v.chybi) },
    zdroj: r.zdroj, pocetNahrad: r.pocetNahrad || 0, ocr: !!z.ocr };
}));

zprava.post('/zasilka', h(async (req) => {
  omez('zprava-zasilka:' + ip(req), 40, 3600e3);
  return zalozZasilku({ id: id(req.body), sifra: (req.body || {}).sifra });
}));
zprava.post('/zasilka/stav', h(async (req) => ({ ceka: cekaZasilka(id(req.body)) })));
zprava.post('/zasilka/zrusit', h(async (req) => { zrusZasilku(id(req.body)); return {}; }));

zprava.post('/vyzvednout', h(async (req) => {
  omez('zprava-vyzvednout:' + ip(req), 30, 3600e3);
  const z = vyzvedniZasilku(id(req.body));
  if (!z) throw chyba('Zpráva už není k dispozici – kód platí 30 minut a jen jednou. Požádejte o nový.', 404);
  return { sifra: z.sifra };
}));
