# CLB-Kartapacienta – Karta pacienta (paliativní průkaz)

Krizový plán péče, který má pacient vždy u sebe. Garant zavede pacienta v centrální aplikaci,
telefon u lůžka s ní komunikuje šifrovaně, ukazuje poslední stav i bez připojení a při každém
připojení se sesynchronizuje. Dotazy na AI jsou vždy anonymní.

**Živě:** https://kartapacienta.95-216-201-2.sslip.io (VPS Hetzner, pm2 `clb-kartapacienta`, port 3120, Caddy)

| Aplikace | Adresa | Pro koho |
|---|---|---|
| Správa tenantů | `/tenanti/` | provozovatel platformy – založení organizace jedním formulářem |
| Centrální aplikace | `/centrala/?t=<IDTENANT>` | garant a tým kolem pacienta (nemocnice, hospic, PL, domov) |
| Karta na mobil | `/karta/` | zapůjčený telefon u lůžka (PWA, offline, šifrovaná data) – **jeden pacient, jen v telefonu s číslem uvedeným u pacienta** |
| Můj průkaz | `/pacient/` | vlastní telefon soběstačného pacienta (PWA) – data od lékaře jen ke čtení, vlastní přání, léky a poznámky jen v telefonu |

Vše startuje z jednoho serveru (`src/server.js`), zatím ne z Netlify. Make se nepoužívá.
Od 0.2.0 je to ostrá verze: lokální prototyp `/demo/` je zrušený (adresa přesměruje na úvod) a nový tenant se zakládá bez ukázkových dat.

## Ostrá verze (0.2.0) – jeden telefon na pacienta, načtení z PéčeDoma

- **Telefon s kartou:** u každého pacienta je povinné číslo telefonu, na kterém bude karta (`A_KP_Pacient.TelefonKarty`,
  normalizované `+420…`, `src/telefon.js`). Telefon se spáruje jen tehdy, když při párování zadá **stejné číslo**
  (`/api/d/parovat { tenant, kod, telefon }`) – jiné číslo server odmítne. Spárovaný telefon si číslo pamatuje
  (`A_KP_Zarizeni.Telefon`). Při změně čísla v Údajích se telefon spárovaný s předchozím číslem zablokuje (při připojení se
  vymaže). Jako dosud platí: nový telefon zablokuje předchozí, takže karta je vždy jen v jednom telefonu.
- **SMS s odkazem:** v záložce Telefon a PINy tlačítko „Poslat odkaz SMS na …“ (a totéž v okně „Spárovat telefon“) vydá
  párovací kód a pošle odkaz SMS přímo na číslo s kartou (Twilio, proměnné `TWILIO_*` jako jhn-apps; když v `.env` karty
  chybí, server je přečte z `/opt/jhn-apps/.env`, odesílací číslo výchozí `+420736354150`). Stav ukazuje `/api/health` → `sms`.
  Když SMS nejde, okno napíše proč a páruje se QR kódem a potvrzením čísla.
  Údaje k Twiliu (Account SID, Auth Token z console.twilio.com) na VPS nastaví `./deploy/set-twilio.sh` – zapíše je do `.env` karty i jhn-apps a obě restartuje.
- **Načtení z PéčeDoma:** v průvodci „Nový pacient“ tlačítko **Načíst soubor JSON** převezme soubor z portálu PéčeDoma
  (Data klienta → Export pro Kartu pacienta, `format: 'CLB-Kartapacienta/pacient'`): údaje pacienta, diagnózy, léky, funkční
  stav a kontakty. Lékař zkontroluje a doplní cíl péče, limitace a číslo telefonu s kartou (předvyplněný je telefon klienta).
- **QR kód přímo v aplikaci (0.2.2):** na úvodní obrazovce karty tlačítko **Načíst QR kód fotoaparátem** (BarcodeDetector, na iPhonu
  `public/shared/jsqr.min.js`, jsQR 1.4.0, Apache-2.0). Na iPhonu má aplikace přidaná na plochu vlastní úložiště, proto se páruje až v ní –
  karta to v Safari připomene.
- Migrace `sql/03_kp_telefon_karty.sql` (idempotentní) přidá sloupce `TelefonKarty` a `Telefon`.

## Chat PéčeDoma a návštěva v kartě (0.8.0)

- **Nejbližší návštěva** z PéčeDoma je oddíl krizové karty (`KP.kartaHTML`, `.sec.green`) – centrála, telefon (i zamčený pro ZZS), Můj průkaz, tisk.
  `balikZDetailu` i `balikProZarizeni` předávají `pecedoma` (sync + `chat`).
