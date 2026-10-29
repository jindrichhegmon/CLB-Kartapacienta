# Karta pacienta – Android (kiosk)

Nativní obálka webové karty `/karta/`. Karta sama řeší šifrování, offline data a synchronizaci,
aplikace jen:

- po zapnutí telefonu spustí kartu a nedovolí z ní odejít (Lock Task, aplikace je domovská obrazovka),
- pustí volání z karty (`tel:` → vytáčení, telefonní aplikace je v kiosku povolená),
- pustí fotoaparát jen pro kartu (čtečka párovacího QR kódu); v kiosku si oprávnění přidělí sama (0.1.1),
- pustí mikrofon a fotoaparát pro videohovor vložený v kartě (Jitsi) a přehraje zvonění příchozího hovoru (0.1.3); oprávnění obnoví při každém startu, takže stačí aktualizovat APK (0.1.4); na Androidu 12+ zavedeném kabelem (`dpm set-device-owner`) správce mikrofon přidělit nesmí – aplikace se pak při startu zeptá běžným dialogem, stačí klepnout na Povolit; QR zavedení má opt-out, aby šlo přidělit rovnou (0.1.5); zvuk hovoru jde na hlasitý reproduktor a hlasitost se při začátku hovoru zvedne aspoň na 85 % (0.1.6),
- **probudí telefon při hovoru z centrály** i se zhasnutou obrazovkou (0.1.8): karta aplikaci předá klíč jen pro zvonění (`window.KartaAndroid.nastavZvoneni`), služba na popředí se při zhasnutém displeji ptá serveru každých 15 s (`GET /api/d/video`, `Authorization: Video …`) a při zvonění z centrály rozsvítí displej a dá kartu do popředí; karta pak zvoní jako obvykle a drží obrazovku rozsvícenou (`drzObrazovku`). Jako správce zařízení si aplikace nastaví výjimku z úspor energie (Doze); na starším Androidu ručně `adb shell dumpsys deviceidle whitelist +cz.centrumlb.kartapacienta`,
- bez signálu ukáže kartu z mezipaměti, při úplně prvním spuštění bez internetu nabídne „Zkusit znovu“,
- po servisním PINu nabídne Wi-Fi, obnovení, vypnutí kiosku a vrácení telefonu.

Bez role správce zařízení (např. instalace z Google Play) běží jako obyčejná aplikace bez kiosku.

## Sestavení (Mac, Android Studio)

1. Android Studio → **Open** → složka `android/`.
2. Do `android/local.properties` (není v gitu) doplnit:
   ```
   kp.servisPin=123456          # váš servisní PIN, povinný pro release
   # kp.url=https://…/karta/    # jen pokud karta běží jinde než na živém serveru
   ```
   Ladicí verze bez nastaveného PINu má PIN `1234`.
3. **Build → Build APK(s)**, nebo `./gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`.

## Příprava telefonu (zatím přes kabel)

Device Owner jde nastavit jen na telefonu **bez účtů** – tedy po továrním resetu.

1. Tovární reset, v průvodci prvního zapnutí **přeskočit Google účet** (Samsung: i Samsung účet).
2. Nastavení → O telefonu → 7× klepnout na „Číslo sestavení“ → Možnosti pro vývojáře → **Ladění USB**.
3. Na Macu:
   ```bash
   adb install app-debug.apk
   adb shell dpm set-device-owner cz.centrumlb.kartapacienta/.AdminReceiver
   adb shell am start -n cz.centrumlb.kartapacienta/.MainActivity
   ```
4. Restartovat telefon – naběhne rovnou karta. Pak spárovat kódem z centrální aplikace
   (Telefon a PINy → Spárovat telefon; QR kód jde načíst fotoaparátem přímo v kartě, nebo kód opsat).
5. Pro ostrý provoz vypnout Ladění USB.

## Příprava telefonu QR kódem (bez kabelu, pro víc telefonů)

Telefon si APK stáhne sám z živého serveru a nastaví se jako kiosk. Jednou se připraví QR, pak je to na telefon
pár minut bez počítače.

1. V Android Studiu sestavit **release** (Build → Generate Signed App Bundle / APK → APK) a soubor zkopírovat do
   `public/android/kartapacienta.apk` (složka je v gitu ignorovaná; `./deploy/vps-deploy.sh` ho nahraje na server).
2. Nasadit: `./deploy/vps-deploy.sh`. APK je pak na `https://kartapacienta.95-216-201-2.sslip.io/android/kartapacienta.apk`.
3. Vygenerovat QR (kontrolní součet se počítá z APK, po každém novém sestavení znovu):
   ```bash
   node android/provisioning-qr.mjs public/android/kartapacienta.apk --wifi NázevSítě
   ```
   Heslo Wi-Fi se zadá skrytě. Vznikne `android/provisioning-qr.html` (není v gitu) – otevřít v prohlížeči, případně vytisknout.
   Bez `--wifi` se telefon musí k síti připojit ručně před skenováním.
4. Telefon po továrním resetu zapnout, na uvítací obrazovce **6× klepnout**, naskenovat QR. Telefon si stáhne APK,
   zašifruje se, nastaví správce zařízení a spustí kartu. Pak jen spárovat.

Servisní PIN je v APK (`kp.servisPin` při sestavení), platí pro všechny telefony z tohoto APK.

Chyba `Not allowed to set the device owner because there are already some accounts` = na telefonu
zůstal účet, odebrat ho (nebo znovu tovární reset).

## Servis

**5× rychle klepnout do levého horního rohu** → servisní PIN → nabídka:

| Volba | Co udělá |
|---|---|
| Nastavení Wi-Fi | otevře panel Wi-Fi, po zavření se kiosk sám znovu zamkne |
| Obnovit kartu | znovu načte stránku |
| Stav zvonění (diagnostika) | zda karta předala klíč pro zvonění, zda běží služba a co naposledy udělala (0.1.11) |
| Zhasínání displeje | po kolika minutách displej zhasne (1 min – nikdy); nastaví se přímo, bez opouštění kiosku, platí i po restartu (0.1.9) |
| Ukončit kiosk (do restartu) | uvolní telefon pro servis, po restartu je kiosk zpět |
| Vrátit telefon | zruší správu zařízení – pak jde aplikace odinstalovat |

Po 5 chybných PINech je servis 15 minut zablokovaný.

## Na co myslet

- **`applicationId` `cz.centrumlb.kartapacienta`** nejde po prvním nahrání do Google Play změnit – případně upravit v `app/build.gradle.kts` předem.
- Klíč pro podepisování release (`.jks`) uschovat mimo git; bez něj nejde vydat aktualizaci.
- Google Play: aplikace funguje i bez kiosku, takže projde jako běžná aplikace. Kiosk se zapne jen na telefonech,
  kde ji nastavíte jako správce zařízení.
- Nastavení QR kódem vyžaduje **release APK podepsané vaším klíčem**; ladicí `app-debug.apk` na to nepoužívejte
  (jiný podpis = aktualizace z Play by nešla nainstalovat přes něj).
- Vzdálené zamčení a smazání (MDM) tato aplikace neřeší – viz `docs/souhrn-a-zadani-pro-vyvoj.md`.
