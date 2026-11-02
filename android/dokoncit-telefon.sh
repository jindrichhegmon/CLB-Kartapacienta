#!/usr/bin/env bash
# Dokončení zavedení telefonu po QR kódu (Aligator S6600, Android 14): systémový průvodce Androidu po nastavení
# správce zařízení padá (chyba v jeho textech) a vrací se na skener QR kódu. Správce i aplikace už jsou v telefonu,
# tento skript jen průvodci oznámí, že nastavení je hotové, a telefon restartuje. Ladění USB zapnula aplikace sama
# při zavedení (Android 0.1.18+), takže stačí kabel a potvrzení dotazu na telefonu.
#   cd ~/Documents/Claude/Projects/CLB-Kartapacienta && ./android/dokoncit-telefon.sh
set -u
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
command -v adb >/dev/null || { echo "Chybí adb – nainstalujte Android Studio (obsahuje platform-tools)."; exit 1; }
BALIK=cz.centrumlb.kartapacienta

echo "Čekám na telefon…  (kabel do Macu, na Macu potvrdit „Povolit připojení příslušenství“, na telefonu „Povolit ladění USB“)"
stav=""
for i in $(seq 1 60); do
  stav=$(adb devices 2>/dev/null | awk 'NR==2 {print $2}')
  case "$stav" in
    device) break ;;
    unauthorized) echo "  → na telefonu potvrďte dotaz „Povolit ladění USB?“ (zaškrtnout „Vždy povolit z tohoto počítače“)" ;;
    "") echo "  → telefon není vidět: zkontrolujte kabel (datový, bez redukce), odpojte a připojte znovu; na Macu povolte příslušenství" ;;
    *) echo "  → stav telefonu: $stav (odpojte a připojte kabel)" ;;
  esac
  sleep 3
done
[ "$stav" = "device" ] || { echo "Telefon se nepřipojil. Zkuste jiný kabel nebo port a spusťte skript znovu."; exit 1; }

echo "Telefon připojen. Kontroluji správce zařízení…"
if ! adb shell dumpsys device_policy 2>/dev/null | grep -q "$BALIK"; then
  echo "Aplikace Karta pacienta NENÍ správcem zařízení – zavedení QR kódem neproběhlo celé."
  echo "Telefon resetujte (režim obnovy) a naskenujte QR kód znovu; pak spusťte tento skript."
  exit 1
fi
VERZE=$(adb shell dumpsys package "$BALIK" 2>/dev/null | grep -m1 versionName | tr -d ' \r')
echo "Správce zařízení: Karta pacienta ($VERZE). Oznamuji průvodci, že nastavení je hotové…"
adb shell settings put global device_provisioned 1
adb shell settings put secure user_setup_complete 1
echo "Hotovo – telefon se restartuje. Po startu klepněte na ikonu Karta pacienta: zapne se kiosk a ukáže okno Spárovat telefon s průkazem."
adb reboot
