# Pravidla pro práci v tomto repozitáři

- Komunikace a texty v UI česky. Kód: ES moduly, Node 22, Express, `mssql`; frontend bez build kroku (čisté HTML/JS v `public/`).
- **Nepoužívat Make.** Vše běží na vlastním serveru (`src/server.js`) na VPS, zatím ne na Netlify.
- Databáze PeceDomaPlus: každá nová tabulka má prefix `A_KP_`, první sloupec `IDTENANT char(16)` s `DEFAULT SESSION_CONTEXT`,
  FK na `dbo.Tenants`, index `IX_<tab>_Tenant` a predikáty v `sec.TenantPolicy` (doplní `sql/02_kp_rls.sql`). DDL idempotentní.
- Do DB jen přes `vTenantu(tenant, q => …)` z `src/db.js`. `'*'` jen ve správě tenantů a migracích. Žádné SQL z prohlížeče.
- Deník a audit log jsou jen pro doplňování. Plán péče = nová verze, nikdy UPDATE.
- Do AI nikdy neposílat identitu pacienta – vždy přes `rozborZpravy()` (`src/ai.js` → `src/anonym.js`). Po úpravě anonymizace spustit `npm test`.
- Standard aplikací jako PéčeDoma: 📖 nápověda s obrázky, 💬 chat nad ní a 🎨 vzhled (`public/shared/kp-napoveda.js`). Když se změní obrazovka
  nebo postup, uprav `napoveda/napoveda.md` (číslované kapitoly `## N. Název` – na čísla odkazují aplikace i chat) a obnov snímky
  `node scripts/napoveda-snimky.mjs` + `python3 scripts/napoveda-zmensit.py` (smyšlená data v napodobeném API ve skriptu).
- Telefon má dva režimy (`A_KP_Zarizeni.Rezim`): zapůjčený (`/karta/`) a vlastní telefon pacienta (`PACIENT`). Vlastní telefon pacienta
  je od 0.11.111 jen aplikace **Průkaz pacienta** (repozitář DialogusPrukaz): přes `/api/d/parovat` a `/api/d/sync` si na pokyn pacienta
  jednosměrně kopíruje údaje a **do Karty nic neposílá**. Dřívější Můj průkaz (`/pacient/`) je zrušený – automatické posílání záznamů týmu přes
  `/api/d/sdilet` platilo jen pro něj; endpoint zůstává kvůli kompatibilitě a dřívější záznamy se dál ukazují (Od pacienta). Do telefonu pacienta
  nikdy deník, PINy týmu ani tajemství kódu lékaře. Nikdy přímo do jiných tabulek. Dokumenty pacientovi (od 0.11.118) jen ty s
  `A_KP_Dokument.ProPacienta = 1`: v balíku jen metadata a otisk, obsah jen přes `GET /api/d/dokument/:id` (vlastnictví ověřit v jednom dotazu, jinak 404).
  Od 0.11.148 aplikace **Zpráva do Průkazu** (`nastroje/zprava-do-prukazu`, Netlify site zprava-do-prukazu): lékař (účet Karty) nahraje
  zprávu → `/api/c/ai/rozbor-souboru` → zkontroluje → prohlížeč zašifruje (AES-GCM, klíč jen v QR kódu) → `POST /api/c/zasilka`;
  Průkaz si šifru jednou vyzvedne `POST /api/d/zasilka`. Šifra jen v paměti serveru (`src/zasilka.js`, 30 min, jednou), do DB jen audit
  bez obsahu. CORS pro ni `KP_ZPRAVA_ORIGINY` (`src/cors.js`).
- Jednoduchý režim organizace (`A_KP_Nastaveni.REZIM_JEDNODUCHY = '1'`, Správa → Nastavení): jen skrývá obrazovky (centrála: třída `jednoduchy`
  na `<html>`, prvky `jen-plny`), data ani audit se nemění. V něm smí sestra totéž co lékař (`opravneni()`, `sUzivatelem`) a garantem nového
  pacienta je vždy pracoviště přihlášeného uživatele.
- Po změně: `npm test`, commit, push a nasazení `./deploy/vps-deploy.sh` z Macu (SQL je dostupné jen z VPS).
- Po nasazení nové verze poslat MUDr. Kabelkovi (kontakt „Kabelka“ v AJA Kontakty) a v kopii Jindřichovi e-mail o verzi: co je nového
  a co vyzkoušet, oslovení „Ahoj Laďo“, tykání (skill odeslat-mail).
