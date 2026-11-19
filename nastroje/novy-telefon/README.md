# Nový telefon – Karta pacienta (stránka na Netlify)

Statická stránka pro přípravu telefonu u lůžka bez skriptů, z Macu i z Windows (Chrome / Edge):

- **Bez kabelu – QR kód:** stránka stáhne aplikaci ze serveru Karty (`/android/kartapacienta.apk`, CORS od 0.11.100),
  přečte z ní otisk podpisového certifikátu (`apk-podpis.js`) a vytvoří QR kód pro zavedení (stejná data jako
  `android/provisioning-qr.mjs`). Od 0.11.133 QR kód nese **otisk podpisu** (`PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM`),
  ne součet souboru – platí tedy i pro další verze aplikace podepsané stejným klíčem a vytištěný kód není potřeba měnit.
  Volba *Platnost QR kódu → jen pro tento soubor* vrátí původní součet souboru (`…PACKAGE_CHECKSUM`); v kódu smí být jen jeden z nich.
  Heslo Wi-Fi se nikam neposílá ani neukládá – je jen v QR kódu na obrazovce.
- **Kabelem z prohlížeče:** WebUSB (knihovna Tango / ya-webadb, `kp-adb.js`) – instalace aplikace, správce zařízení
  (kiosk) a spuštění Karty; stejné kroky jako `android/nahrat-telefon.sh`.

Soubory: `index.html`, `apk-podpis.js` (otisk podpisu; používá ho i `android/provisioning-qr.mjs` a `test/apk-podpis.test.js`),
`kp-adb.js` (sestaveno ze `zdroj/kp-adb.vstup.js`), `qrcode.js` (kopie `public/shared/qrcode.js`), `logo-centrum.png`.

Sestavení `kp-adb.js`:

    npm i @yume-chan/adb@2.6.4 @yume-chan/adb-daemon-webusb@2.3.2 @yume-chan/adb-credential-web@2.1.0 @yume-chan/android-bin@2.1.0 esbuild@0.24.2
    npx esbuild zdroj/kp-adb.vstup.js --bundle --format=iife --global-name=KPADB --minify --target=chrome100 --outfile=kp-adb.js

Netlify: projekt `newandroidkartapacienta` (publikovat celou složku `nastroje/novy-telefon`).
