/**
 * Anonymizační brána: AI nikdy nedostane údaje, ze kterých by šlo pacienta identifikovat.
 *
 *   const a = anonymizuj(text, { jmeno, prijmeni, rc, datumNarozeni, adresa, telefony, osoby });
 *   a.text      – text se zástupnými značkami ([PACIENT], [OSOBA_1], [TELEFON_1], [DATUM_1] …)
 *   a.mapa      – značka → původní hodnota (zůstává jen na serveru, do AI nejde)
 *   a.blokovano – po anonymizaci zůstalo něco, co vypadá jako identifikátor → dotaz se NESMÍ odeslat
 *   obnov(hodnota, a.mapa) – vrátí značky zpět na původní hodnoty (v odpovědi AI)
 *
 * Postup: 1) známé identifikátory pacienta z databáze (jméno ve všech pádech, RČ, datum narození,
 * adresa, telefony, jména kontaktů), 2) vzory (RČ, data, telefony, e-maily, PSČ, IČP, tituly + jména,
 * příbuzní + jméno, „Pacient: …“), 3) kontrola výsledku. Rok narození se převede na věkové rozmezí.
 */

const VELKE = 'A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ';
const MALE = 'a-záčďéěíňóřšťúůýž';
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Regex pro jméno ve všech pádech: kmen (bez koncové samohlásky) + až 4 písmena koncovky. */
function vzorJmena(slovo) {
  const w = String(slovo || '').trim();
  if (w.length < 3) return null;
  let kmen = w.replace(/(ová|á|a|e|ě|o|y|i|í|u)$/i, '');
  if (kmen.length < 3) kmen = w;
  // pohyblivé e (Hrubeš → Hrubše, Marek → Marka): povolit vypadnutí posledního e
  const k = esc(kmen).replace(/e(\p{L})$/u, 'e?$1');
  return new RegExp(`(?<![\\p{L}])${k}[\\p{L}]{0,4}(?![\\p{L}])`, 'giu');
}

function vekoveRozmezi(rok, dnes = new Date()) {
  const v = dnes.getFullYear() - Number(rok);
  if (!Number.isFinite(v) || v < 0 || v > 120) return 'věk neuveden';
  const od = Math.floor(v / 5) * 5;
  return `věk ${od}–${od + 4} let`;
}

