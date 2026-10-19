/* Karta pacienta jen v jednom telefonu (od 0.2.0):
   A_KP_Pacient.TelefonKarty = číslo telefonu, na kterém je karta k dispozici (normalizované +420…);
   A_KP_Zarizeni.Telefon     = číslo, které telefon potvrdil při spárování. Idempotentní. */
IF COL_LENGTH('dbo.A_KP_Pacient', 'TelefonKarty') IS NULL
  ALTER TABLE dbo.A_KP_Pacient ADD TelefonKarty nvarchar(20) NULL;
IF COL_LENGTH('dbo.A_KP_Zarizeni', 'Telefon') IS NULL
  ALTER TABLE dbo.A_KP_Zarizeni ADD Telefon nvarchar(20) NULL;
