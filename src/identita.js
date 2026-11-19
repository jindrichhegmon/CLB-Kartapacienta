/**
 * Identita pacienta z hlavičky lékařské zprávy (0.11.129) – čte ji jen server, do AI nejde.
 * Použití: (1) předvyplnění formuláře Nový pacient ze zprávy, (2) anonymizace – co se z hlavičky pozná,
 * to se v textu spolehlivě skryje i u pacienta, který v Kartě ještě není.
 *
 * Zpráva z Medistaru:  „ING. Silvia Charuzová   R.č.: 346231/434   ZP: 111“
 *                      „Trvalá adresa: Bartošová 41, 760 01 Zlín   TEL: 603447327“
 * Propouštěcí zpráva:  „Pacient: Jan NOVÁK, nar. 3. 5. 1944“
 */
const VELKE = 'A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ';
const TITUL = /^(?:ing|mudr|mddr|mvdr|judr|rndr|phdr|paeddr|thdr|pharmdr|thlic|mgr|mga|bc|bca|doc|prof|dr|dis|ph\.?d|csc|drsc|mba|llm|arch|pan|paní|pani|sl)\.?,?$/i;
const hezky = (s) => (s === s.toUpperCase() && s.length > 1 ? s.charAt(0) + s.slice(1).toLowerCase() : s);

/** Rodné číslo → { rc: '346231/434', datumNarozeni: '1934-12-31', rok, pohlavi } nebo null. */
export function zRodnehoCisla(v) {
  const c = String(v || '').replace(/\D/g, '');
  if (c.length !== 9 && c.length !== 10) return null;
  const yy = Number(c.slice(0, 2)); let mm = Number(c.slice(2, 4)); const dd = Number(c.slice(4, 6));
  const zena = mm > 50; if (zena) mm -= 50;
  if (mm > 20) mm -= 20;   // rodná čísla z řady +20 (od 2004)
  const rok = c.length === 9 ? 1900 + yy : (yy >= 54 ? 1900 + yy : 2000 + yy);   // 9 číslic = narození před 1954
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(Date.UTC(rok, mm - 1, dd));
  if (d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  return { rc: `${c.slice(0, 6)}/${c.slice(6)}`, datumNarozeni: `${rok}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`, rok, pohlavi: zena ? 'žena' : 'muž' };
}

/** „ING. Silvia Charuzová“ / „NOVÁK Jan“ / „Charuzova Silvia“ → { jmeno, prijmeni }; poradi 'pj' = příjmení první. */
export function rozdelJmeno(t, poradi = 'jp') {
  const slova = String(t || '').replace(/[,;]/g, ' ').split(/\s+/).map((s) => s.trim()).filter((s) => s && !TITUL.test(s) && new RegExp(`^[${VELKE}]`).test(s));
  if (slova.length < 2) return slova.length ? { jmeno: '', prijmeni: hezky(slova[0]) } : {};
  // příjmení psané celé velkými písmeny (NOVÁK Jan / Jan NOVÁK), jinak podle pořadí
  const velka = slova.filter((s) => s.length > 1 && s === s.toUpperCase());
  const i = velka.length === 1 ? slova.indexOf(velka[0]) : (poradi === 'pj' ? 0 : slova.length - 1);
  const prijmeni = slova[i];
  return { jmeno: slova.filter((_, k) => k !== i).map(hezky).join(' '), prijmeni: hezky(prijmeni) };
}

export function identitaZeZpravy(text) {
  const t = String(text || ''), radky = t.split('\n').map((l) => l.trim());
  const o = {};
  // 1) řádek s rodným číslem (hlavička Medistaru)
  const reRc = new RegExp(`^(.{0,80}?)\\s*R\\.?\\s?[čcČC]\\.?\\s*:\\s*(\\d{6})\\s?\\/?\\s?(\\d{3,4})(?!\\d)(.*)$`);
  const i = radky.findIndex((l) => reRc.test(l));
  if (i >= 0) {
    const m = radky[i].match(reRc);
    Object.assign(o, zRodnehoCisla(m[2] + m[3]) || {});
    Object.assign(o, rozdelJmeno(m[1]));
    const blok = radky.slice(i, i + 3).join('\n');
    const zp = blok.match(/\bZP\s*:\s*(\d{3})\b/); if (zp) o.pojistovna = zp[1];
    const tel = blok.match(/\bTEL\.?\s*:\s*((?:\+|00)?[\d ]{9,17})/i); if (tel && tel[1].replace(/\D/g, '').length >= 9) o.telefon = tel[1].trim();
    const adr = blok.match(/(?:Trvalá adresa|Adresa|Bydliště)\s*:\s*([^\n]*?)(?:\s+TEL\.?\s*:.*)?$/im); if (adr && adr[1].trim().length >= 4) o.adresa = adr[1].trim().replace(/[.,;]$/, '');
  }
  // 2) pole formuláře ve zprávě (Medistar – Základní informace o pacientovi)
  if (!o.rc) { const m = t.match(/Číslo pojištěnce[^:\n]{0,12}:\s*(\d{6})\s?\/?\s?(\d{3,4})(?!\d)/i); if (m) Object.assign(o, zRodnehoCisla(m[1] + m[2]) || {}); }
  if (!o.prijmeni) { const m = t.match(/Jméno a příjmení pacient[ak][^:\n]{0,4}:\s*([^\n]+)/i); if (m) Object.assign(o, rozdelJmeno(m[1])); }
  // 3) propouštěcí zpráva: „Pacient: Jan NOVÁK, nar. 3. 5. 1944“ (jméno příjmení)
  const h = t.match(/Pacient(?:ka)?\s*:?\s*([^,\n]+?)\s*,\s*nar\.\s*(?:(\d{1,2})\.\s?(\d{1,2})\.\s?)?(\d{4})/i);
  if (h) {
    if (!o.prijmeni) Object.assign(o, rozdelJmeno(h[1]));
    if (!o.rok) o.rok = Number(h[4]);
    if (!o.datumNarozeni && h[2]) o.datumNarozeni = `${h[4]}-${h[3].padStart(2, '0')}-${h[2].padStart(2, '0')}`;
  }
  // 4) Medistar v textu: „Pacient: Charuzova Silvia“ (příjmení jméno)
  if (!o.prijmeni) { const m = t.match(new RegExp(`^Pacient(?:ka)?\\s*:\\s*([${VELKE}][^,\\n]{2,60}?)\\s*(?:,|$)`, 'm')); if (m) Object.assign(o, rozdelJmeno(m[1], 'pj')); }
  if (o.prijmeni) o.jmenoCele = [o.jmeno, o.prijmeni].filter(Boolean).join(' ');
  return o;
}