- **Chat PéčeDoma s klientem** = vlákno `A_MSPPP_Zprava` portálu (Data klienta → Zprávy) přes jhn-apps `pecedoma-karta` akce `zpravy` / `zprava`
  (partnerský klíč; text dostane značku `[Karta · kdo]`, portál a aplikace klienta ji vidí). Centrála: `GET /api/c/pacient/:id/pecedoma/zpravy`,
  `POST …/pecedoma/zprava` (tým kolem pacienta, OD_TYMU, kdo = jméno uživatele). Telefony: `GET /api/d/pecedoma/zpravy`, `POST /api/d/pecedoma/zprava`
  (token zařízení; OD_PACIENTA; zapůjčený telefon píše pod rolí a jménem odemknutí, Můj průkaz jako „pacient“). Telefon token PéčeDoma nikdy nedostane,
  vše jde přes server Karty, každé zobrazení a odeslání je v auditu. Společné okno `KP.chatOkno` v `public/shared/kp.js`.
- Telefon: tlačítko **Přidat kartu na plochu telefonu** na obrazovce párování (Android/Chrome, `beforeinstallprompt`).
- 0.8.3: minimum textů na obrazovce – `KP.sbalVysvetlivky(root)` přesune `.note` a `.rolehelp` (bez třídy `keep`) na konec do sbaleného bloku `<details class="vysv">` „Vysvětlivky“; telefon, Můj průkaz (všechny obrazovky) i detail pacienta v centrále; tisk blok skrývá.
- 0.8.2: chat na zablokovaném či odpojeném telefonu vrací 403 se srozumitelnou hláškou (GET i POST) a telefon hned spustí sync, aby ukázal obrazovku „Lékař ukončil přístup“.
- 0.8.1: v Mém průkazu je chat na hlavní stránce pod krizovou kartou jako **Zprávy pro a od lékaře** (`KP.chatOkno` bere `nazvy` stran: „Vy“ / „Lékař a tým“).

## Propojení s PéčeDoma (0.7.0)

- **Nastavení** (Správa organizace → Nastavení → Propojení s PéčeDoma, `A_KP_Nastaveni`): `PD_ODKAZ` (adresa portálu organizace – ukazuje se
  u pacienta), `PD_API` (server jhn-apps, výchozí `https://95-216-201-2.sslip.io`), `PD_TOKEN` (x-app-token aplikace, do prohlížeče se nevrací),
  `PD_SYNC` (automatická synchronizace). Server se PéčeDoma prokazuje navíc `KP_PARTNER_KLIC` (`klic` v těle) – `src/pecedoma.js`.
- **Výběr klienta** v průvodci Nový pacient (`GET /api/c/pecedoma/klienti?q=`, `GET /api/c/pecedoma/klient/:id` → stejný JSON jako soubor
  Export pro Kartu pacienta); pacient si pamatuje `A_KP_Pacient.PdKlientID` (i při načtení ze souboru – `puvod.famicuraKlientId`).
- **Synchronizace** propojených pacientů (`A_KP_PdSync`): aktivní léky (SOS, pravidelné) a nejbližší plánovaná návštěva z kalendáře FK
  (kdy, lékař/sestra, služba · stav · místo). Automaticky po startu a každých 30 min (tenanti s `PD_SYNC=1`, `KP_PECEDOMA_SYNC=0` vypne),
  ručně tlačítkem u pacienta (Údaje → PéčeDoma), při založení a propojení. **Plán péče se nemění** – léky z PéčeDoma se ukazují vedle plánu
  (centrála, telefon, Můj průkaz) a lékař je tlačítkem převezme do formuláře nové verze. Návštěva je v Krizové kartě a na telefonu.
- Druhá strana: jhn-apps `pecedoma-karta` (akce `klienti`, `klient`, `sync` s partnerským klíčem), `pecedoma-famicura` exportuje `sestavKartu`.
- Migrace `sql/01d_kp_pecedoma.sql`.

## Dva režimy telefonu a doklad k limitacím (0.5.0)

