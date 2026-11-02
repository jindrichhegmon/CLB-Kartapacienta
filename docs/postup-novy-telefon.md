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
3. **Vyzkoušet:** volání z krizové karty (klepnutí na číslo otevře vytáčení), servis (5× rychle klepnout do levého horního rohu → servisní PIN → Wi‑Fi, Obnovit kartu, Zhasínání displeje, Ukončit kiosk, Vrátit telefon).
4. **Zhasínání displeje** nastavte v servisu (např. 30 minut nebo Nikdy) – není třeba kiosk opouštět. **Vrátit telefon** kiosk ruší natrvalo (po restartu se nevrátí; obnovit ho jde jen znovu kabelem, část A, krok 2). Dočasně kiosk pustí jen **Ukončit kiosk (do restartu)**.
4. **Před předáním k pacientovi vypnout ladění USB:** servis → Nastavení Wi‑Fi → do celého Nastavení → Možnosti pro vývojáře → Ladění USB vypnout.

## B. Nahrání QR kódem (bez kabelu)

Jednou se připraví release APK a QR, pak je každý další telefon pár minut bez počítače.

1. V Android Studiu sestavit **release** APK (Build → Generate Signed App Bundle / APK → APK, vlastní podpisový klíč `.jks` uschovat mimo git) a zkopírovat ho do `public/android/kartapacienta.apk`.
2. Nasadit web: `./deploy/vps-deploy.sh` (APK se nahraje na server).
3. Vytvořit QR: `node android/provisioning-qr.mjs public/android/kartapacienta.apk --wifi NázevSítě` (heslo Wi‑Fi se zadá skrytě). Vznikne `android/provisioning-qr.html` – otevřít v prohlížeči, případně vytisknout. **Po každém novém sestavení APK vygenerovat QR znovu.**
4. Nový telefon po továrním resetu zapnout, na uvítací obrazovce **6× klepnout**, naskenovat QR. Telefon si stáhne APK, zašifruje se, nastaví správce zařízení a spustí Kartu.
5. Dál jako v A. 3: spárovat, vyzkoušet.

## C. Aligator S6600 (Android 14): QR kód + dokončení kabelem – ověřený postup

Na tomto modelu padá po naskenování QR kódu systémový průvodce Androidu (chyba v jeho textech,
`MissingFormatArgumentException '%1$s'` v ManagedProvisioning) a vrací se na skener – **správce zařízení i aplikace
už ale v telefonu jsou**. Zbývá průvodci oznámit, že nastavení je hotové; to udělá skript `android/dokoncit-telefon.sh`
kabelem (ladění USB zapnula aplikace sama, Možnosti pro vývojáře nejsou potřeba). Podrobný postup pro kolegyně je
v `docs/postup-telefon-kolegyne.md` (a `.docx`).

1. Tovární reset (Nastavení → Systém → Resetovat, nebo bez hesla: vypnout, držet zeslabení hlasitosti + zapínání → Wipe data/factory reset → Reboot).
2. Na uvítací obrazovce 6× klepnout → skener → naskenovat QR (`android/provisioning-qr.html`; Wi‑Fi je v kódu). Nechat doběhnout stahování a „Nastavování zařízení“ – skončí zpět na skeneru, to je v tomto modelu normální.
3. Připojit telefon kabelem k Macu; **na Macu** potvrdit „Povolit připojení příslušenství“, **na telefonu** potvrdit „Povolit ladění USB?“ (zaškrtnout Vždy povolit).
4. Na Macu: `cd ~/Documents/Claude/Projects/CLB-Kartapacienta && ./android/dokoncit-telefon.sh` – skript počká na telefon, ověří správce, dokončí nastavení a telefon restartuje.
5. Po startu klepnout na ikonu **Karta pacienta** → kiosk se zapne (zmizí Domů), okno Spárovat telefon s průkazem. Od té chvíle telefon startuje rovnou do karty.
6. Spárovat až při předání pacientovi (centrála → Telefon a PINy → Spárovat telefon).

## D. Z počítače s Windows

Stejný postup jako v oddílu C, jen krok s kabelem se dělá dvojklikem na soubor `.cmd` (složka `android/windows/`,
v Dropboxu `Nový telefon – postup a nástroje/Pro počítač s Windows`). Skripty se spouštějí přímo z Dropboxu; při prvním
spuštění si stáhnou adb od Googlu (Platform-Tools) do `C:\KartaPacienta` (mimo Dropbox, systémovou `C:\Windows`
nepoužívají). Podrobně v `android/windows/CTI-ME-Windows.txt`.

