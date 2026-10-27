# Karta pacienta – Android (kiosk)

Nativní obálka webové karty `/karta/`. Karta sama řeší šifrování, offline data a synchronizaci,
aplikace jen:

- po zapnutí telefonu spustí kartu a nedovolí z ní odejít (Lock Task, aplikace je domovská obrazovka),
- pustí volání z karty (`tel:` → vytáčení, telefonní aplikace je v kiosku povolená),
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
   (Telefon a PINy → Spárovat telefon; kód se v aplikaci opíše, fotoaparát v kiosku není).
5. Pro ostrý provoz vypnout Ladění USB.

Chyba `Not allowed to set the device owner because there are already some accounts` = na telefonu
zůstal účet, odebrat ho (nebo znovu tovární reset).

## Servis

**5× rychle klepnout do levého horního rohu** → servisní PIN → nabídka:

| Volba | Co udělá |
|---|---|
| Nastavení Wi-Fi | otevře panel Wi-Fi, po zavření se kiosk sám znovu zamkne |
| Obnovit kartu | znovu načte stránku |
| Ukončit kiosk (do restartu) | uvolní telefon pro servis, po restartu je kiosk zpět |
| Vrátit telefon | zruší správu zařízení – pak jde aplikace odinstalovat |

Po 5 chybných PINech je servis 15 minut zablokovaný.

## Na co myslet

- **`applicationId` `cz.centrumlb.kartapacienta`** nejde po prvním nahrání do Google Play změnit – případně upravit v `app/build.gradle.kts` předem.
- Klíč pro podepisování release (`.jks`) uschovat mimo git; bez něj nejde vydat aktualizaci.
- Google Play: aplikace funguje i bez kiosku, takže projde jako běžná aplikace. Kiosk se zapne jen na telefonech,
  kde ji nastavíte jako správce zařízení.
- Pro 20 telefonů bez kabelu: nastavení **QR kódem při prvním zapnutí** (6× klepnout na uvítací obrazovku).
  Aplikace je na to připravená (`ProvisioningActivity`), chybí jen APK na HTTPS adrese a QR s jeho kontrolním součtem.
- Vzdálené zamčení a smazání (MDM) tato aplikace neřeší – viz `docs/souhrn-a-zadani-pro-vyvoj.md`.
