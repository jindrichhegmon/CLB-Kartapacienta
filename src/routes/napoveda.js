/**
 * Nápověda (standard aplikací jako PéčeDoma): návod s obrázky a chat nad ním.
 *   GET  /api/napoveda          → { text } Markdown z napoveda/napoveda.md (veřejné – jen návod, žádná data)
 *   POST /api/napoveda/dotaz    { zpravy:[{role,text}], aplikace, obrazovka } → { text }
 *        jen přihlášený uživatel centrály / správy tenantů (Bearer session) nebo spárovaný telefon (Device token)
 * Asistent odpovídá jen podle návodu a k datům pacientů nemá přístup. Dotazy uživatele jdou přes anonymizační bránu (src/anonym.js);
 * když v nich zůstane něco jako identifikátor, k AI se neodešlou. Bez ANTHROPIC_API_KEY odpoví lokální hledání v návodu.
 */
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { h, chyba, omez, ip, bearer } from '../http.js';
import { overSession, sha256 } from '../crypto.js';
import { vTenantu } from '../db.js';
import { anonymizuj } from '../anonym.js';

export const napoveda = Router();

const SOUBOR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'napoveda', 'napoveda.md');
const MAX_ZPRAV = 12;
const MAX_ZNAKU = 1500;
const APLIKACE = { centrala: 'centrální aplikace (lékař, sestra, správce organizace)', karta: 'karta pacienta na telefonu u lůžka (pečující s PINem, lékař s kódem, posádka ZZS)', tenanti: 'správa tenantů (provozovatel platformy)', pacient: 'Můj průkaz – aplikace pacienta ve vlastním telefonu (pacient sám)' };

let cache = { text: '', mtime: 0 };
export function textNapovedy() {
  try {
    const st = fs.statSync(SOUBOR);
    if (st.mtimeMs !== cache.mtime) cache = { text: fs.readFileSync(SOUBOR, 'utf8'), mtime: st.mtimeMs };
  } catch { throw chyba('Soubor nápovědy chybí (napoveda/napoveda.md)', 500); }
  return cache.text;
}

/** Kdo se ptá: session centrály / správy tenantů, nebo spárovaný telefon. */
async function kdo(req) {
  const ses = overSession(bearer(req));
  if (ses && (ses.typ === 'kp' || ses.typ === 'superadmin')) return ses.typ === 'kp' ? 'uživatel ' + ses.uzivatelId : 'správa tenantů';
  const dev = bearer(req, 'Device');
  const m = dev.match(/^([A-Z0-9]{16})\.(\d+)\.(.+)$/);
  if (m) {
    const z = await vTenantu(m[1], (q) => q.one(`SELECT ZarizeniID FROM dbo.A_KP_Zarizeni WHERE ZarizeniID = @z AND TokenHash = @t AND Stav = 'SPAROVANO'`, { z: Number(m[2]), t: sha256(dev) }));
    if (z) return 'telefon ' + z.ZarizeniID;
  }
  throw chyba('Chat nápovědy je jen pro přihlášené uživatele a spárované telefony', 401);
}

const POKYNY = `Jsi asistent nápovědy k aplikaci "Karta pacienta" (paliativní průkaz: krizový plán péče, který má pacient v telefonu u lůžka). Aplikace má čtyři části: centrální aplikaci pro garanta a tým kolem pacienta, kartu na zapůjčeném telefonu u pacienta, aplikaci Můj průkaz pro pacienta ve vlastním telefonu a správu tenantů pro provozovatele platformy. Odpovídáš lékařům, sestrám, pečujícím, pacientům a správcům.

Pravidla:
- Odpovídej česky, stručně a prakticky: nejdřív odpověď, pak postup po krocích, když je potřeba. Názvy obrazovek, záložek a tlačítek piš přesně jako v návodu (např. záložka Telefon a PINy, tlačítko Spárovat telefon).
- Vycházej jen z přiloženého návodu. Když v něm odpověď není, řekni to na rovinu a doporuč obrátit se na správce organizace; nic si nedomýšlej.
- Nemáš přístup k datům pacientů ani k databázi. Na dotazy o konkrétních pacientech odpověz, že chat vidí jen návod, a poraď, kde to uživatel v aplikaci najde.
- Text dotazů je anonymizovaný – značky v hranatých závorkách ([OSOBA_1], [TELEFON_1]…) nech být a nevykládej je.
- Nedávej zdravotní ani právní rady k pacientům; jde jen o obsluhu aplikace. Při ohrožení života vždy odkaž na krizovou kartu a linku 155.
- Formát: prostý text, krátké odstavce, číslované kroky "1." "2." u postupů. Bez markdownových nadpisů a tabulek. Tučné jen výjimečně **hvězdičkami**.
- Návod obsahuje obrázky jako řádky ![popis](cesta) – nezmiňuj je a cesty neopisuj.
- Na úplný konec odpovědi připoj samostatný řádek "Kapitola: 8. Telefon a PINy" (číslo a název kapitoly návodu, kde je věc popsaná; nejvýš dvě kapitoly na dvou řádcích). Aplikace z něj udělá odkaz do návodu. Když odpověď v návodu není, řádek vynech.`;

