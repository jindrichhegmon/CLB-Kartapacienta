/* 0.11.87: odborný zástupce pracoviště (např. „MUDr. Ladislav Kabelka, Ph.D.“) – na krizové kartě v oddílu Koho volat místo jména
   toho, kdo plán péče uložil (přihlášený uživatel). Kdo verzi plánu uložil, zůstává v A_KP_PlanVerze.PodepsalJmeno. Idempotentní. */
IF COL_LENGTH('dbo.A_KP_Poskytovatel', 'OdbornyZastupce') IS NULL
  ALTER TABLE dbo.A_KP_Poskytovatel ADD OdbornyZastupce nvarchar(150) NULL;
