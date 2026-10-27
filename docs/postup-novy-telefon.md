# Karta pacienta – nahrání karty na další telefon

Postup pro zapůjčený telefon u lůžka: Android aplikace Karta pacienta (kiosk) + spárování s centrální aplikací.
Dvě cesty: **A. kabelem z Macu** (ověřená) a **B. QR kódem bez kabelu** (pro větší počet telefonů).

## Co je potřeba

- Telefon s Androidem 12 nebo novějším, **po továrním resetu a bez účtů** (Google, Samsung). Správce zařízení jde nastavit jen na telefonu bez účtů.
- Mac s Android Studiem (sestavené APK `android/app/build/outputs/apk/debug/app-debug.apk`) a kabel, který přenáší data (ne jen nabíjecí).
- Servisní PIN aplikace – ten, který jste zadal do `android/local.properties` při sestavení APK (ladicí verze bez PINu má 1234).
- Přístup do centrální aplikace (Telefon a PINy → Spárovat telefon) pro vydání párovacího kódu.

## A. Nahrání kabelem

### 1. Příprava telefonu

1. Tovární reset: Nastavení → Obecná správa → Resetovat → Obnovit tovární data. V průvodci prvního zapnutí **přeskočit Google účet** (Samsung: i Samsung účet), Wi‑Fi nastavit.
2. Zapnout ladění USB: Nastavení → O telefonu → Informace o softwaru → 7× klepnout na **Číslo sestavení** → zpět → **Možnosti pro vývojáře** → **Ladění USB** zapnout.
3. Připojit telefon kabelem k Macu. V oznamovací liště telefonu zvolit režim USB **Přenos souborů**. Při dotazu **Povolit ladění USB?** zaškrtnout „Vždy povolit z tohoto počítače“ a povolit.

### 2. Příkazy na Macu (Terminál, kdekoli stojíte)

```
cd ~/Documents/Claude/Projects/CLB-Kartapacienta 2>/dev/null || cd ~/Downloads/CLB-Kartapacienta
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
adb devices
adb shell dumpsys account | grep "Account {"
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell dpm set-device-owner cz.centrumlb.kartapacienta/.AdminReceiver
adb shell am start -n cz.centrumlb.kartapacienta/.MainActivity
```

Co má který řádek vypsat:

| Příkaz | Správný výsledek | Když ne |
|---|---|---|
| `adb devices` | řádek s číslem telefonu a slovem `device` | prázdné = kabel / režim USB / ladění; `unauthorized` = potvrdit dialog na telefonu; `protocol fault` = spustit znovu |
| `dumpsys account` | nic | vypíše účet → odebrat ho v Nastavení → Účty a zálohování → Správa účtů |
| `adb install` | `Success` | na telefonu povolit instalaci z počítače |
| `dpm set-device-owner` | `Success: Device owner set to package …` | `already some accounts` = účet na telefonu; `device owner is already set` = jiná správa (SureFox apod.) → tovární reset |
| `am start` | `Starting: Intent …` | – |

### 3. Dokončení

1. **Restartovat telefon.** Po startu naběhne rovnou Karta s obrazovkou párování. Domů a Přehled nefungují, Zpět jen vrací na Kartu.
2. **Spárovat:** v centrální aplikaci u pacienta Telefon a PINy → Spárovat telefon → QR kód. Na telefonu „Načíst QR kód fotoaparátem“ (fotoaparát je v kiosku povolený), nebo kódy opsat.
3. **Vyzkoušet:** volání z krizové karty (klepnutí na číslo otevře vytáčení), servis (5× rychle klepnout do levého horního rohu → servisní PIN → Wi‑Fi, Obnovit kartu, Ukončit kiosk, Vrátit telefon).
4. **Před předáním k pacientovi vypnout ladění USB:** servis → Nastavení Wi‑Fi → do celého Nastavení → Možnosti pro vývojáře → Ladění USB vypnout.

## B. Nahrání QR kódem (bez kabelu)

Jednou se připraví release APK a QR, pak je každý další telefon pár minut bez počítače.

1. V Android Studiu sestavit **release** APK (Build → Generate Signed App Bundle / APK → APK, vlastní podpisový klíč `.jks` uschovat mimo git) a zkopírovat ho do `public/android/kartapacienta.apk`.
2. Nasadit web: `./deploy/vps-deploy.sh` (APK se nahraje na server).
3. Vytvořit QR: `node android/provisioning-qr.mjs public/android/kartapacienta.apk --wifi NázevSítě` (heslo Wi‑Fi se zadá skrytě). Vznikne `android/provisioning-qr.html` – otevřít v prohlížeči, případně vytisknout. **Po každém novém sestavení APK vygenerovat QR znovu.**
4. Nový telefon po továrním resetu zapnout, na uvítací obrazovce **6× klepnout**, naskenovat QR. Telefon si stáhne APK, zašifruje se, nastaví správce zařízení a spustí Kartu.
5. Dál jako v A. 3: spárovat, vyzkoušet.

## Aktualizace aplikace na telefonu, který už je kiosk

Správce zařízení zůstává, stačí nahrát nové APK (telefon na kabelu, ladění USB zapnuté):

```
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n cz.centrumlb.kartapacienta/.MainActivity
```

Změny samotné karty (webu) se do telefonu propisují samy po `./deploy/vps-deploy.sh`, aplikaci není třeba měnit.

## Vrácení telefonu k běžnému použití

Servis (5× klepnout do rohu, PIN) → **Vrátit telefon**. Nebo z Macu: `adb shell dpm remove-active-admin cz.centrumlb.kartapacienta/.AdminReceiver`. Pak jde aplikaci odinstalovat a přidat účty.

## Když se něco nedaří

- **„Karta pacienta pravidelně přestává fungovat“** (pád aplikace): `adb logcat -d | grep -A 25 "FATAL EXCEPTION" | tail -60` a výpis poslat k opravě. Dočasně lze kiosk vypnout příkazem `remove-active-admin` výše.
- **Build hlásí „R$color is defined multiple times“** nebo soubory `… 2.jar`: duplikáty od iCloudu v sestavovací složce. `rm -rf android/app/build android/build android/.gradle` a sestavit znovu. Lépe projekt držet mimo synchronizovanou složku Documents.
- **Telefon po zhasnutí chce znovu párovat:** to dělá jen cizí kiosk prohlížeč (SureFox apod.), který maže data. V této aplikaci se neděje.
- **Karta ukazuje starou verzi:** nasadit web (`./deploy/vps-deploy.sh`), na telefonu servis → Obnovit kartu.
