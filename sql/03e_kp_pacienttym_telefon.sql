/* 0.11.89: odkud se tým k pacientovi přiřadil – ZdrojTelefon = číslo telefonu s kartou, přes který tým přišel (Lidé a týmy → tým →
   Telefony s kartou). Takový tým od pacienta zase odejde, když pacient v tom telefonu přestane být (nové číslo telefonu s kartou,
   zablokování, vrácení nebo odebrání telefonu, odtržení telefonu u týmu). Ručně přidané týmy (ZdrojTelefon NULL) se nemění.
   Jen doplněk existující tabulky A_KP_PacientTym (IDTENANT, RLS a index už má). Idempotentní. */
IF COL_LENGTH('dbo.A_KP_PacientTym', 'ZdrojTelefon') IS NULL
BEGIN
  ALTER TABLE dbo.A_KP_PacientTym ADD ZdrojTelefon nvarchar(20) NULL;
  -- jednorázově: týmy přiřazené od 0.11.85 přes telefon (přiřazení až po zatržení telefonu u týmu) – ručně dřív přidaná zůstanou bez zdroje
  EXEC (N'UPDATE pt SET ZdrojTelefon = x.Telefon FROM dbo.A_KP_PacientTym pt
    CROSS APPLY (SELECT TOP 1 tt.Telefon FROM dbo.A_KP_TymTelefon tt WHERE tt.TymLidiID = pt.TymLidiID AND tt.IDTENANT = pt.IDTENANT AND pt.Od >= DATEADD(second, -5, tt.Pridano) ORDER BY tt.Pridano) x
    WHERE pt.Aktivni = 1 AND pt.ZdrojTelefon IS NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_TymLidi t WHERE t.TymLidiID = pt.TymLidiID AND t.PrirazenVzdy = 1)');
END
