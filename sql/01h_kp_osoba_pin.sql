/* 0.11.6: osobní PIN uložený i šifrovaně (klíčem serveru, jako A_KP_Zarizeni.Tajemstvi), aby ho šlo v Lidé a týmy znovu zobrazit
   (tlačítko Zobrazit PIN). Telefon PIN dál ověřuje jen přes Salt/Hash. PINy vydané před touto verzí se zobrazit nedají – vydá se nový. Idempotentní. */
IF COL_LENGTH('dbo.A_KP_Osoba', 'PinSifrovany') IS NULL
  ALTER TABLE dbo.A_KP_Osoba ADD PinSifrovany nvarchar(300) NULL;
