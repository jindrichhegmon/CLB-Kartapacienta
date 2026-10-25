/* 0.11.4: e-mail pacienta (informativní údaj v záložce Údaje, převezme se i z PéčeDoma). Idempotentní. */
IF COL_LENGTH('dbo.A_KP_Pacient', 'Email') IS NULL
  ALTER TABLE dbo.A_KP_Pacient ADD Email nvarchar(150) NULL;
