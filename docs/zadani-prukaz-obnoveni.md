# Zadání pro Průkaz pacienta (DialogusPrukaz): upozornění na nové údaje z Karty

Připraveno 16. 11. 2026 · Karta pacienta 0.11.114 · zadává Jindřich Hegmon

## Cíl

Když lékař nebo sestra v Kartě pacienta změní údaje (plán, diagnózy, léky, alergie, kontakty) nebo klikne
na **Obnovit v Průkazu**, má pacient v Průkazu pacienta vidět, že jsou k dispozici nové údaje, a jedním
klepnutím si je načíst. Pravidlo zůstává: **údaje se stahují jen na pokyn pacienta** a z Průkazu se do Karty
nic neposílá.

## Co Karta už umí (0.11.114)

- `GET /api/d/stav` s hlavičkou `Authorization: Device <token>` (stejný token jako pro `/api/d/sync`), CORS je povolený.
  Vrací jen příznaky, žádná zdravotní data:
  `{ ok: true, aktivni: true, aktualizace: true|false, zmena: true|false|null, vyzva: true|false, vyzvaOd: "2026-11-16 15:40"|null, posledniPredani: "2026-11-16 15:41"|null }`
  - `aktualizace` – je co načíst (údaje se od posledního načtení do tohoto telefonu změnily, nebo tým poslal výzvu),
  - `vyzva` / `vyzvaOd` – tým v Kartě klikl na Obnovit v Průkazu (může přijít i SMS),
  - `aktivni: false` – přístup byl v Kartě ukončen.
- Po `POST /api/d/sync` (Načíst z Karty pacienta) Karta zapíše předání a `aktualizace` se vrátí na `false`.

## Co upravit v Průkazu

1. Po odemčení PINem, při návratu do aplikace a po obnovení připojení (nejvýš jednou za 5 minut) zavolat
   `GET /api/d/stav`, jen je-li karta propojená s Kartou pacienta.
2. Je-li `aktualizace: true`, ukázat na Přehledu (a u propojení) výrazný pruh:
   **„Lékař aktualizoval vaše údaje“** (u výzvy s datem `vyzvaOd`) a tlačítko **Načíst z Karty pacienta** –
   spustí stávající načtení (`/api/d/sync` → návrh ke kontrole → pacient potvrdí, co uloží).
3. Je-li `aktivni: false`, ukázat, že přístup byl ukončen (jako dnes při 401 ze `/sync`).
4. Bez připojení nebo při chybě nic nehlásit (jen příště zkusit znovu).
5. Nic automaticky nestahovat a nic neposílat do Karty.
6. Verze, `CACHE` v `sw.js`, `npm test` s napodobeným `/api/d/stav`, kapitola v `napoveda.md`.

## Hotovo, když

- Po změně plánu v Kartě a otevření Průkazu se pacientovi ukáže „Lékař aktualizoval vaše údaje“.
- Po klepnutí na Načíst z Karty pacienta a uložení pruh zmizí a v Kartě je u telefonu „v Průkazu jsou aktuální údaje“.
- Bez propojení s Kartou se `/api/d/stav` nevolá.
