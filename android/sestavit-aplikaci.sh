#!/usr/bin/env bash
# Nová verze aplikace Karta pacienta (kiosk) – sestavení, podpis, nasazení a nahrání do telefonu jedním příkazem z Macu:
#   cd ~/Downloads/CLB-Kartapacienta && ./android/sestavit-aplikaci.sh
#
# Co udělá:
#   1. stáhne poslední verzi z gitu (větev claude/dazzling-davinci-s5yi2x),
#   2. sestaví release (gradlew, Java z Android Studia), podepíše ho vaším klíčem (kiosk.jks – heslo se zadává skrytě, nikam se neukládá),
#   3. ověří, že podpis je STEJNÝ jako u aplikace, která je teď na serveru (jinak by nešla nahrát přes starou ani zavést QR kódem),
#   4. zkopíruje ji do public/android/kartapacienta.apk a na dotaz nasadí na server (./deploy/vps-deploy.sh),
#   5. na dotaz nahraje do telefonu na kabelu (./android/nahrat-telefon.sh) – stačí opakovat pro další telefony.
#
# Potřebuje: Android Studio (SDK, Java), android/local.properties s kp.servisPin, podpisový klíč kiosk.jks.
# Cesta ke klíči: proměnná KP_KEYSTORE, nebo kp.keystore v android/local.properties, jinak ho skript hledá a případně se zeptá.
#
# Varianta --hotove: aplikaci jste podepsal sám v Android Studiu (Build → Generate Signed App Bundle / APK → APK → release, soubor
# android/app/release/app-release.apk) – skript ji jen zkontroluje (podpis jako na serveru), nasadí a nahraje do telefonů:
#   ./android/sestavit-aplikaci.sh --hotove
set -euo pipefail
HOTOVE=0; ZDROJ=""
if [ "${1:-}" = "--hotove" ]; then HOTOVE=1; ZDROJ="${2:-}"; fi   # --hotove [cesta k APK z Android Studia]
cd "$(dirname "$0")/.."
KOREN=$(pwd)
VETEV=claude/dazzling-davinci-s5yi2x
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
LP="$KOREN/android/local.properties"
VYSTUP="$KOREN/android/app/release/app-release.apk"
SERVER_APK="$KOREN/public/android/kartapacienta.apk"
ano() { local o; read -r -p "$1 [a/N] " o; [[ "$o" =~ ^[aAyY] ]]; }
vlastnost() { [ -f "$LP" ] && grep -E "^$1=" "$LP" | tail -1 | cut -d= -f2- || true; }

echo "== 1/5 Poslední verze z gitu"
[ "$(git rev-parse --abbrev-ref HEAD)" = "$VETEV" ] || { echo "Jste na větvi $(git rev-parse --abbrev-ref HEAD), čekám $VETEV:  git switch $VETEV"; exit 1; }
git pull --ff-only origin "$VETEV"
echo "Aplikace: $(grep -m1 'versionName' android/app/build.gradle.kts | tr -d ' ')"

