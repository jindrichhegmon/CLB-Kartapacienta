# Průkaz pro plán péče pro iOS a Android – nativní aplikace (Capacitor)

Aplikace pro iPhone a Android, která v nativním okně zobrazuje **živý Průkaz pro plán péče**
https://kartapacienta.95-216-201-2.sslip.io/prukaz/. Nic jiného v sobě nemá: celá karta běží v tom webu a data
zůstávají v úložišti aplikace (oddělené od prohlížeče), zašifrovaná PINem. Když se Průkaz změní (nasazení Karty pacienta),
aplikace ho má hned – **nový build do obchodů je potřeba jen při změně obalu** (ikona, název, oprávnění, verze).

Stejný postup a stejné skripty jako PéčeDoma (`WEB-PeceDoma/ios-app`). Základ: Capacitor 7 (Swift Package Manager,
bez CocoaPods), bundle / applicationId `cz.dialogus.prukaz`, název „Průkaz“, jen na výšku, iOS 15+, Android 6+ (minSdk 23),
cíl Android 16 (API 36).

## Jak to funguje

1. Po spuštění se na okamžik ukáže úvodní stránka `www/index.html` (modrá, „Otevírám…“) a hned otevře Průkaz (`ODKAZ`).
2. Průkaz si data i PIN drží v úložišti aplikace; nic se neposílá, Průkaz nemá žádné API.
3. Odkazy mimo `*.sslip.io` se otevřou v Safari / Chromu (`server.allowNavigation` v `capacitor.config.json`).
4. Aplikace se hlásí v user agentu jako `PrukazApp` (`appendUserAgent`).
5. Fotografie dokumentu chce oprávnění – texty žádostí jsou v `ios/App/App/Info.plist` (`NSCameraUsageDescription`,
   `NSPhotoLibraryUsageDescription`); Android má `CAMERA` v `AndroidManifest.xml`.
6. Zásady ochrany soukromí pro obchody: https://kartapacienta.95-216-201-2.sslip.io/prukaz/ochrana-soukromi.html
   (data jen v zařízení, nic se nesbírá).

## iOS (jen na Macu)

Potřeba: **Xcode 16+**, **Node.js LTS**, **Apple Developer Program** (pro TestFlight a App Store), iPhone s kabelem.

```bash
cd ~/Documents/Claude/Projects/CLB-Kartapacienta/mobil
./pripravit.sh
```

Skript nainstaluje Capacitor, zkopíruje úvodní stránku do projektu, doplní scene lifecycle (povinné od iOS 27), nastaví číslo
sestavení z času a otevře Xcode. V Xcode: projekt **App** → cíl **App** → **Signing & Capabilities** → **Team**; nahoře vybrat
připojený iPhone a **▶**, nebo **Any iOS Device** → **Product → Archive → Distribute App → App Store Connect** pro TestFlight.

- **TestFlight** (testeři): na https://appstoreconnect.apple.com založit aplikaci (název Průkaz pro plán péče, bundle ID
  `cz.dialogus.prukaz`, kategorie Medical, ochrana soukromí = odkaz výše), TestFlight → přidat testery e-mailem (interní do 100
  bez schvalování). Build platí 90 dní, pak nahrát nový (`./pripravit.sh` zvýší číslo sestavení).
- **App Store**: aplikace, která jen zobrazuje web, může narazit na pravidlo 4.2 (minimální funkčnost). Průkaz má ale vlastní
  logiku v zařízení (šifrování, zálohy, krizová karta), což do popisu pro posouzení uveďte; texty jsou v `appstore-texty.md`.
- Verze aplikace = `MARKETING_VERSION` v `ios/App/App.xcodeproj/project.pbxproj` (General → Version), teď 0.1.0.

## Android

**Sestavení na GitHubu (bez Android Studia):** workflow `.github/workflows/android.yml` (Actions → *Android APK a AAB* →
*Run workflow*; automaticky po změně v `mobil/`). Podepsané `Prukaz.apk` (instalace z webu) a `Prukaz.aab` (Google Play) zapíše
do `public/prukaz/android/` na větvi, ze které běžel; po nasazení Karty (`./deploy/vps-deploy.sh`) jsou na
https://kartapacienta.95-216-201-2.sslip.io/prukaz/android/ (stránka s návodem pro testery). Podpis vyžaduje dva
**GitHub Secrets** (Settings → Secrets and variables → Actions):

- `ANDROID_KEYSTORE_B64` – soubor klíče `.p12` v base64,
- `ANDROID_KEYSTORE_PASSWORD` – heslo klíče (stejné pro úložiště i klíč, alias `prukaz`).

Klíč vytvoříte jednou na Macu (zvolte vlastní heslo místo `MOJE-HESLO`); zůstane v `~/Prukaz-android-klic/`, **zálohujte ho**:
bez něj nejde vydat aktualizaci, Android odmítne APK s jiným podpisem.

```bash
mkdir -p ~/Prukaz-android-klic && cd ~/Prukaz-android-klic
openssl req -x509 -newkey rsa:2048 -keyout prukaz.key -out prukaz.crt -days 10950 -nodes -subj "/CN=Prukaz pro plan pece/O=Centrum pro lecbu bolesti/C=CZ"
openssl pkcs12 -export -inkey prukaz.key -in prukaz.crt -name prukaz -out prukaz-release.p12 -passout pass:MOJE-HESLO
base64 -i prukaz-release.p12 | pbcopy    # obsah schránky → Secret ANDROID_KEYSTORE_B64; heslo → ANDROID_KEYSTORE_PASSWORD
```

**Sestavení na Macu** (náhradně, potřebuje Android Studio): `PRUKAZ_KEYSTORE_PASSWORD='heslo' ./vydat-android.sh`.

**Google Play:** Play Console → nová aplikace → *Testing → Internal testing* → nahrát `Prukaz.aab`, přidat e-maily testerů
(do 100), odeslat odkaz. Pro vydání: Data safety (žádná data se nesbírají ani neodesílají), kategorie Health & Fitness / Medical,
zásady ochrany soukromí = odkaz výše.

## Soubory

- `capacitor.config.json` – ID, název, povolené domény, barvy, user agent
- `www/index.html` – úvodní stránka, přesměrování na Průkaz
- `ios/App/App.xcodeproj`, `ios/App/App/Info.plist`, `ios/App/App/Assets.xcassets` (ikona 1024, splash) – projekt Xcode
- `android/` – projekt Android (Gradle, ikony `mipmap-*`, splash `drawable-*`, podpis z proměnných `PRUKAZ_KEYSTORE_*`)
- `pripravit.sh` (iOS), `scena-ios.sh` (scene lifecycle), `vydat-android.sh` (Android na Macu)
- `appstore-texty.md` – texty pro App Store a Google Play
