/* 0.11.138: důvod, proč rozbor zprávy neběžel přes AI (chyba AI služby, chybějící klíč) – dřív se přešlo na rozbor podle pravidel
   bez záznamu. Jen text chyby od AI služby (stav, typ), nikdy text zprávy. Idempotentní. */
IF COL_LENGTH('dbo.A_KP_AIDotaz', 'Chyba') IS NULL
  ALTER TABLE dbo.A_KP_AIDotaz ADD Chyba nvarchar(300) NULL;