- **Zapůjčený telefon** (`/karta/`, `A_KP_Zarizeni.Rezim = 'ZAPUJCENY'`) – beze změny: telefon garanta jen s kartou, ZZS bez PINu, tým osobními PINy.
- **Můj průkaz** (`/pacient/`, `Rezim = 'PACIENT'`) – podle připomínek MUDr. Kabelky:
  - garant nebo lékař v týmu v Telefon a PINy → **Zpřístupnit pacientovi v jeho telefonu** (`POST /api/c/pacient/:id/pacientovi { telefon, sms }`):
    kód jen pro číslo pacienta (uložené v `A_KP_Zarizeni.Telefon`), SMS s odkazem `/pacient/#p=…` nebo QR v ordinaci, platí 3 dny;
  - telefon pacienta dostane plán, kontakty a tým (`balikProZarizeni(…, { rezim: 'PACIENT' })`) – **bez deníku, PINů týmu a tajemství kódu lékaře**,
    do deníku nezapisuje; „Ukončit přístup“ → při synchronizaci `{ prikaz: 'odpojit' }`, nic se nemaže (kopie pacienta, § 65);
  - vlastní záznamy pacienta (hodnoty a přání s původem, léky, které skutečně užívá, poznámky a otázky) jsou **jen v telefonu**, šifrované dvakrát
    (PBKDF2 z PINu pacienta 310 000 iterací + nevyexportovatelný klíč telefonu); zapomenutý PIN nikdo neobnoví;
  - **Sdílet**: výběr → náhled s datem vytvoření a původem každé položky → tisk/PDF, poslat jinam (Web Share) nebo **poslat týmu**
    (`POST /api/d/sdilet` → `A_KP_Sdileni`, jen doplňovat, + zápis „Sdíleno pacientem“; v centrále panel **Od pacienta** v Krizové kartě);
  - **Nouzové info**: připravený text do Zdravotního ID na zamčené obrazovce (iPhone, Android).
- **Doklad k limitacím** (`normalizujDoklad` v `src/kp.js`, `KP.dokladHTML`): u DVP písemné poučení lékařem, úředně ověřený podpis, nebo
  „sepsáno při přijetí u poskytovatele“ (karta pro ZZS napíše, že platí jen tam). Vyplnění v aplikaci DVP nevytváří – formulář to říká.
- **Dokumenty** mají datum a pracoviště, které je vydalo (původ informace).
- Migrace `sql/01c_kp_pacient.sql` (před `02_kp_rls.sql`): `Rezim`, `A_KP_Sdileni` s triggerem jen pro doplňování, `DatumDokumentu`, `Pracoviste`.

## Lidé a týmy, role na kartě (0.4.0)

- **Lidé a týmy** (menu v centrále, `A_KP_Osoba`): každé pracoviště – garant i partner (domov, PL) – zapíše své lidi **jednou** a rozdělí do týmů;
  ručně, z **CSV** (jméno; role; telefon; e-mail; tým – UTF-8 i Windows-1250) nebo **z PéčeDoma** (`A_MSPPP_UzivatelSestra` ve stejné databázi
  a tenantu). Každý dostane **osobní PIN** (zobrazí se jednou, tisk kartiček, volitelně SMS), který platí u všech pacientů, ke kterým je přiřazen.
- **Přiřazení k pacientovi** (`A_KP_PacientOsoba`, detail → Telefon a PINy → Přiřadit lidi z týmů): celý tým nebo jednotlivci z pracovišť v týmu
  kolem pacienta; garant a lékař kohokoli, partner své lidi. Odchod pracoviště z týmu přiřazení zruší. Telefon dostane PINy přiřazených lidí v balíku.
- **Role na kartě** jako v demu: lékař, praktický lékař, hospic, sestra DPS (osobní PIN), rodina (PIN u pacienta), ZZS (bez PINu, jméno a posádka
  povinně až u výjezdu). Po odemknutí telefon ukáže, co role smí; typy zápisů = `POVOLENE` v `src/routes/device.js` (test hlídá shodu).
- Migrace `sql/01b_kp_lide.sql` běží před `02_kp_rls.sql`, takže indexy a RLS doplní tentýž běh.

## Standard aplikací (0.3.0) – nápověda, chat a vzhled jako PéčeDoma

- **📖 Nápověda** ve všech aplikacích: návod s obrázky (`napoveda/napoveda.md`, 19 kapitol, snímky v `public/napoveda/img`),
  obsah vlevo, otevře se na kapitole k aktuální obrazovce, klik zvětší obrázek, **🖨 Tisk** / Uložit jako PDF. Na telefonu funguje i offline.
