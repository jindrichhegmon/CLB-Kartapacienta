// Otisk podpisového certifikátu aplikace pro QR kód zavedení telefonu (0.11.133) – nastroje/novy-telefon/apk-podpis.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

await import('../nastroje/novy-telefon/apk-podpis.js');
const KPAPK = globalThis.KPAPK;

// test/apk-podpis-v1.apk: prázdný archiv podepsaný jarsignerem zkušebním klíčem (jen podpis v1); otisk certifikátu podle keytool:
const OTISK_V1_HEX = 'e6ec50db4784ef0eb78c62ef30ced2cf40fcf9b76d81127ddb734836f4d5bfa8';
const V1 = new Uint8Array(fs.readFileSync(new URL('./apk-podpis-v1.apk', import.meta.url)));
const b64url = (hex) => Buffer.from(hex, 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const u64 = (n) => Buffer.concat([u32(n), u32(0)]);
const sDelkou = (...casti) => { const t = Buffer.concat(casti); return Buffer.concat([u32(t.length), t]); };

/** blok podpisu v2 / v3 s jedním podepisujícím a jedním certifikátem (podpisy jsou jen výplň – čte se z něj certifikát) */
function blokPodpisu(cert, { v3 = false, klic = Buffer.from('verejny-klic') } = {}) {
  const podepsanaData = Buffer.concat([
    sDelkou(sDelkou(u32(0x0103), sDelkou(Buffer.alloc(32, 7)))),   // otisky obsahu
    sDelkou(sDelkou(cert)),                                        // certifikáty
    ...(v3 ? [u32(24), u32(0x7fffffff)] : []),                     // v3: minSdk, maxSdk uvnitř podepsaných dat
    sDelkou(),                                                     // další atributy
  ]);
  const podepisujici = Buffer.concat([
    sDelkou(podepsanaData),
    ...(v3 ? [u32(24), u32(0x7fffffff)] : []),
    sDelkou(sDelkou(u32(0x0103), sDelkou(Buffer.alloc(64, 9)))),   // podpisy
    sDelkou(klic),
  ]);
  return sDelkou(sDelkou(podepisujici));
}

/** vloží do archivu „APK Signing Block“ před centrální adresář a opraví odkaz na něj v konci ZIPu */
function sBlokem(zip, dvojice) {
  const b = Buffer.from(zip);
  let eocd = b.length - 22; while (b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const cd = b.readUInt32LE(eocd + 16);
  const pary = Buffer.concat(dvojice.map(([id, hodnota]) => Buffer.concat([u64(hodnota.length + 4), u32(id), hodnota])));
  const velikost = pary.length + 8 + 16;
  const blok = Buffer.concat([u64(velikost), pary, u64(velikost), Buffer.from('APK Sig Block 42')]);
  const ven = Buffer.concat([b.subarray(0, cd), blok, b.subarray(cd)]);
  ven.writeUInt32LE(cd + blok.length, eocd + blok.length + 16);
  return new Uint8Array(ven);
}
const sha = (b) => createHash('sha256').update(b).digest('hex');
const CERT_A = Buffer.from([0x30, 0x06, 0x02, 0x01, 0x05, 0x02, 0x01, 0x07]);
const CERT_B = Buffer.from([0x30, 0x03, 0x02, 0x01, 0x09]);

test('otisk podpisu aplikace (0.11.133): starší podpis v1 (META-INF/*.RSA) dá stejný otisk jako keytool', async () => {
  const o = await KPAPK.otiskPodpisu(V1);
  assert.equal(o.schema, 'v1');
  assert.equal(o.otiskHex.replaceAll(':', '').toLowerCase(), OTISK_V1_HEX);
  assert.equal(o.otisk, b64url(OTISK_V1_HEX));
  assert.doesNotMatch(o.otisk, /[+/=]/, 'do QR kódu patří base64url bez doplnění');
  const c = await KPAPK.certifikat(V1);
  assert.equal(sha(c.certifikat), OTISK_V1_HEX);
});

test('otisk podpisu aplikace: blok podpisu v2 má přednost před v1 i v3, v3 se čte, když v2 chybí', async () => {
  const v2 = await KPAPK.otiskPodpisu(sBlokem(V1, [[0x7109871a, blokPodpisu(CERT_A)]]));
  assert.deepEqual([v2.schema, v2.otisk], ['v2', b64url(sha(CERT_A))]);

  const oba = await KPAPK.otiskPodpisu(sBlokem(V1, [[0xf05368c0, blokPodpisu(CERT_B, { v3: true })], [0x42726577, Buffer.alloc(40)], [0x7109871a, blokPodpisu(CERT_A)]]));
  assert.deepEqual([oba.schema, oba.otisk], ['v2', b64url(sha(CERT_A))], 'pořadí bloků ani výplň (zarovnání) nesmí vadit');

  const v3 = await KPAPK.certifikat(sBlokem(V1, [[0xf05368c0, blokPodpisu(CERT_B, { v3: true })]]));
  assert.equal(v3.schema, 'v3');
  assert.equal(sha(v3.certifikat), sha(CERT_B));
  assert.equal(Buffer.from(v3.verejnyKlic).toString(), 'verejny-klic');

  // součet souboru (původní způsob) se s každým sestavením mění, otisk podpisu ne
  const jine = sBlokem(V1, [[0x7109871a, blokPodpisu(CERT_A)], [0x42726577, Buffer.alloc(8)]]);
  assert.equal((await KPAPK.otiskPodpisu(jine)).otisk, v2.otisk);
  assert.notEqual(await KPAPK.soucetSouboru(jine), await KPAPK.soucetSouboru(sBlokem(V1, [[0x7109871a, blokPodpisu(CERT_A)]])));
  assert.equal(await KPAPK.soucetSouboru(V1), b64url(sha(V1)));
});

test('otisk podpisu aplikace: nepodepsaný nebo cizí soubor skončí srozumitelnou chybou', async () => {
  await assert.rejects(KPAPK.otiskPodpisu(new Uint8Array(Buffer.from('toto není aplikace'.repeat(20)))), /není aplikace/);
  // prázdný ZIP bez podpisu (jen konec ZIPu, doplněný na minimální délku komentářem)
  const prazdny = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(16), Buffer.from([100, 0]), Buffer.alloc(100, 0x20)]);
  await assert.rejects(KPAPK.otiskPodpisu(new Uint8Array(prazdny)), /není podepsaná/);
});

