#!/usr/bin/env bash
# Průkaz pro plán péče pro iOS – příprava projektu na Macu (jen tady, Xcode je potřeba):
#   cd ~/Documents/Claude/Projects/CLB-Kartapacienta/mobil && ./pripravit.sh
# Nainstaluje Capacitor, zkopíruje úvodní stránku do projektu a otevře Xcode. Na nic se neptá.
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Chybí Node.js – nainstalujte z https://nodejs.org (LTS) a spusťte znovu."; exit 1; }
command -v xcodebuild >/dev/null || { echo "Chybí Xcode – nainstalujte z App Storu, jednou ho otevřete (souhlas s licencí) a spusťte znovu."; exit 1; }
echo "→ npm install (Capacitor)…"; npm install --no-audit --no-fund --silent
echo "→ cap sync ios (úvodní stránka + konfigurace do projektu)…"; npx cap sync ios
./scena-ios.sh ios/App   # scene lifecycle (povinné od SDK iOS 27, jinak pád při startu); opakovaně bez újmy
# číslo sestavení z času (vždy vyšší než minulé – App Store Connect odmítá stejné číslo podruhé: „Redundant Binary Upload“);
# verze (Version) zůstává, jak je nastavená v Xcode (General → Version)
SESTAVENI=$(date +%Y%m%d%H%M); PBX=ios/App/App.xcodeproj/project.pbxproj
sed -i '' -e "s/CURRENT_PROJECT_VERSION = [0-9.]*;/CURRENT_PROJECT_VERSION = $SESTAVENI;/g" "$PBX"
echo "→ číslo sestavení $SESTAVENI (verze $(grep -m1 -o 'MARKETING_VERSION = [0-9.]*' "$PBX" | cut -d' ' -f3))"
echo "→ otevírám Xcode…"; npx cap open ios
echo "Hotovo. V Xcode: App → Signing & Capabilities → Team (váš Apple Developer účet), pak ▶ na připojený iPhone, nebo Product → Archive pro TestFlight."