/** Lokální odpověď bez AI: kapitola návodu s nejvíc shodnými slovy. */
export function lokalne(dotaz) {
  const kap = textNapovedy().split(/\n(?=## )/).slice(1).map((t) => ({ nadpis: t.split('\n')[0].replace(/^##\s*/, ''), text: t }));
  const bez = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set(['jak', 'kde', 'kdy', 'pro', 'pri', 'pak', 'pod', 'nad', 'neni', 'jsem', 'jsou', 'muzu', 'mohu', 'chci', 'udelat', 'tento', 'tohle', 'karta', 'karty', 'kartu', 'pacient', 'pacienta']);
  const kmeny = (bez(dotaz).match(/[a-z0-9]{3,}/g) || []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, Math.min(w.length, 5)));
  const vyskyty = (t, k) => (t.match(new RegExp(`(^|[^a-z0-9])${k}`, 'g')) || []).length;
  // nadpis kapitoly váží víc než zmínka v textu
  const skore = (k) => { const nad = bez(k.nadpis), telo = bez(k.text); return kmeny.reduce((s, w) => s + vyskyty(telo, w) + 8 * vyskyty(nad, w), 0); };
  const nej = kap.map((k) => ({ ...k, s: skore(k) })).sort((a, b) => b.s - a.s)[0];
  if (!nej || !nej.s) return 'Na tohle jsem v návodu odpověď nenašel. Podívejte se do obsahu nápovědy (📖) nebo se obraťte na správce organizace.';
  const odstavec = nej.text.split('\n\n').slice(1).find((o) => !o.startsWith('![') && o.trim().length > 40) || '';
  return `Chat s AI teď není k dispozici, tohle je nejbližší místo v návodu:\n\n${odstavec.replace(/\*\*/g, '').slice(0, 700)}\n\nKapitola: ${nej.nadpis}`;
}

napoveda.get('/', h(async () => ({ text: textNapovedy() })));

napoveda.post('/dotaz', h(async (req) => {
  omez('napoveda:' + ip(req), 40);
  const kdoSePta = await kdo(req);
  const zpravy = (Array.isArray(req.body && req.body.zpravy) ? req.body.zpravy : [])
    .map((m) => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', text: String((m && m.text) || '').trim().slice(0, MAX_ZNAKU) }))
    .filter((m) => m.text).slice(-MAX_ZPRAV);
  if (!zpravy.length || zpravy[zpravy.length - 1].role !== 'user') throw chyba('Chybí dotaz');
  // dotazy uživatele přes anonymizační bránu – identita pacienta k AI nesmí
  for (const m of zpravy) {
    if (m.role !== 'user') continue;
    const a = anonymizuj(m.text);
    if (a.blokovano) return { text: 'Do chatu nápovědy prosím nepište údaje pacientů (jméno, rodné číslo, telefon, e-mail) – chat vidí jen návod a k pacientům přístup nemá. Zeptejte se obecně, například „Jak změním telefon s kartou?“.' };
    m.text = a.text;
  }
  const dotaz = zpravy[zpravy.length - 1].text;
  if (!config.ai.apiKey) return { text: lokalne(dotaz) };

  const messages = [];
  for (const m of zpravy) { const l = messages[messages.length - 1]; if (l && l.role === m.role) l.content += '\n\n' + m.text; else messages.push({ role: m.role, content: m.text }); }
  if (messages[0].role !== 'user') messages.shift();
  const aplikace = APLIKACE[req.body.aplikace] || APLIKACE.centrala;
  const obrazovka = String(req.body.obrazovka || '').slice(0, 120);
  let d;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.ai.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: config.ai.model, max_tokens: 1200,
        // návod je dlouhý a stálý – cachuje se; proměnlivý kontext jde až za něj
        system: [
          { type: 'text', text: POKYNY + '\n\n=== NÁVOD K APLIKACI KARTA PACIENTA ===\n\n' + textNapovedy(), cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `Kontext: uživatel používá ${aplikace}${obrazovka ? `, má otevřeno: ${obrazovka}` : ''}.` },
        ],
        messages,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`AI ${r.status}`);
    d = await r.json();
  } catch (e) {
    console.warn('napoveda: AI nedostupná', String(e.message).slice(0, 120));
    return { text: lokalne(dotaz) };
  }
  if (d.stop_reason === 'refusal') return { text: 'Na tohle nemůžu odpovědět. Zkuste dotaz přeformulovat nebo se obraťte na správce organizace.' };
  const text = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  console.log(new Date().toISOString(), 'napoveda', kdoSePta, `${dotaz.slice(0, 60)} → ${text.length} znaků`);
  return { text: text || 'Odpověď se nepodařilo sestavit, zkuste to prosím znovu.' };
}));
