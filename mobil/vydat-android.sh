#!/usr/bin/env bash
# Průkaz pro Android – sestavení podepsaného APK (web) a AAB (Google Play) na Macu (náhradní cesta; běžně staví GitHub Actions, viz README).
# Potřebuje Android Studio (JDK a Android SDK) a podpisový klíč ~/Prukaz-android-klic/prukaz-release.p12.
#   PRUKAZ_KEYSTORE_PASSWORD='heslo' ./vydat-android.sh [versionCode]
set -euo pipefail
cd "$(dirname "$0")"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
[ -d "$ANDROID_HOME" ] || { echo "Chybí Android SDK ($ANDROID_HOME) – nainstalujte Android Studio z https://developer.android.com/studio"; exit 1; }
export PRUKAZ_KEYSTORE_FILE="${PRUKAZ_KEYSTORE_FILE:-$HOME/Prukaz-android-klic/prukaz-release.p12}"
[ -f "$PRUKAZ_KEYSTORE_FILE" ] || { echo "Chybí podpisový klíč $PRUKAZ_KEYSTORE_FILE (vytvoření viz README)"; exit 1; }
[ -n "${PRUKAZ_KEYSTORE_PASSWORD:-}" ] || { echo "Zadejte heslo klíče: PRUKAZ_KEYSTORE_PASSWORD='heslo' ./vydat-android.sh"; exit 1; }
npm install --no-audit --no-fund --silent
npx cap sync android
KOD="${1:-$(date +%y%m%d%H)}"
( cd android && chmod +x gradlew && ./gradlew assembleRelease bundleRelease -PversionCode="$KOD" --console=plain )
cp android/app/build/outputs/apk/release/app-release.apk ../public/prukaz/android/Prukaz.apk
cp android/app/build/outputs/bundle/release/app-release.aab ../public/prukaz/android/Prukaz.aab
VERZE=$(grep -o 'versionName "[^"]*"' android/app/build.gradle | sed 's/.*"\(.*\)"/\1/')
printf '{"verze":"%s","build":%s,"datum":"%s","commit":"%s"}\n' "$VERZE" "$KOD" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(git rev-parse --short HEAD)" > ../public/prukaz/android/verze.json
echo "Hotovo: public/prukaz/android/Prukaz.apk a Prukaz.aab (v$VERZE, build $KOD). Commit + push a ./deploy/vps-deploy.sh → ke stažení na https://kartapacienta.95-216-201-2.sslip.io/prukaz/android/"