1. Telefon: reset → 6× klepnout → QR kód (`provisioning-qr.html` otevřít v prohlížeči) → návrat na skener.
2. Kabel do PC, na telefonu potvrdit „Povolit ladění USB?“ (Vždy povolit). Windows dotaz na příslušenství nemá.
3. Dvojklik `dokoncit-telefon.cmd` → telefon se restartuje → klepnout na ikonu Karta pacienta → kiosk.
4. Aktualizace aplikace kabelem: dvojklik `nahrat-telefon.cmd` (stáhne aktuální APK ze serveru Karty, u telefonu bez
   kiosku nastaví správce zařízení, kartu spustí).
5. Ovladač telefonu Windows 10/11 obvykle nainstaluje samo; jinak Google USB Driver (Správce zařízení → Aktualizovat
   ovladač → Z disku). Při prvním spuštění .cmd: „Další informace“ → „Přesto spustit“.

## Aktualizace aplikace na telefonu, který už je kiosk

Správce zařízení zůstává, stačí nahrát nové APK (telefon na kabelu, ladění USB zapnuté a potvrzené). Jeden příkaz:

```
cd ~/Documents/Claude/Projects/CLB-Kartapacienta && ./android/nahrat-telefon.sh
```

Skript nahraje `android/app/release/app-release.apk` (podepsané stejným klíčem jako telefony zavedené QR kódem), u telefonu
bez správce ho nastaví (jen bez účtů v telefonu) a kartu spustí. Telefony s ladicí verzí (jiný podpis) nejdřív:
`adb shell dpm remove-active-admin cz.centrumlb.kartapacienta/.AdminReceiver && adb uninstall cz.centrumlb.kartapacienta`.

Změny samotné karty (webu) se do telefonu propisují samy po `./deploy/vps-deploy.sh`, aplikaci není třeba měnit.

## Vrácení telefonu k běžnému použití

Servis (5× klepnout do rohu, PIN) → **Vrátit telefon**. Nebo z Macu: `adb shell dpm remove-active-admin cz.centrumlb.kartapacienta/.AdminReceiver`. Pak jde aplikaci odinstalovat a přidat účty.

## Když se něco nedaří

- **„Karta pacienta pravidelně přestává fungovat“** (pád aplikace): `adb logcat -d | grep -A 25 "FATAL EXCEPTION" | tail -60` a výpis poslat k opravě. Dočasně lze kiosk vypnout příkazem `remove-active-admin` výše.
- **Build hlásí „R$color is defined multiple times“** nebo soubory `… 2.jar`: duplikáty od iCloudu v sestavovací složce. `rm -rf android/app/build android/build android/.gradle` a sestavit znovu. Lépe projekt držet mimo synchronizovanou složku Documents.
- **Telefon po zhasnutí chce znovu párovat:** to dělá jen cizí kiosk prohlížeč (SureFox apod.), který maže data. V této aplikaci se neděje.
- **Zhasnutý telefon při hovoru z centrály nezazvoní:** potřebuje aplikaci 0.1.8 nebo novější a jednou otevřenou (spárovanou) kartu po její instalaci – karta aplikaci předá klíč pro zvonění. Na Androidu 13 a starším navíc povolit síť i v klidu: `adb shell dumpsys deviceidle whitelist +cz.centrumlb.kartapacienta`.
- **Karta ukazuje starou verzi:** nasadit web (`./deploy/vps-deploy.sh`), na telefonu servis → Obnovit kartu.
- **Ve videohovoru není slyšet telefon (mikrofon nepovolený):** na Androidu 12 a novějším nesmí správce zařízení zavedený kabelem (`dpm set-device-owner`) fotoaparát a mikrofon přidělit sám (jde to jen při zavedení QR kódem, část B). Aplikace 0.1.5 a novější se proto při startu zeptá běžným dialogem – na telefonu klepněte na **Povolit** (u mikrofonu i fotoaparátu, stačí jednou). Jistota bez dialogu je povolit kabelem (funguje vždy):

```
adb shell pm grant cz.centrumlb.kartapacienta android.permission.RECORD_AUDIO
adb shell pm grant cz.centrumlb.kartapacienta android.permission.CAMERA
adb shell am force-stop cz.centrumlb.kartapacienta
adb shell am start -n cz.centrumlb.kartapacienta/.MainActivity
```

  Ověření: `adb shell dumpsys package cz.centrumlb.kartapacienta | grep -E "RECORD_AUDIO|CAMERA"` má u obou ukázat `granted=true`.
