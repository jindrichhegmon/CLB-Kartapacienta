# CLB-Kartapacienta – Karta pacienta (paliativní průkaz)

Krizový plán péče, který má pacient vždy u sebe. Garant zavede pacienta v centrální aplikaci,
telefon u lůžka s ní komunikuje šifrovaně, ukazuje poslední stav i bez připojení a při každém
připojení se sesynchronizuje. Dotazy na AI jsou vždy anonymní.

**Živě:** https://kartapacienta.95-216-201-2.sslip.io (VPS Hetzner, pm2 `clb-kartapacienta`, port 3120, Caddy)

| Aplikace | Adresa | Pro koho |
|---|---|---|
| Správa tenantů | `/tenanti/` | provozovatel platformy – založení organizace jedním formulářem |
| Centrální aplikace | `/centrala/?t=<IDTENANT>` | garant a tým kolem pacienta (nemocnice, hospic, PL, domov) |
| Karta na mobil | `/karta/` | telefon u lůžka (PWA, offline, šifrovaná data) |
| Lokální prototyp | `/demo/` | původní demo v8 (data jen v prohlížeči, max. 10 pacientů) |

Vše startuje z jednoho serveru (`src/server.js`), zatím ne z Netlify. Make se nepoužívá.

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
  jméno a login správce, volitelně ukázková data. Vznikne tenant (nebo se použije existující se stejným IČO, např. CLB
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
- Kód lékaře = TOTP (HMAC-SHA1, 6 číslic, 5 min) z tajemství telefonu → ověří se offline; vydání se loguje.
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

Podklady k návrhu (proč a jak): `docs/`.
