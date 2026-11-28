/* CORS – které cesty API smějí volat stránky z jiných adres (Netlify, aplikace v telefonu). Přihlášení je vždy hlavičkou
   Authorization (token zařízení nebo session), cookies se nepoužívají. Adresy jsou v konfiguraci (KP_PRUKAZ_ORIGINY, KP_ZPRAVA_ORIGINY).
   0.11.109: Průkaz pacienta (DialogusPrukaz, web na Netlify / aplikace pro Android a iPhone) – jen vyjmenované cesty. */
import { config } from './config.js';

const PRUKAZ_CESTY = new Set(['/api/d/parovat', '/api/d/parovaci-info', '/api/d/cislo', '/api/d/stav', '/api/d/sync', '/api/d/sdilet', '/api/d/zasilka', '/api/napoveda', '/api/napoveda/dotaz']);
/* 0.11.148: aplikace „Zpráva do Průkazu“ (lékař: přihlášení účtem Karty, rozbor zprávy, zašifrovaná zásilka pro Průkaz pacienta) */
const ZPRAVA_CESTY = new Set(['/api/c/login', '/api/c/ja', '/api/c/ai/rozbor-souboru', '/api/c/zasilka', '/api/c/zasilka/stav', '/api/c/zasilka/zrusit']);
export const corsPovolen = (o, cesta) => {
  const p = String(cesta || '').replace(/\/$/, '');
  return !!o && (((PRUKAZ_CESTY.has(p) || /^\/api\/d\/dokument\/\d+$/.test(p)) && config.prukazOriginy.includes(o)) || (ZPRAVA_CESTY.has(p) && config.zpravaOriginy.includes(o)));
};