if [ "$HOTOVE" = 1 ]; then
  if [ -n "$ZDROJ" ]; then
    ZDROJ=$(echo "$ZDROJ" | sed "s/^'//; s/'$//")
    [ -f "$ZDROJ" ] || { echo "Soubor $ZDROJ neexistuje."; exit 1; }
    mkdir -p "$(dirname "$VYSTUP")"; [ "$ZDROJ" -ef "$VYSTUP" ] || cp "$ZDROJ" "$VYSTUP"
  fi
  echo "== 2–3/5 Hotová aplikace z Android Studia: $VYSTUP"
  [ -f "$VYSTUP" ] || { echo "Chybí $VYSTUP – v Android Studiu: Build → Generate Signed App Bundle / APK → APK → release; nebo zadejte cestu: ./android/sestavit-aplikaci.sh --hotove /cesta/k/app-release.apk"; exit 1; }
  echo "Sestaveno: $(date -r "$VYSTUP" '+%-d. %-m. %Y %H:%M')"
  # verze v APK musí být ta z gitu – jinak jde o starší sestavení (např. ze staré složky projektu)
  CHCI=$(grep -m1 'versionName' android/app/build.gradle.kts | sed -E 's/.*"([^"]+)".*/\1/')
  AAPT=$(ls -d "$SDK"/build-tools/*/ 2>/dev/null | sort -V | tail -1)aapt2
  if [ -x "$AAPT" ]; then
    MAM=$("$AAPT" dump badging "$VYSTUP" 2>/dev/null | sed -nE "s/.*versionName='([^']+)'.*/\1/p" | head -1 || true)
    if [ "$MAM" != "$CHCI" ]; then
      echo "POZOR: v APK je verze ${MAM:-?}, v gitu $CHCI – sestavili jste starší projekt (jiná složka?). V Android Studiu otevřete ~/Downloads/CLB-Kartapacienta/android a sestavte znovu."
      exit 1
    fi
    echo "Verze v APK: $MAM (odpovídá gitu)"
  fi
else
echo "== 2/5 Sestavení (první běh stahuje Gradle a trvá i několik minut)"
[ -d "$SDK" ] || { echo "Chybí Android SDK ($SDK) – nainstalujte Android Studio a jednou v něm otevřete složku android."; exit 1; }
if [ -z "$(vlastnost kp.servisPin)" ]; then
  # servisní PIN je jen v android/local.properties (do gitu nepatří) – zkusit dřívější složku projektu, jinak se zeptat (skrytě)
  for d in "$HOME/Documents/Claude/Projects/CLB-Kartapacienta" "$HOME/Documents/CLB-Kartapacienta" "$HOME/CLB-Kartapacienta"; do
    if [ "$d" != "$KOREN" ] && grep -q '^kp.servisPin=.' "$d/android/local.properties" 2>/dev/null; then
      if ano "V $d/android/local.properties je servisní PIN z dřívějšího sestavení. Převzít ho (i ostatní nastavení odtud)?"; then
        grep -E '^kp\.' "$d/android/local.properties" >> "$LP"; echo "Převzato (PIN se nevypisuje)."; break
      fi
    fi
  done
fi
if [ -z "$(vlastnost kp.servisPin)" ]; then
  echo "Servisní PIN (5× klepnout do rohu → PIN) – zadejte STEJNÝ, jaký mají telefony teď; jinak bude po aktualizaci platit nový."
  read -r -s -p "Servisní PIN (skrytě): " PIN1; echo; read -r -s -p "Znovu pro kontrolu: " PIN2; echo
  [ -n "$PIN1" ] && [ "$PIN1" = "$PIN2" ] || { echo "PINy se neshodují nebo je prázdný."; exit 1; }
  echo "kp.servisPin=$PIN1" >> "$LP"; unset PIN1 PIN2
  echo "Uloženo do android/local.properties (soubor je mimo git)."
fi
# podpisový klíč z dřívější složky projektu, když tady žádný není
if [ -z "$(vlastnost kp.keystore)" ] && [ -z "${KP_KEYSTORE:-}" ]; then
  STARY_KS=$(ls "$HOME/Documents/Claude/Projects/CLB-Kartapacienta"/android/*.jks 2>/dev/null | head -1 || true)
  if [ -n "$STARY_KS" ]; then export KP_KEYSTORE="$STARY_KS"; fi
fi
# Gradle 8.14 běží na Javě 17–21 (s Javou 25 skončí chybou „25.0.x“) – vybrat vhodnou: Java z Android Studia, jinak jiná nainstalovaná
javaVerze() { "$1/bin/java" -version 2>&1 | grep -m1 'version "' | sed -E 's/.*version "([0-9]+)(\.[0-9]+)?.*/\1/; s/^1$/8/' || true; }
vhodna() { [ -x "$1/bin/java" ] && v=$(javaVerze "$1") && [ "${v:-0}" -ge 17 ] 2>/dev/null && [ "$v" -le 21 ]; }
VYBRANA=""
for j in "/Applications/Android Studio.app/Contents/jbr/Contents/Home" "$HOME/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
         "/Applications/Android Studio.app/Contents/jre/Contents/Home" "${JAVA_HOME:-}" \
         "$(/usr/libexec/java_home -v 21 2>/dev/null || true)" "$(/usr/libexec/java_home -v 17 2>/dev/null || true)"; do
  if [ -n "$j" ] && vhodna "$j"; then VYBRANA="$j"; break; fi
done
if [ -z "$VYBRANA" ]; then
  echo "Nenašel jsem Javu 17–21 (Gradle 8.14 s Javou 25 nefunguje). Nainstalujte Javu 21:  brew install --cask temurin@21"
  echo "nebo aktualizujte Android Studio (obsahuje vlastní Javu) a spusťte skript znovu."
  exit 1
fi
export JAVA_HOME="$VYBRANA"
echo "Java: $(javaVerze "$JAVA_HOME") ($JAVA_HOME)"
grep -q '^sdk.dir=' "$LP" 2>/dev/null || echo "sdk.dir=$SDK" >> "$LP"
( cd android && ./gradlew --quiet :app:assembleRelease )
NEPODEPSANE="$KOREN/android/app/build/outputs/apk/release/app-release-unsigned.apk"
[ -f "$NEPODEPSANE" ] || NEPODEPSANE=$(ls -t "$KOREN"/android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1 || true)
[ -f "$NEPODEPSANE" ] || { echo "Sestavení nevytvořilo APK (android/app/build/outputs/apk/release)."; exit 1; }

echo "== 3/5 Podpis"
KS="${KP_KEYSTORE:-$(vlastnost kp.keystore)}"
if [ -z "$KS" ] || [ ! -f "$KS" ]; then
  KS=$(ls "$KOREN"/android/*.jks "$HOME"/kiosk.jks "$HOME"/Downloads/kiosk.jks "$HOME"/Documents/kiosk.jks "$HOME"/Desktop/kiosk.jks 2>/dev/null | head -1 || true)
fi
if [ -z "$KS" ] || [ ! -f "$KS" ]; then
  read -r -p "Kde je podpisový klíč kiosk.jks? (přetáhněte soubor sem do Terminálu a Enter): " KS
  KS=$(echo "$KS" | sed "s/^'//; s/'$//; s/\\\\ / /g")
  [ -f "$KS" ] || { echo "Soubor $KS neexistuje."; exit 1; }
  ano "Zapamatovat cestu ke klíči v android/local.properties (jen cesta, heslo ne)?" && echo "kp.keystore=$KS" >> "$LP"
fi
echo "Klíč: $KS"
BT=$(ls -d "$SDK"/build-tools/*/ 2>/dev/null | sort -V | tail -1)
[ -x "${BT}apksigner" ] || { echo "Chybí apksigner (Android Studio → SDK Manager → SDK Tools → Android SDK Build-Tools)."; exit 1; }
mkdir -p "$(dirname "$VYSTUP")"
ZAROVNANE="$KOREN/android/app/build/zarovnane.apk"
"${BT}zipalign" -f -p 4 "$NEPODEPSANE" "$ZAROVNANE"
echo "Zadejte heslo klíče (skrytě; když se zeptá dvakrát, je to heslo úložiště a heslo klíče):"
if ! "${BT}apksigner" sign --ks "$KS" --out "$VYSTUP" "$ZAROVNANE" 2>"$KOREN/android/app/build/podpis-chyba.txt"; then
  if grep -q "password was incorrect" "$KOREN/android/app/build/podpis-chyba.txt"; then echo "Špatné heslo klíče. Spusťte skript znovu (sestavení podruhé trvá pár sekund),"
  else cat "$KOREN/android/app/build/podpis-chyba.txt"; echo "Podpis se nepovedl."; fi
  echo "nebo aplikaci podepište v Android Studiu (pamatuje si heslo) a pak:  ./android/sestavit-aplikaci.sh --hotove"
  exit 1
fi
"${BT}apksigner" verify "$VYSTUP" >/dev/null && echo "Podpis v pořádku: $VYSTUP"

fi
# Stejný klíč jako aplikace na serveru? (otisk certifikátu – stejný výpočet jako QR kód zavedení, nastroje/novy-telefon/apk-podpis.js)
otisk() { node -e "import('$KOREN/nastroje/novy-telefon/apk-podpis.js').then(async()=>{const o=await KPAPK.otiskPodpisu(new Uint8Array(require('fs').readFileSync(process.argv[1])));console.log(o.otiskHex)}).catch((e)=>{console.log('?');})" "$1"; }
NOVY=$(otisk "$VYSTUP")
if [ ! -f "$SERVER_APK" ]; then
  echo "Aplikace ze serveru tu není – stahuji ji pro kontrolu podpisu…"
  curl -fsS -o "$SERVER_APK" https://kartapacienta.95-216-201-2.sslip.io/android/kartapacienta.apk || rm -f "$SERVER_APK"
fi
if [ -f "$SERVER_APK" ]; then
  STARY=$(otisk "$SERVER_APK")
  if [ "$NOVY" != "$STARY" ]; then
    echo "POZOR: nová aplikace je podepsaná JINÝM klíčem než aplikace na serveru."
    echo "  na serveru: $STARY"
    echo "  nová:       $NOVY"
    echo "Telefony by ji nepřijaly jako aktualizaci a vytištěný QR kód by pro ni neplatil. Použijte původní kiosk.jks. Končím."
    exit 1
  fi
  echo "Podpisový klíč je stejný jako u aplikace na serveru (QR kód i aktualizace v telefonech platí dál)."
fi

echo "== 4/5 Server"
cp "$VYSTUP" "$SERVER_APK"
if ano "Nasadit novou aplikaci na server teď (./deploy/vps-deploy.sh)?"; then ./deploy/vps-deploy.sh; else echo "Bez nasazení – později: ./deploy/vps-deploy.sh"; fi

echo "== 5/5 Telefony"
while ano "Nahrát aplikaci do telefonu na kabelu (ladění USB zapnuté)?"; do
  ./android/nahrat-telefon.sh "$VYSTUP" || echo "Nahrání se nepovedlo – výpis výše."
  echo
done
echo "Hotovo. Telefony u pacientů bez kabelu dostanou novou verzi až při příštím nahrání; nové telefony zaváděné QR kódem si ji stáhnou ze serveru samy."