- **💬 Chat nad návodem** (`POST /api/napoveda/dotaz`, `src/routes/napoveda.js`): Claude odpovídá jen podle návodu a odkáže na kapitolu;
  jen pro přihlášené (session centrály / správy tenantů) a spárované telefony; dotazy jdou přes anonymizační bránu; bez `ANTHROPIC_API_KEY`
  odpoví lokální hledání v návodu. V centrále modré **?** vlevo dole.
- **🎨 Vzhled**: 10 barevných schémat jako v PéčeDoma (Karta modrá – výchozí, v noci tmavá podle systému –, PéčeDoma Plus zelená, Datec modrá,
  Veselá, Konzervativní, Letní, Zimní, Podzimní, Jarní, Tmavá); pamatuje se na zařízení (`localStorage kp_vzhled`). Společný modul `public/shared/kp-napoveda.js`.
- **Snímky do návodu** se smyšlenými daty, bez databáze: `node scripts/napoveda-snimky.mjs` (Playwright) a `python3 scripts/napoveda-zmensit.py` (256 barev).

## Tenanti – stejný princip jako Péče doma Plus

- Databáze **PeceDomaPlus** (Srv-MPerfect), sdílená tabulka `dbo.Tenants` (IDTENANT `char(16)` = IČO + 8 písmen).
- 14 tabulek **`A_KP_*`**, v každé první sloupec `IDTENANT` s `DEFAULT SESSION_CONTEXT('IDTENANT')`, FK na `Tenants`,
  index `IX_<tabulka>_Tenant` a FILTER + BLOCK predikát v `sec.TenantPolicy` (Row-Level Security).
- Server každou operaci spouští v transakci, která nejdřív nastaví `sp_set_session_context 'IDTENANT'`
  (`src/db.js → vTenantu`). Bez kontextu databáze nevrátí nic, `'*'` je správcovský režim (jen správa tenantů a migrace).
- **Tenant = organizace, která provozuje síť karet** (např. Nadace Most k domovu Zlín pro kraj, nebo jeden hospic).
  Uvnitř tenanta jsou pracoviště (`A_KP_Poskytovatel`: nemocnice, hospic, ambulance, PL, domov, ZZS), uživatelé,
  pacienti, garance a tým kolem pacienta – předání pacienta mezi pracovišti tak zůstává uvnitř RLS.
- **Snadné založení tenanta** (`/tenanti/` → „Založit tenanta“): IČO (název a adresa z ARES), typ prvního pracoviště,
  jméno a login správce. Vznikne tenant (nebo se použije existující se stejným IČO, např. CLB
  `02570459DSIDEQAJ`), první pracoviště, správce s vygenerovaným heslem a odkaz pro přihlášení + text k odeslání.

### Tabulky

| Tabulka | Obsah |
|---|---|
| `A_KP_Nastaveni` | `KP_AKTIVNI`, `NAZEV_SITE`, `INTERVAL_REVIZE` |
| `A_KP_Poskytovatel` | pracoviště; `SmiBytGarant` = nemocnice, hospic, ambulance, PL (domov ne) |
| `A_KP_Uzivatel` | login (unikátní v tenantu), scrypt hash, role `admin,lekar,sestra,ctenar` |
| `A_KP_Pacient` | identita (jen v centrále), kód průkazu `P-0001`, stav |
| `A_KP_Garance` | garant: `NAVRZENO → PLATNA → UKONCENA` / `ODMITNUTO`; vždy max. 1 platná (filtrovaný unikátní index) |
| `A_KP_Tym` | tým kolem pacienta: `GARANT`, `LEKAR`, `PECE`, `HOST` |
| `A_KP_PlanVerze` | plán péče jako JSON, neměnné verze s podpisem lékaře |
| `A_KP_Kontakt` | `ROZHODUJE` / `INFORMOVAT` / `PECUJE` |
| `A_KP_Denik` | jen doplňovat (trigger brání UPDATE/DELETE), UUID z telefonu = idempotentní sync |
| `A_KP_Zarizeni` | telefony: párovací kód, SHA-256 tokenu, šifrované tajemství pro kód lékaře, poslední sync, baterie |
| `A_KP_Pin` | PINy pečujících (PBKDF2-SHA256, ověřuje i telefon offline) |
| `A_KP_Dokument` | DVP, zprávy (varbinary) |
| `A_KP_AuditLog` | neměnný log přístupů |
| `A_KP_AIDotaz` | log dotazů na AI bez obsahu (délka, počet anonymizovaných údajů, blokováno) |

