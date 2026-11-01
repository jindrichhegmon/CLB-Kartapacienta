# Google Play – založení aplikace „Dialogus – Průkaz pacienta“ (krok za krokem)

Vše potřebné je ve složce `mobil/play/` (ikona, feature graphic, snímky obrazovek) a v `mobil/appstore-texty.md` (texty).
Balíček `Prukaz.aab` vznikne z GitHub Actions (viz `mobil/README.md`, Secrets) a je ke stažení na
https://kartapacienta.95-216-201-2.sslip.io/prukaz/android/Prukaz.aab po nasazení Karty.

Potřeba: účet vývojáře Google Play (https://play.google.com/console, jednorázově 25 USD, ověření identity organizace –
Centrum pro léčbu bolesti a paliativní medicínu s.r.o., IČO, adresa, telefon; u organizace ověření D-U-N-S číslem).

## 1. Vytvořit aplikaci
Play Console → **Create app**: App name `Dialogus – Průkaz pacienta`, Default language `Czech – cs-CZ`, App (ne Game), Free.
Potvrdit prohlášení (Developer Program Policies, US export laws) → **Create app**.

## 2. Dashboard → „Set up your app“ (každý řádek otevřít a vyplnit)
- **Privacy policy**: `https://kartapacienta.95-216-201-2.sslip.io/prukaz/ochrana-soukromi.html`
- **App access**: *All functionality is available without special access* (není přihlášení). Do poznámky pro recenzenty:
  „Tlačítko Otevřít ukázku zobrazí kartu se smyšlenými daty bez PINu.“
- **Ads**: No, the app does not contain ads.
- **Content rating**: e-mail kontakt, kategorie *Utility, Productivity, Communication, or Other*; všechny otázky na násilí,
  sexuální obsah, hazard, drogy, uživatelský obsah → No. Vyjde rating „Everyone / PEGI 3“.
- **Target audience**: 18 and over (zdravotní údaje); *Appeal to children* → No.
- **News app**: No. **COVID-19 contact tracing / status**: No. **Government app**: No. **Financial features**: None.
- **Data safety**: *Does your app collect or share any of the required user data types?* → **No**. Doplňující otázky:
  data jsou šifrována při přenosu (Yes – HTTPS), uživatel může požádat o smazání (Yes – smaže sám v aplikaci).
  Výsledek: „No data collected, no data shared“.
- **Health apps** (prohlášení): aplikace obsahuje zdravotní funkce → *Yes*; typ: *Other health and medical features /
  personal health record*; žádná regulovaná funkce (není zdravotnický prostředek, nic nediagnostikuje).
- **App category**: Application → **Medical**. Tags: Health, Medical records. Contact details: e-mail
  `jindrich.hegmon@centrumlb.cz`, telefon, web `https://kartapacienta.95-216-201-2.sslip.io/prukaz/`.
- **Store listing** (Main store listing):
  - App name: `Dialogus – Průkaz pacienta`
  - Short description (80): `Diagnózy, léky, dokumenty, přání a krizová karta – jen ve vašem telefonu.`
  - Full description: oddíl *Popis* z `appstore-texty.md`
  - App icon: `play/ikona-512.png` (512×512) · Feature graphic: `play/feature-graphic-1024x500.png`
  - Phone screenshots: `play/snimek-1…8` (nahrát aspoň 2, doporučuji všech 8 v tomto pořadí)
  - 7-inch / 10-inch tablet screenshots: nepovinné (lze nahrát stejné)

## 3. Podpis a první vydání
- **Play App Signing** (Setup → App integrity): nechat Google spravovat podpisový klíč (výchozí). Náš klíč z GitHub Secrets je
  *upload key*; AAB podepsané tímto klíčem Play přijme.
- **Testing → Internal testing** → *Create new release* → nahrát `Prukaz.aab` → Release name = verze (0.1.0) → Save → Review release
  → **Start rollout to Internal testing**. Záložka *Testers* → vytvořit seznam e-mailů (do 100), uložit, zkopírovat
  **odkaz pro testery** a poslat jim ho (musí ho otevřít na telefonu s účtem Google ze seznamu, pak *Nainstalovat*).
  Interní test nevyžaduje recenzi Googlu – aplikace je testerům k dispozici během minut.
- **Closed testing** (povinné před produkcí u nových účtů): 12 testerů po 14 dní; pak žádost o přístup k produkci.
- **Production**: po splnění testu *Create new release* → nahrát AAB → Review → Start rollout. První recenze trvá 1–7 dní.

## 4. Aktualizace
Obsah Průkazu se mění nasazením Karty pacienta, bez nového vydání. Nový AAB (vyšší versionCode = číslo běhu GitHub Actions)
jen při změně obalu – nahrát do stejné stopy (Internal / Production) → rollout.
