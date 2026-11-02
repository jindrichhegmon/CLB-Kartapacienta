#!/usr/bin/env bash
# Uloží vše potřebné pro nahrání karty na nový telefon do jedné složky (např. Dropbox) – návody, skripty a, pokud jsou
# na tomto Macu, i release APK a QR kód. Spustit z kořene repozitáře, nebo přes jednorázový klon (viz README v cílové složce).
#   ./android/ulozit-postup.sh "/Users/…/Data room Dropbox/Centrum LB/Karta pacienta 2026"
set -eu
CIL="${1:?Zadejte cílovou složku, např. \"$HOME/Data room Dropbox/Centrum LB/Karta pacienta 2026\"}"
cd "$(dirname "$0")/.."
[ -d "$CIL" ] || { echo "Složka $CIL neexistuje – zkontrolujte cestu (Dropbox musí být na tomto Macu)."; exit 1; }
D="$CIL/Nový telefon – postup a nástroje"
mkdir -p "$D/Skripty pro Mac" "$D/Aplikace"

cp docs/postup-telefon-kolegyne.docx docs/postup-telefon-kolegyne.pdf "$D/"
cp docs/postup-novy-telefon.md docs/postup-novy-telefon.pdf "$D/"
cp android/dokoncit-telefon.sh android/nahrat-telefon.sh android/provisioning-qr.mjs "$D/Skripty pro Mac/"
cp android/README.md "$D/Skripty pro Mac/README-android.md"
mkdir -p "$D/Pro počítač s Windows"
cp android/windows/dokoncit-telefon.cmd android/windows/nahrat-telefon.cmd android/windows/CTI-ME-Windows.txt "$D/Pro počítač s Windows/"
[ -f android/app/release/app-release.apk ] && cp android/app/release/app-release.apk "$D/Pro počítač s Windows/kartapacienta-release.apk"
chmod +x "$D/Skripty pro Mac/"*.sh

[ -f android/app/release/app-release.apk ] && cp android/app/release/app-release.apk "$D/Aplikace/kartapacienta-release.apk" && echo "  + release APK"
[ -f android/provisioning-qr.html ] && cp android/provisioning-qr.html "$D/Aplikace/provisioning-qr.html" && echo "  + QR kód (obsahuje heslo Wi‑Fi)"

cat > "$D/ČTI MĚ.txt" <<TXT
Karta pacienta on-line – nový telefon (Aligator S6600)
Uloženo $(date '+%d. %m. %Y %H:%M') z repozitáře CLB-Kartapacienta (větev $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo ?), commit $(git rev-parse --short HEAD 2>/dev/null || echo ?)).

CO TU JE
- postup-telefon-kolegyne.docx / .pdf  – návod krok za krokem (reset, QR, kabel, dokončení, kiosk). ZAČNĚTE TÍMTO.
- postup-novy-telefon.md / .pdf        – úplný technický návod (kabel, QR, aktualizace, řešení potíží).
- Skripty pro Mac/dokoncit-telefon.sh  – krok 4 návodu: dokončí nastavení telefonu po QR kódu.
- Skripty pro Mac/nahrat-telefon.sh    – nahrání / aktualizace aplikace kabelem jedním příkazem.
- Skripty pro Mac/provisioning-qr.mjs  – vytvoří QR kód pro nastavení telefonu.
- Aplikace/                            – release APK a QR kód, pokud byly na Macu, odkud se ukládalo.
- Pro počítač s Windows/               – totéž pro PC s Windows: dokoncit-telefon.cmd a nahrat-telefon.cmd na dvojklik;
                                         spouštět přímo z Dropboxu, postup v CTI-ME-Windows.txt.

DŮLEŽITÉ
- Skripty se spouštějí z repozitáře CLB-Kartapacienta na Macu s Android Studiem (adb):
    cd ~/Documents/Claude/Projects/CLB-Kartapacienta && ./android/dokoncit-telefon.sh
  Kopie ve složce Skripty pro Mac slouží jako záloha a pro předání postupu kolegům.
- Při připojení kabelu potvrdit na Macu „Povolit připojení příslušenství“ a na telefonu „Povolit ladění USB“.
- QR kód (Aplikace/provisioning-qr.html) obsahuje heslo Wi‑Fi – nesdílet mimo tým.
- Podpisový klíč aplikace (kiosk.jks) a servisní PIN sem NEPATŘÍ – jsou jen u Jindřicha Hegmona.
- Aktuální APK je vždy i na https://kartapacienta.95-216-201-2.sslip.io/android/kartapacienta.apk

Kontakt: Jindřich Hegmon, jindrich.hegmon@centrumlb.cz – krok 4 dělá až do odvolání on.
TXT
echo "Hotovo: $D"
ls -la "$D" "$D/Skripty pro Mac" "$D/Aplikace"
