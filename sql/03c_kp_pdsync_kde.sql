/* 0.11.80: kde se pacient nachází podle PéčeDoma (Doma, DS B, DS C, DS jiný, Hospitalizace …) – přebírá synchronizace
   (pecedoma-karta akce sync → pole kde, z adresáře CLB1 AdresySQL.SOS). Jen doplněk existující tabulky A_KP_PdSync
   (IDTENANT, RLS a index už má). Idempotentní. */
IF COL_LENGTH('dbo.A_KP_PdSync', 'Kde') IS NULL
  ALTER TABLE dbo.A_KP_PdSync ADD Kde nvarchar(60) NULL;
