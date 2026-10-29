# Karta pacienta pro domácnost (Můj průkaz) – aplikace pro Android (Capacitor)

Aplikace pro vlastní telefon pacienta nebo rodiny, která v nativním okně (WebView) zobrazuje **živou stránku
Můj průkaz** (`/pacient/`) serveru Karty pacienta. Nic jiného v sobě nemá: párování kódem průkazu, uložení průkazu
v telefonu, synchronizace, zprávy s týmem i videohovor jsou ve stránce. Když se server změní (nová verze Karty),
aplikace ji má hned – **nový build do Google Play je potřeba jen při změně obalu** (ikona, název, oprávnění, adresa serveru).

Základ: [Capacitor 8](https://capacitorjs.com), `applicationId cz.centrumlb.mujprukaz`, název na ploše „Karta pacienta“,
jen na výšku, Android 7+ (minSdk 24), cíl Android 16 / API 36 (Google Play od 31. 8. 2026 jinou nepřijme).
Oprávnění: INTERNET, CAMERA (načtení kódu z telefonu u pacienta, videohovor), RECORD_AUDIO (videohovor).

Nezaměňovat se složkou `android/` – to je **kiosková aplikace zapůjčeného telefonu** (karta týmu, správce zařízení,
instaluje se QR kódem, do Google Play nepatří).

## Jak to funguje

1. Po spuštění se na okamžik ukáže úvodní stránka `www/index.html` (modrá, „Otevírám průkaz…“) a hned otevře
   `https://kartapacienta.95-216-201-2.sslip.io/pacient/` (`ADRESA` v `www/index.html`; jiný server = změnit a vydat nový build).
2. Pacient nebo rodina v ní spáruje průkaz kódem z telefonu u pacienta (nebo z centrály) – stejně jako v prohlížeči.
3. Stránka si průkaz pamatuje v úložišti aplikace (odděleném od Chromu); párovat se je třeba jednou.
4. Odkazy mimo server Karty (`server.allowNavigation` v `capacitor.config.json`) se otevřou v prohlížeči telefonu.
5. Aplikace se serveru hlásí v user agentu jako `MujPrukazApp` (`appendUserAgent`).

## Sestavení na GitHubu (bez Android Studia)

Workflow `.github/workflows/android-prukaz.yml` (Actions → *Android – Můj průkaz* → *Run workflow*; spustí se i sám po změně
v `prukaz-android/` na `main` nebo na větvi `claude/*`): `npm ci`, `cap sync android`, `gradlew assembleRelease` a
`gradlew bundleRelease` s `-PversionCode=<číslo běhu>`. Výsledek jsou artefakty běhu (Actions → běh → Artifacts):

- `MujPrukaz-android-<číslo>` – podepsané APK (zkouška na telefonu: stáhnout, povolit instalaci z neznámého zdroje),
- `MujPrukaz-google-play-<číslo>` – podepsané AAB (nahrát v Play Console).

Podpis vyžaduje dva **GitHub Secrets** (repozitář → Settings → Secrets and variables → Actions → New repository secret):

- `PRUKAZ_KEYSTORE_B64` – soubor klíče `.p12` v base64,
- `PRUKAZ_KEYSTORE_PASSWORD` – heslo klíče (stejné pro úložiště i klíč, alias `mujprukaz`).

Klíč vytvoříte jednou na Macu (OpenSSL je v macOS; místo `MOJE-HESLO` zvolte vlastní heslo a uložte ho do správce hesel).
Zůstane v `~/MujPrukaz-android-klic/`, **zálohujte ho** – bez něj nejde vydat aktualizaci:

```bash
mkdir -p ~/MujPrukaz-android-klic && cd ~/MujPrukaz-android-klic
openssl req -x509 -newkey rsa:2048 -sha256 -days 10950 -nodes -keyout klic.pem -out cert.pem \
  -subj "/CN=MujPrukaz/O=Centrum pro lecbu bolesti a paliativni medicinu s.r.o./L=Zlin/C=CZ"
openssl pkcs12 -export -inkey klic.pem -in cert.pem -name mujprukaz -out mujprukaz-release.p12 -passout pass:MOJE-HESLO
base64 -i mujprukaz-release.p12 | pbcopy   # base64 klíče je ve schránce → vložit do Secret PRUKAZ_KEYSTORE_B64
```

Bez Secrets workflow sestaví jen nepodepsané balíčky a napíše varování. Klíč je jen **klíč pro nahrávání** – Google Play
podepisuje aplikaci vlastním klíčem (Podepisování aplikací Google Play), takže APK z artefaktu a aplikace z Play mají
jiný podpis a jedna přes druhou se nenainstaluje (nejdřív odinstalovat).

### Sestavení na Macu (náhradní cesta)

Android Studio (JDK + SDK) a klíč z předchozího kroku:

```bash
cd ~/Documents/Claude/Projects/CLB-Kartapacienta/prukaz-android
npm install --no-audit --no-fund
npx cap sync android
export PRUKAZ_KEYSTORE_FILE=~/MujPrukaz-android-klic/mujprukaz-release.p12
read -s -p "Heslo klíče: " PRUKAZ_KEYSTORE_PASSWORD; echo; export PRUKAZ_KEYSTORE_PASSWORD
( cd android && chmod +x gradlew && ./gradlew assembleRelease bundleRelease -PversionCode=$(date +%y%m%d%H) )
ls android/app/build/outputs/apk/release/ android/app/build/outputs/bundle/release/
```

`npx cap open android` otevře projekt v Android Studiu (zkouška na připojeném telefonu s povoleným laděním USB).

## Google Play

Play Console přijímá jen AAB (artefakt `MujPrukaz-google-play-<číslo>`).

1. Účet vývojáře na https://play.google.com/console (jednorázově 25 USD). Účet **organizace** (Centrum s.r.o.) potřebuje
   číslo D-U-N-S a ověření firmy, ale nemusí před zveřejněním testovat; **osobní** účet musí nejdřív 14 dní uzavřeně
   testovat s aspoň 12 testery. Stejný účet poslouží i pro PéčeDoma.
2. *Vytvořit aplikaci*: název **Karta pacienta pro domácnost**, výchozí jazyk čeština, aplikace, zdarma.
3. *Nastavení aplikace* (úkoly na hlavní stránce): zásady ochrany soukromí
   `https://kartapacienta.95-216-201-2.sslip.io/ochrana-soukromi.html` (stránka `public/ochrana-soukromi.html`),
   přístup k aplikaci (vyžaduje párování – recenzentům dát kód zkušebního průkazu, viz `docs/play/texty.md`), reklamy ne,
   hodnocení obsahu, cílová skupina 18+, bezpečnost údajů (zdravotní údaje, šifrování přenosu, data jde smazat
   odebráním průkazu), kategorie Zdravotnictví, deklarace zdravotní aplikace.
4. *Záznam v obchodě*: texty z `docs/play/texty.md`, ikona 512×512 `public/icons/icon-512.png`, grafika 1024×500
   `docs/play/grafika-1024x500.png`, snímky obrazovky `docs/play/snimky/`.
5. *Testování → Interní testování → Vytvořit verzi*: **Podepisování aplikací Google Play** nechte zapnuté, nahrajte AAB,
   poznámky k verzi, uložit, zveřejnit testerům (e-maily). Pak Produkce – kontrola nové zdravotní aplikace trvá dny.
6. Každá další verze: zvýšit `versionName` v `android/app/build.gradle`, spustit workflow, stáhnout nové AAB a nahrát ho.
   `versionCode` (číslo běhu) roste sám; Google Play odmítne AAB se stejným nebo nižším číslem.

## Soubory

- `capacitor.config.json` – ID, název, povolené domény v aplikaci, barva pozadí
- `www/index.html` – úvodní stránka (přesměrování na Můj průkaz)
- `android/` – projekt Android Studia (Gradle); `android/app/build.gradle` – verze a podpis; `android/variables.gradle` – SDK;
  `android/app/src/main/AndroidManifest.xml` – oprávnění, orientace; ikony `res/mipmap-*` a úvodní obrazovky
  `res/drawable-*/splash.png` jsou vyrobené z `public/icons/icon-512.png`
- `android/app/src/main/assets/public` a `capacitor.config.json` v projektu se generují při `cap sync` (nejsou v gitu)
