# Android aplikace Průkazu pro plán péče

Průkaz (`/prukaz/`) je PWA – na Androidu jde nainstalovat rovnou z Chromu (⋮ → *Přidat na plochu* / *Instalovat aplikaci*),
na iPhonu ze Safari (*Sdílet* → *Přidat na plochu*). Pro testery bez nastavování a pro Google Play se z něj dělá
**Trusted Web Activity** (TWA): malá nativní aplikace, která otevře web Průkazu přes celou obrazovku bez adresního řádku.
Obsah zůstává na webu – každé nasazení Karty pacienta je hned i v aplikaci, APK se nepřekládá znovu.

## A. Nejrychleji: PWABuilder (bez vývojářských nástrojů)

1. Otevřete https://www.pwabuilder.com a zadejte `https://kartapacienta.95-216-201-2.sslip.io/prukaz/`.
2. *Package for stores* → **Android**. Vyplňte: Package ID `cz.dialogus.prukaz`, App name `Průkaz pro plán péče`,
   Launcher name `Průkaz`, Version `0.1.0`, Display `standalone`, Start URL `/prukaz/`. Podpis: *Create new* (první vydání).
3. Stáhne se ZIP: `*.apk` (pro testery přímo do telefonu), `*.aab` (pro Google Play), `signing.keystore` + `signing-key-info.txt`
   a `assetlinks.json`. **Keystore a heslo uschovejte** – bez nich nejde vydat aktualizaci na Google Play.
4. Z `assetlinks.json` (nebo z `signing-key-info.txt`) vezměte otisk `sha256_cert_fingerprints` a na VPS ho zapište do `.env`
   Karty pacienta (viz níže). Bez toho aplikace funguje, ale Chrome v ní ukáže adresní řádek.

## B. Bubblewrap (vývojář s JDK 17+ a Android SDK)

```bash
npm i -g @bubblewrap/cli
cd android && bubblewrap init --manifest https://kartapacienta.95-216-201-2.sslip.io/prukaz/manifest.webmanifest   # nebo použít twa-manifest.json
bubblewrap build        # vytvoří app-release-signed.apk a app-release-bundle.aab, poprvé vygeneruje android.keystore
bubblewrap fingerprint list   # otisk SHA-256 pro assetlinks
```

`twa-manifest.json` v této složce je připravený (balíček `cz.dialogus.prukaz`, barvy, ikony, start URL). Keystore do gitu nepatří.

## C. Otisk klíče na server (Digital Asset Links)

Server vrací `/.well-known/assetlinks.json` z proměnné `KP_ANDROID_SHA256` (více otisků oddělených čárkou) a `KP_ANDROID_BALIK`
(výchozí `cz.dialogus.prukaz`). Na Macu:

```bash
ssh -i ~/.ssh/id_ed25519_jhnapps root@95.216.201.2 "echo 'KP_ANDROID_SHA256=AA:BB:…:ZZ' >> /opt/clb-kartapacienta/.env && su - jhnapps -c 'pm2 restart clb-kartapacienta'"
curl https://kartapacienta.95-216-201-2.sslip.io/.well-known/assetlinks.json
```

## D. Testování

- **APK testerům**: soubor pošlete (Disk, mail); v telefonu *Nastavení → Zabezpečení → Instalace neznámých aplikací* povolit pro
  aplikaci, ze které se APK otevírá. Ikona *Průkaz* se objeví mezi aplikacemi.
- **Google Play, interní testování**: Play Console → aplikace → *Testing → Internal testing* → nahrát `.aab`, přidat e-maily
  testerů (do 100), odeslat odkaz. Pro ostré vydání projít *Data safety* (data zůstávají v zařízení, nic se neodesílá) a
  kategorii *Health*.
- Po změně obsahu Průkazu se nic nepřebaluje – stačí nasadit Kartu pacienta.
