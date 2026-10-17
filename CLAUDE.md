# Pravidla pro práci v tomto repozitáři

- Komunikace a texty v UI česky. Kód: ES moduly, Node 22, Express, `mssql`; frontend bez build kroku (čisté HTML/JS v `public/`).
- **Nepoužívat Make.** Vše běží na vlastním serveru (`src/server.js`) na VPS, zatím ne na Netlify.
- Databáze PeceDomaPlus: každá nová tabulka má prefix `A_KP_`, první sloupec `IDTENANT char(16)` s `DEFAULT SESSION_CONTEXT`,
  FK na `dbo.Tenants`, index `IX_<tab>_Tenant` a predikáty v `sec.TenantPolicy` (doplní `sql/02_kp_rls.sql`). DDL idempotentní.
- Do DB jen přes `vTenantu(tenant, q => …)` z `src/db.js`. `'*'` jen ve správě tenantů a migracích. Žádné SQL z prohlížeče.
- Deník a audit log jsou jen pro doplňování. Plán péče = nová verze, nikdy UPDATE.
- Do AI nikdy neposílat identitu pacienta – vždy přes `rozborZpravy()` (`src/ai.js` → `src/anonym.js`). Po úpravě anonymizace spustit `npm test`.
- Po změně: `npm test`, commit, push a nasazení `./deploy/vps-deploy.sh` z Macu (SQL je dostupné jen z VPS).
