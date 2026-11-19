/* Otisk podpisového certifikátu aplikace (APK) – pro QR kód zavedení telefonu (0.11.133).
 *
 * QR kód může nést buď kontrolní součet celého souboru (PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM – platí jen pro jeden
 * konkrétní soubor), nebo otisk certifikátu, kterým je aplikace podepsaná (PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM).
 * Otisk certifikátu se s novou verzí aplikace nemění, dokud se podepisuje stejným klíčem – vytištěný QR kód tak platí dál.
 *
 * Android porovnává SHA-256 prvního podpisového certifikátu (DER) zakódované jako base64url bez „=“.
 * Certifikát se čte z bloku „APK Signing Block“ (podpis v2, případně v3 / v3.1), u starých aplikací z META-INF/*.RSA (v1).
 * Jeden soubor pro stránku v prohlížeči i pro Node (android/provisioning-qr.mjs, testy): globalThis.KPAPK.
 */
(function (g) {
  'use strict';
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const u64 = (b, o) => { if (u32(b, o + 4) !== 0) throw new Error('příliš velký blok'); return u32(b, o); };
  const MAGIE = 'APK Sig Block 42';
  const V2 = 0x7109871a, V3 = 0xf05368c0, V31 = 0x1b93ad61;

  /** konec ZIPu: { cdOffset, cdSize, polozek } */
  function konecZipu(b) {
    for (let i = b.length - 22, min = Math.max(0, b.length - 22 - 65535); i >= min; i--) {
      if (u32(b, i) === 0x06054b50) return { polozek: u16(b, i + 10), cdSize: u32(b, i + 12), cdOffset: u32(b, i + 16) };
    }
    throw new Error('soubor není aplikace pro Android (chybí konec ZIPu)');
  }

  /** bloky podpisu v2 / v3 → Map(id → Uint8Array) nebo null, když aplikace blok nemá */
  function blokyPodpisu(b, cdOffset) {
    if (cdOffset < 32) return null;
    let magie = ''; for (let i = 0; i < 16; i++) magie += String.fromCharCode(b[cdOffset - 16 + i]);
    if (magie !== MAGIE) return null;
    const velikost = u64(b, cdOffset - 24), zacatek = cdOffset - velikost - 8;
    if (zacatek < 0 || u64(b, zacatek) !== velikost) throw new Error('poškozený blok podpisu');
    const m = new Map();
    for (let o = zacatek + 8, konec = cdOffset - 24; o + 12 <= konec;) {
      const d = u64(b, o), id = u32(b, o + 8);
      if (d < 4 || o + 8 + d > konec) throw new Error('poškozený blok podpisu');
      m.set(id, b.subarray(o + 12, o + 8 + d));
      o += 8 + d;
    }
    return m;
  }

  /** první podepisující v bloku v2 / v3: { certifikat, verejnyKlic } */
  function prvniPodpis(blok, v3) {
    let o = 4;                                   // délka seznamu podepisujících
    const konecPodpisu = o + 4 + u32(blok, o); o += 4;   // délka prvního podepisujícího
    const podepsanaData = o + 4; const konecDat = podepsanaData + u32(blok, o);
    let p = podepsanaData;
    p += 4 + u32(blok, p);                       // otisky obsahu
    const certLen = u32(blok, p + 4);            // seznam certifikátů → první certifikát
    const certifikat = blok.slice(p + 8, p + 8 + certLen);
    let q = konecDat; if (v3) q += 8;            // v3: minSdk, maxSdk
    q += 4 + u32(blok, q);                       // podpisy
    const klicLen = u32(blok, q);
    const verejnyKlic = q + 4 + klicLen <= konecPodpisu ? blok.slice(q + 4, q + 4 + klicLen) : null;
    if (!certLen || certifikat[0] !== 0x30) throw new Error('v podpisu aplikace není certifikát');
    return { certifikat, verejnyKlic };
  }

  /* ---- podpis v1 (META-INF/*.RSA) ---- */
  async function rozbal(data) {
    if (typeof DecompressionStream === 'undefined') throw new Error('tento prohlížeč neumí rozbalit starší podpis aplikace');
    const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function souborPodpisuV1(b, z) {
    for (let o = z.cdOffset, n = 0; n < z.polozek && o + 46 <= b.length; n++) {
      if (u32(b, o) !== 0x02014b50) break;
      const metoda = u16(b, o + 10), zabaleno = u32(b, o + 20), jmenoLen = u16(b, o + 28), extraLen = u16(b, o + 30), komLen = u16(b, o + 32), lok = u32(b, o + 42);
      let jmeno = ''; for (let i = 0; i < jmenoLen; i++) jmeno += String.fromCharCode(b[o + 46 + i]);
      if (/^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(jmeno)) {
        const data = lok + 30 + u16(b, lok + 26) + u16(b, lok + 28);
        const telo = b.subarray(data, data + zabaleno);
        return metoda === 0 ? telo : rozbal(telo);
      }
      o += 46 + jmenoLen + extraLen + komLen;
    }
    return null;
  }
  /** jedna položka DER: { tag, obsah: [od, do), konec } */
  function der(b, o) {
    const tag = b[o]; let d = b[o + 1], p = o + 2;
    if (d & 0x80) { const n = d & 0x7f; d = 0; for (let i = 0; i < n; i++) d = d * 256 + b[p++]; }
    return { tag, od: p, konec: p + d };
  }
  /** PKCS#7 SignedData → první certifikát (celá položka DER) */
  function certifikatZPkcs7(b) {
    const obal = der(b, 0); let o = obal.od;
    o = der(b, o).konec;                         // OID signedData
    const sd = der(b, der(b, o).od);             // [0] → SEQUENCE SignedData
    for (let p = sd.od; p < sd.konec;) {
      const x = der(b, p);
      if (x.tag === 0xa0) { const c = der(b, x.od); return b.slice(x.od, c.konec); }   // certificates [0] → první
      p = x.konec;
    }
    throw new Error('v podpisu aplikace není certifikát');
  }

  /** Podpisový certifikát aplikace: { certifikat: Uint8Array (DER), schema: 'v2' | 'v3' | 'v3.1' | 'v1', verejnyKlic } */
  async function certifikat(bajty) {
    const b = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
    if (b.length < 100 || b[0] !== 0x50 || b[1] !== 0x4b) throw new Error('soubor není aplikace pro Android');
    const z = konecZipu(b), bloky = blokyPodpisu(b, z.cdOffset);
    if (bloky) {
      // v2 má přednost: po výměně klíče (v3) vrací Android jako první podpis ten původní, který nese blok v2
      for (const [id, schema] of [[V2, 'v2'], [V3, 'v3'], [V31, 'v3.1']]) {
        if (bloky.has(id)) return { ...prvniPodpis(bloky.get(id), schema !== 'v2'), schema };
      }
    }
    const v1 = await souborPodpisuV1(b, z);
    if (v1) return { certifikat: certifikatZPkcs7(v1), schema: 'v1', verejnyKlic: null };
    throw new Error('aplikace není podepsaná');
  }

  const base64url = (h) => { let s = ''; h.forEach((x) => (s += String.fromCharCode(x))); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest('SHA-256', b));
  const hex = (h) => [...h].map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join(':');

  /** { otisk: base64url SHA-256 certifikátu (do QR kódu), otiskHex: 'AB:CD:…' (jak ho píše keytool), schema } */
  async function otiskPodpisu(bajty) {
    const c = await certifikat(bajty), h = await sha256(c.certifikat);
    return { otisk: base64url(h), otiskHex: hex(h), schema: c.schema };
  }
  /** kontrolní součet celého souboru (původní způsob – platí jen pro tento soubor) */
  const soucetSouboru = async (bajty) => base64url(await sha256(bajty));

  g.KPAPK = { certifikat, otiskPodpisu, soucetSouboru, base64url };
})(typeof globalThis !== 'undefined' ? globalThis : window);
