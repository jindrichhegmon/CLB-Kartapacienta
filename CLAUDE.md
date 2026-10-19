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
- Po změně: `npm test`, commit, push a nasazení `./deploy/vps-deploy.sh` z Macu (SQL je dostupné jen z VPS).
