#!/usr/bin/env bash
# Nahrání / aktualizace kioskové aplikace Karta pacienta kabelem – jeden příkaz, bez dalšího psaní:
#   cd ~/Documents/Claude/Projects/CLB-Kartapacienta && ./android/nahrat-telefon.sh            (release APK)
#   ./android/nahrat-telefon.sh cesta/k/jinemu.apk                                                (jiný soubor)
# Umí obojí: nový telefon (po průvodci, bez účtů – nastaví správce zařízení = kiosk) i telefon, který už kiosk je (jen nové APK).
# Potřebuje: Android Studio (adb), telefon na datovém kabelu, ladění USB zapnuté a potvrzené na telefonu.
set -u
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
cd "$(dirname "$0")/.."
command -v adb >/dev/null || { echo "Chybí adb – nainstalujte Android Studio (obsahuje platform-tools)."; exit 1; }
BALIK=cz.centrumlb.kartapacienta
APK="${1:-android/app/release/app-release.apk}"
[ -f "$APK" ] || { echo "Chybí $APK – v Android Studiu: Build → Generate Signed App Bundle / APK → APK → release."; exit 1; }

echo "Čekám na telefon…  (kabel do Macu, na Macu „Povolit připojení příslušenství“, na telefonu „Povolit ladění USB“)"
stav=""
for i in $(seq 1 60); do
  stav=$(adb devices 2>/dev/null | awk 'NR==2 {print $2}')
  case "$stav" in
    device) break ;;
    unauthorized) echo "  → na telefonu potvrďte dotaz „Povolit ladění USB?“ (zaškrtnout „Vždy povolit“)" ;;
    "") echo "  → telefon není vidět: datový kabel bez redukce, odpojit a připojit; na telefonu musí být zapnuté ladění USB" ;;
    *) echo "  → stav telefonu: $stav (odpojte a připojte kabel)" ;;
  esac
  sleep 3
done
[ "$stav" = "device" ] || { echo "Telefon se nepřipojil."; exit 1; }

echo "Telefon připojen. Nahrávám $APK…"
vysledek=$(adb install -r "$APK" 2>&1)
if ! echo "$vysledek" | grep -q "Success"; then
  echo "$vysledek"
  if echo "$vysledek" | grep -q "UPDATE_INCOMPATIBLE"; then
    echo "V telefonu je aplikace s jiným podpisem (ladicí verze). Nejdřív ji odeberte:"
    echo "  adb shell dpm remove-active-admin $BALIK/.AdminReceiver && adb uninstall $BALIK"
    echo "a spusťte skript znovu (telefon pak bude potřeba nastavit jako správce – skript to udělá, pokud v něm nejsou účty)."
  fi
  exit 1
fi
VERZE=$(adb shell dumpsys package "$BALIK" 2>/dev/null | grep -m1 versionName | tr -d ' \r')
echo "Nainstalováno ($VERZE)."

if adb shell dumpsys device_policy 2>/dev/null | grep -q "$BALIK"; then
  echo "Správce zařízení už je nastaven (kiosk)."
else
  echo "Nastavuji správce zařízení (kiosk)…"
  dpm=$(adb shell dpm set-device-owner "$BALIK/.AdminReceiver" 2>&1)
  echo "$dpm"
  if ! echo "$dpm" | grep -q "Success"; then
    echo "$dpm" | grep -q "accounts" && echo "V telefonu je účet (Google apod.) – odeberte ho v Nastavení → Účty a spusťte skript znovu."
    echo "$dpm" | grep -q "already set" && echo "Telefon spravuje jiná aplikace – pomůže jen tovární reset."
    exit 1
  fi
fi

adb shell am force-stop "$BALIK" >/dev/null 2>&1
adb shell am start --user 0 -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "$BALIK/.MainActivity" >/dev/null 2>&1
echo "Karta spuštěna. Na telefonu zkontrolujte: kiosk (bez tlačítka Domů) a v servisu verzi $VERZE."
