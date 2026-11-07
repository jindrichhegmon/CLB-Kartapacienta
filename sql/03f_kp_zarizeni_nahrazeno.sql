/* 0.11.97: výměna telefonu – deaktivace starého telefonu až na pokyn. Při převzetí průkazů novým telefonem se starému zařízení
   zapíše, kterým zařízením bylo nahrazeno (NahrazenoZarizenim) a kdy (Nahrazeno); zůstává aktivní, dokud ho garant v centrální
   aplikaci nedeaktivuje (Telefon a PINy → Výměna / deaktivace telefonu). Jen doplněk existující tabulky A_KP_Zarizeni
   (IDTENANT, RLS a index už má). Idempotentní. */
IF COL_LENGTH('dbo.A_KP_Zarizeni', 'NahrazenoZarizenim') IS NULL
  ALTER TABLE dbo.A_KP_Zarizeni ADD NahrazenoZarizenim int NULL;
IF COL_LENGTH('dbo.A_KP_Zarizeni', 'Nahrazeno') IS NULL
  ALTER TABLE dbo.A_KP_Zarizeni ADD Nahrazeno datetime2(0) NULL;
