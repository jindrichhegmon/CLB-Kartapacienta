# Průkaz pro plán péče (Dialogus, zadání MUDr. Kabelky) – aplikace pro Android (Capacitor)

Nativní obal stránky **Průkaz pro plán péče** (`/prukaz/` serveru Karty pacienta) – osobní zdravotní karta, jejíž data
zůstávají jen v telefonu, zašifrovaná PINem. Aplikace v okně (WebView) otevře `https://kartapacienta.95-216-201-2.sslip.io/prukaz/`;
stránka se po prvním otevření uloží i pro provoz bez internetu. Změny stránky na serveru se do aplikace dostanou samy,
nový build je potřeba jen při změně obalu (ikona, název, adresa serveru, oprávnění).

- `applicationId cz.centrumlb.planpece`, název na ploše „Plán péče“, jen na výšku, Android 7+ (minSdk 24), cíl API 36.
- Oprávnění jen INTERNET. Výběr souboru (obnova ze zálohy, přiložení zprávy/fotky) řeší Capacitor.
- `android:allowBackup="false"` – obsah karty se nezálohuje automaticky do Googlu (karta slibuje, že nic neodchází);
  zálohu dělá pacient sám v části Bezpečnost a obnova.
- Nezaměňovat s `prukaz-android/` (Karta pacienta pro domácnost – Můj průkaz, `/pacient/`, párování kódem)
  ani s `android/` (kiosková aplikace zapůjčeného telefonu).

## Co obal doplňuje (MainActivity.java)

WebView Androidu neumí stahovat soubory přes `<a download href="blob:…">` ani `window.print()`. Aplikace proto do stránky
na začátku načtení vloží malý skript (jen pro adresu serveru Karty):

- **Záloha karty a export souboru** → systémová nabídka *Sdílet* (uložit na Disk Google, do Souborů, poslat e-mailem…),
- **PDF / tisk** → systémový tisk Androidu (volba *Uložit jako PDF*).

## Sestavení

GitHub Actions → *Android – Plán péče* → *Run workflow* (spustí se i sám po změně v `planpece-android/` na `main` nebo
`claude/*`). Podepisuje se stejným klíčem pro nahrávání jako Můj průkaz (Secrets `PRUKAZ_KEYSTORE_B64`,
`PRUKAZ_KEYSTORE_PASSWORD`, alias `mujprukaz`, postup v `prukaz-android/README.md`). Artefakty běhu:

- `PlanPece-android-<číslo>` – podepsané APK pro instalaci na telefon (povolit instalaci z neznámého zdroje),
- `PlanPece-google-play-<číslo>` – AAB pro Play Console (nová aplikace, např. „Průkaz pro plán péče“; zásady soukromí
  `https://kartapacienta.95-216-201-2.sslip.io/ochrana-soukromi.html`, kategorie Zdravotnictví).

Další verze: zvýšit `versionName` v `android/app/build.gradle`; `versionCode` = číslo běhu workflow.