test('QR kód zavedení (android/provisioning-qr.mjs): výchozí je otisk podpisu, --soubor vrátí součet souboru – nikdy obojí', () => {
  const skript = new URL('../android/provisioning-qr.mjs', import.meta.url).pathname;
  const slozka = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-qr-'));
  const vystup = path.join(slozka, 'qr.html');   // ne android/provisioning-qr.html – ten může nést heslo Wi-Fi
  const apk = new URL('./apk-podpis-v1.apk', import.meta.url).pathname;
  const dataQr = () => { const m = fs.readFileSync(vystup, 'utf8').match(/<pre>([\s\S]*?)<\/pre>/); assert.ok(m, 've výstupu chybí data QR kódu'); return JSON.parse(m[1]); };
  try {
    execFileSync(process.execPath, [skript, apk, '--vystup', vystup], { stdio: 'pipe' });
    let d = dataQr();
    assert.equal(d['android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM'], b64url(OTISK_V1_HEX));
    assert.equal('android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM' in d, false);
    execFileSync(process.execPath, [skript, '--vystup', vystup, '--soubor', apk], { stdio: 'pipe' });
    d = dataQr();
    assert.equal(d['android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM'], b64url(sha(V1)));
    assert.equal('android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM' in d, false);
  } finally {
    fs.rmSync(slozka, { recursive: true, force: true });
  }
});