DDL: `sql/01_kp_tabulky.sql`, `sql/02_kp_rls.sql` (idempotentní, `npm run migrate`).

## Bezpečnost a soukromí

- Prohlížeč neposílá žádné SQL – všechny dotazy jsou pevně na serveru a vázané na přihlášenou session (HMAC, 12 h).
- Přístup k pacientovi jen pro pracoviště v týmu kolem pacienta (nebo správce tenanta); plán mění jen lékař garanta / lékař v týmu.
- Telefon: token zařízení (v DB jen SHA-256), data v IndexedDB šifrovaná AES-GCM klíčem, který nejde vyexportovat;
  zablokovaný telefon se při připojení vymaže; nový telefon automaticky zablokuje předchozí.
- Kód lékaře = **kód dne** (od 0.6.0): HMAC-SHA256(tajemství telefonu, `kod-dne:RRRR-MM-DD` v Europe/Prague), 6 číslic, celý kalendářní
  den stejný → telefon ho ověří offline (přijme i včerejší kvůli půlnoci); zobrazení se loguje. Stejný kód vrací partnerské API
  `GET /api/partner/kod-dne?tenant=&rc=&kdo=` (hlavička `x-partner-klic` = `KP_PARTNER_KLIC`) – používá ho PéčeDoma (jhn-apps
  `pecedoma-karta`, `.env`: `KARTA_URL`, `KARTA_PARTNER_KLIC`, `KARTA_TENANT`; doplní `deploy/vps-deploy.sh`) v Datech klienta.
- Tlačítka na zamčené kartě (0.6.0): **Přístup rodina** (PIN od garanta), **Přístup tým** (osobní PIN: sestra DPS, hospic, PL, lékař),
  **Lékař bez PINu** (kód dne); ZZS nic nezadává.
- **AI jen anonymně** (`src/anonym.js`): e-maily, známé identifikátory pacienta (jméno ve všech pádech, RČ, datum narození,
  adresa, telefony, jména kontaktů), pak vzory (RČ, data, telefony, PSČ, IČP, tituly + jména, příbuzní + jména).
  Rok narození → věkové rozmezí. Když po anonymizaci zůstane něco podobného identifikátoru, dotaz se neodešle.
  Fotka zprávy se převádí na text v prohlížeči (tesseract.js), k AI jde jen anonymní text. Bez `ANTHROPIC_API_KEY` běží lokální rozbor.

## Vývoj

```bash
cp .env.example .env    # doplnit heslo DB, KP_SECRET, KP_ADMIN_HESLO
npm install
npm test                # anonymizace, TOTP, PIN, hesla, session
npm run migrate         # tabulky A_KP_* (potřebuje přístup na SQL – jen z VPS)
npm start               # http://127.0.0.1:3120
```

SQL server pustí jen whitelistované IP (VPS 95.216.201.2) – lokálně na Macu databáze nepůjde, testuje se na VPS.

## Nasazení

```bash
cd ~/Documents/Claude/Projects/CLB-Kartapacienta && git pull && ./deploy/vps-deploy.sh
```

Skript při prvním běhu vytvoří na VPS `.env` (DB a AI převezme z `/opt/jhn-apps/.env`, vygeneruje `KP_SECRET`
a heslo správy tenantů a jednou ho vypíše), spustí migraci, pm2 a doplní doménu do Caddy.

## API (zkráceně)

- `GET /api/health`
- `/api/admin/*` – `login`, `ares`, `tenanti`, `zalozit`, `aktivni`, `spravci`, `reset-hesla`
- `/api/c/*` – `login`, `ja`, `heslo`, `prehled`, `poskytovatele`, `pacient` (+ `/:id`, `/udaje`, `/plan`, `/kontakt`, `/denik`, `/tym`,
  `/predat`, `/prevzit`, `/parovat`, `/zarizeni`, `/pin`, `/kod-lekare`, `/dokument`, `/vypis`, `/uzavrit`, `/souhlas`), `ai/rozbor`,
  správa: `poskytovatel`, `uzivatele`, `uzivatel`, `zarizeni`, `audit`, `nastaveni`
- `/api/d/*` – `parovat` (kód z QR → token + balík), `sync` (fronta zápisů → potvrzená UUID + aktuální balík / příkaz smazat)
- `/api/napoveda` – návod (Markdown, veřejné), `/api/napoveda/dotaz` – chat nad návodem (přihlášený uživatel / spárovaný telefon)

Podklady k návrhu (proč a jak): `docs/`.
