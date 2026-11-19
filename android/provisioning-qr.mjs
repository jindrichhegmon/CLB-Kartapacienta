#!/usr/bin/env node
/**
 * QR kód pro nastavení telefonu při prvním zapnutí (Android Enterprise, „QR provisioning“).
 * Telefon po továrním resetu: na uvítací obrazovce 6× klepnout → načte QR → stáhne APK z HTTPS adresy,
 * nainstaluje ho jako správce zařízení a spustí kiosk. Žádný kabel, žádný Google účet.
 *
 *   node android/provisioning-qr.mjs <cesta k APK> [--url https://…/android/kartapacienta.apk] [--wifi NÁZEV_SÍTĚ] [--soubor]
 *
 * - APK musí být na HTTPS adrese, kterou telefon stáhne: výchozí je živý server, kam ho nahraje ./deploy/vps-deploy.sh
 *   z public/android/kartapacienta.apk (soubor není v gitu, zkopírujte tam app-release.apk).
 * - Od 0.11.133 nese QR kód otisk podpisového certifikátu aplikace: platí i pro každou další verzi podepsanou stejným
 *   klíčem (release klíč .jks), vytištěný kód tedy není potřeba po novém sestavení měnit. S --soubor se použije původní
 *   kontrolní součet souboru – takový kód platí jen pro tento jeden soubor.
 * - --vystup <soubor> zapíše stránku jinam než do android/provisioning-qr.html.
 * - S --wifi se telefon k Wi-Fi připojí sám; heslo se zadává skrytě, do příkazové řádky ani do gitu nepatří.
 *   QR pak heslo obsahuje – vytištěný kód uložte jako heslo.
 *
 * Výstup: android/provisioning-qr.html (není v gitu) – otevřít v prohlížeči, QR naskenovat novým telefonem.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const SLOZKA = path.dirname(fileURLToPath(import.meta.url));
const ADMIN = 'cz.centrumlb.kartapacienta/.AdminReceiver';
const VYCHOZI_URL = 'https://kartapacienta.95-216-201-2.sslip.io/android/kartapacienta.apk';

const args = process.argv.slice(2);
const hodnota = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const S_HODNOTOU = ['--url', '--wifi', '--vystup'];
const apk = args.find((a, i) => !a.startsWith('--') && !S_HODNOTOU.includes(args[i - 1]));
if (!apk || !fs.existsSync(apk)) {
  console.error('Použití: node android/provisioning-qr.mjs <cesta k APK> [--url https://…/kartapacienta.apk] [--wifi NÁZEV_SÍTĚ] [--soubor]');
  process.exit(1);
}
const url = hodnota('--url') || VYCHOZI_URL;
const wifi = hodnota('--wifi');

const heslo = wifi ? await new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  process.stdout.write(`Heslo Wi-Fi „${wifi}“ (skrytě, Enter = bez hesla): `);
  rl._writeToOutput = () => {};   // nezobrazovat zadávané znaky
  rl.question('', (h) => { rl.close(); process.stdout.write('\n'); res(h); });
}) : '';

// Android chce SHA-256 souboru APK v base64 bez doplnění, s URL-bezpečnou abecedou.
const soucet = createHash('sha256').update(fs.readFileSync(apk)).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// 0.11.133: výchozí je otisk podpisového certifikátu (QR kód platí i pro další verze podepsané stejným klíčem);
// --soubor vrátí původní způsob (součet souboru – platí jen pro tento soubor)
await import(new URL('../nastroje/novy-telefon/apk-podpis.js', import.meta.url));
let otisk = null;
if (!process.argv.includes('--soubor')) {
  try { otisk = await globalThis.KPAPK.otiskPodpisu(new Uint8Array(fs.readFileSync(apk))); }
  catch (e) { console.error(`Podpis aplikace se nepodařilo přečíst (${e.message}) – použiji součet souboru.`); }
}
console.log(otisk ? `QR kód platí pro všechny verze aplikace podepsané tímto klíčem (podpis ${otisk.schema}, SHA-256 ${otisk.otiskHex}).` : 'QR kód platí jen pro tento soubor aplikace (součet souboru).');

const data = {
  'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': ADMIN,
  'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': url,
  // jen jeden z obou údajů: se součtem souboru by Android otisk podpisu ignoroval
  ...(otisk ? { 'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': otisk.otisk } : { 'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM': soucet }),
  'android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED': true,   // telefonní aplikace zůstane (volání z karty)
  'android.app.extra.PROVISIONING_SENSORS_PERMISSION_GRANT_OPT_OUT': true, // Android 12+: správce smí sám přidělit fotoaparát a mikrofon (QR čtečka, videohovor)
  // Aligator S6600 (Android 14): systémový průvodce padá při vykreslování textu informačních obrazovek „Nastavování zařízení“
  // (MissingFormatArgumentException '%1$s' v ManagedProvisioning) a zavedení se vrací na skener – obrazovky se proto přeskočí.
  'android.app.extra.PROVISIONING_SKIP_EDUCATION_SCREENS': true,
  // Jazyk, časové pásmo ani příznak šifrování se do kódu nedávají (od 0.1.18): průvodce je nastavuje přesně ve chvíli, kdy se
  // na Aligatoru S6600 (Android 14) zavedení vracelo na začátek; jazyk a pásmo si telefon vezme z průvodce, šifrování je výchozí.
};
if (wifi) {
  data['android.app.extra.PROVISIONING_WIFI_SSID'] = wifi;
  if (heslo) { data['android.app.extra.PROVISIONING_WIFI_PASSWORD'] = heslo; data['android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE'] = 'WPA'; }
  else data['android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE'] = 'NONE';
}
const json = JSON.stringify(data);
const vystup = hodnota('--vystup') || path.join(SLOZKA, 'provisioning-qr.html');

const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>QR pro nastavení telefonu – Karta pacienta</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#25384a}h1{font-size:20px}#qr{margin:16px 0}#qr img{width:420px;height:420px;image-rendering:pixelated}
ol li{margin:6px 0}code{background:#eef3f8;padding:1px 5px;border-radius:4px}.m{color:#6b7f94;font-size:13px}@media print{.noprint{display:none}}</style></head><body>
<h1>Karta pacienta – nastavení telefonu QR kódem</h1>
<div id="qr"></div>
<ol>
<li>Telefon po <b>továrním resetu</b> zapněte; na první (uvítací) obrazovce <b>6× rychle klepněte</b> kamkoli.</li>
<li>Telefon spustí čtečku QR${wifi ? ` a připojí se k Wi-Fi „${wifi.replace(/</g, '&lt;')}“` : ' – nejdřív ho připojte k Wi-Fi'} – naskenujte tento kód.</li>
<li>Stáhne se APK (${(fs.statSync(apk).size / 1048576).toFixed(1)} MB), telefon se zašifruje a nastaví; trvá to několik minut. Pak naběhne rovnou Karta – spárujte ji kódem z centrální aplikace.</li>
</ol>
<p class="m">APK: <code>${url}</code><br>${otisk ? `Platí pro všechny verze aplikace podepsané stejným klíčem · otisk podpisu: <code>${otisk.otisk}</code>` : `Platí jen pro tento soubor · SHA-256 (base64url): <code>${soucet}</code>`}<br>Vygenerováno ${new Date().toLocaleString('cs-CZ')} ze souboru <code>${path.basename(apk)}</code>.${wifi && heslo ? ' <b>Kód obsahuje heslo Wi-Fi – zacházejte s ním jako s heslem.</b>' : ''}</p>
<details class="noprint"><summary>Data v QR kódu</summary><pre>${JSON.stringify(data, null, 2).replace(/</g, '&lt;')}</pre></details>
<script src="${path.relative(path.dirname(path.resolve(vystup)), path.join(SLOZKA, '../public/shared/qrcode.js')).split(path.sep).join('/')}"></script>
<script>const qr = qrcode(0, 'L'); qr.addData(${JSON.stringify(json)}); qr.make(); document.getElementById('qr').innerHTML = qr.createImgTag(6, 8);</script>
</body></html>`;
fs.writeFileSync(vystup, html);
console.log(`QR připraven: ${vystup}\nOtevřete ho v prohlížeči (dvojklik) a naskenujte novým telefonem. APK musí být dostupné na ${url}`);