const VZORY = [
  // rodné číslo / číslo pojištěnce
  { typ: 'RC', re: /(?<!\d)\d{6}\s?\/?\s?\d{3,4}(?!\d)/g },
  // e-mail
  { typ: 'EMAIL', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  // telefon (CZ/SK, s předvolbou i bez)
  { typ: 'TELEFON', re: /(?:(?:\+|00)?42[01][\s-]?)?(?<!\d)[1-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}(?!\d)/g },
  // datum 9. 10. 2026, 9.10.26, 2026-10-09
  { typ: 'DATUM', re: /(?<!\d)(?:\d{1,2}\.\s?\d{1,2}\.\s?(?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2})(?!\d)/g },
  // IČP / IČO (8 číslic)
  { typ: 'ICP', re: /(?<!\d)\d{8}(?!\d)/g },
  // PSČ + obec (nahrazuje se jen ve spojení „PSČ Obec“, ne čísla dávek)
  { typ: 'ADRESA', re: new RegExp(`(?<!\\d)\\d{3}\\s\\d{2}\\s+[${VELKE}][${MALE}]+(?:[\\s-][${VELKE}]?[${MALE}]+)*`, 'g') },
  // ulice s číslem popisným
  { typ: 'ADRESA', re: new RegExp(`(?:ul\\.|ulice|bytem|bydliště:?|adresa:?)\\s*[^,\\n\\[\\]]{2,60}\\d+[a-z]?(?:\\/\\d+)?`, 'gi') },
];

// titul + jméno lékaře / osoby
const RE_TITUL = new RegExp(`\\b((?:MUDr|MDDr|Bc|Mgr|PhDr|Ing|prim|doc|prof|as)\\.\\s*|[Ss]estr[ayou]\\s+)((?:[${VELKE}][${MALE}]+\\s?){1,2})`, 'g');
// příbuzný + jméno
const RE_PRIBUZNY = new RegExp(`(?<![\\p{L}])((?:[Ss]yn[aeiu]?|[Dd]cer[aeyou]|[Mm]anžel(?:ka|ky|ce|ovi)?|[Vv]nu(?:k|čka)|[Bb]ratr|[Oo]patrovní(?:k|ce)|[Ss]nacha|[Zz]eť|[Dd]ruh|[Dd]ružka|[Pp]artner(?:ka)?|[Tt]chán|[Tt]chyně|[Ss]ynovec|[Nn]eteř)\\s+)((?:[${VELKE}][${MALE}]+\\s?){1,2})`, 'gu');
// „Pacient: Jan NOVÁK, nar. 1944“ / „Pacientka …“
const RE_PACIENT = new RegExp(`(Pacient(?:ka)?\\s*:?\\s*)((?:[${VELKE}][${VELKE}${MALE}]+\\s?){1,3})`, 'g');
// rok narození
const RE_NAR = /(nar\.|narozen[aá]?|r\.\s?nar\.)\s*(\d{4})/gi;

export function anonymizuj(text, znamo = {}) {
  let t = String(text || '');
  const mapa = {};
  const citac = {};
  const znacka = (typ, hodnota) => {
    const h = String(hodnota).trim();
    for (const [k, v] of Object.entries(mapa)) if (v === h && k.startsWith(`[${typ}`)) return k;
    citac[typ] = (citac[typ] || 0) + 1;
    const k = typ === 'PACIENT' ? '[PACIENT]' : `[${typ}_${citac[typ]}]`;
    if (typ === 'PACIENT' && mapa[k] && mapa[k] !== h) { mapa[`[PACIENT_${citac[typ]}]`] = h; return `[PACIENT_${citac[typ]}]`; }
    mapa[k] = h;
    return k;
  };
  let nahrad = 0;
  const nahradRe = (re, typ, skupina) => {
    t = t.replace(re, (...m) => {
      if (/[[\]]/.test(m[0])) return m[0]; // nikdy nenahrazovat uvnitř už vložené značky
      nahrad++;
      if (skupina == null) return znacka(typ, m[0]);
      const pred = m.slice(1, skupina).join('');
      return pred + znacka(typ, m[skupina]) + (/\s$/.test(m[skupina]) ? ' ' : '');
    });
  };

  // 0) e-maily jako první (obsahují jména, která by se jinak nahradila uvnitř adresy)
  nahradRe(/[\w.+-]+@[\w-]+\.[\w.-]+/g, 'EMAIL');
  // 1) známé identifikátory pacienta
  if (znamo.rc) { const rc = String(znamo.rc).replace(/\D/g, ''); if (rc.length >= 9) nahradRe(new RegExp(`${rc.slice(0, 6)}\\s?\\/?\\s?${rc.slice(6)}`, 'g'), 'RC'); }
  if (znamo.datumNarozeni) {
    const d = new Date(znamo.datumNarozeni);
    if (!isNaN(d)) {
      const D = d.getDate(), M = d.getMonth() + 1, Y = d.getFullYear();
      nahradRe(new RegExp(`(?<!\\d)0?${D}\\.\\s?0?${M}\\.\\s?(?:${Y}|${String(Y).slice(2)})(?!\\d)`, 'g'), 'DATUM_NAROZENI');
    }
  }
  if (znamo.adresa) for (const cast of String(znamo.adresa).split(',').map((s) => s.trim()).filter((s) => s.length >= 4)) nahradRe(new RegExp(esc(cast), 'gi'), 'ADRESA');
  for (const tel of znamo.telefony || []) {
    const d = String(tel).replace(/\D/g, '').slice(-9);
    if (d.length === 9) nahradRe(new RegExp(`(?:\\+?420\\s?)?${d.slice(0, 3)}\\s?${d.slice(3, 6)}\\s?${d.slice(6)}`, 'g'), 'TELEFON');
  }
  const jmenaPacienta = [znamo.prijmeni, znamo.jmeno].filter(Boolean);
  // celé jméno v obou pořadích (jakékoli pády), pak samotné příjmení; samotné křestní jméno ne –
  // je časté (lékař „Jana“ ≠ pacient „Jan“); kontrola na konci ho přesto hlídá ve spojení s příjmením
  if (znamo.prijmeni) {
    const P = vzorJmena(znamo.prijmeni), J = znamo.jmeno ? vzorJmena(znamo.jmeno) : null;
    if (P && J) {
      nahradRe(new RegExp(`${J.source}\\s+${P.source}`, 'giu'), 'PACIENT');
      nahradRe(new RegExp(`${P.source}\\s+${J.source}`, 'giu'), 'PACIENT');
    }
    if (P) nahradRe(P, 'PACIENT');
  }
  for (const o of znamo.osoby || []) {
    for (const slovo of String(o).split(/[\s,]+/).filter((s) => s.length >= 4 && /^\p{Lu}/u.test(s))) {
      const re = vzorJmena(slovo); if (re) nahradRe(re, 'OSOBA');
    }
  }

  // 2) vzory
  nahradRe(RE_PACIENT, 'PACIENT', 2);
  t = t.replace(RE_NAR, (_, a, rok) => { nahrad++; return `${a} [${vekoveRozmezi(rok)}]`; });
  nahradRe(RE_TITUL, 'LEKAR', 2);
  nahradRe(RE_PRIBUZNY, 'OSOBA', 2);
  for (const v of VZORY) nahradRe(v.re, v.typ);

  // 3) kontrola: nic, co vypadá jako RČ, telefon, e-mail ani známé jméno
  const zbytky = [];
  const kontrola = [/(?<!\d)\d{6}\s?\/\s?\d{3,4}(?!\d)/, /[\w.+-]+@[\w-]+\.[\w.-]+/, /(?<!\d)[1-9]\d{2}\s?\d{3}\s?\d{3}(?!\d)/];
  for (const re of kontrola) if (re.test(t)) zbytky.push(re.source);
  for (const j of jmenaPacienta.slice(0, 1)) {
    if (String(j).length >= 3 && new RegExp(`(?<![\\p{L}])${esc(bezDiakritiky(j))}`, 'iu').test(bezDiakritiky(t))) zbytky.push('jméno pacienta');
  }
  return { text: t, mapa, pocetNahrad: nahrad, blokovano: zbytky.length > 0, zbytky };
}

/** Vrátí značky v řetězci / objektu / poli zpět na původní hodnoty. */
export function obnov(hodnota, mapa) {
  if (typeof hodnota === 'string') return hodnota.replace(/\[[A-Z_]+(?:_\d+)?\]/g, (z) => (z in mapa ? mapa[z] : z));
  if (Array.isArray(hodnota)) return hodnota.map((x) => obnov(x, mapa));
  if (hodnota && typeof hodnota === 'object') return Object.fromEntries(Object.entries(hodnota).map(([k, v]) => [k, obnov(v, mapa)]));
  return hodnota;
}
