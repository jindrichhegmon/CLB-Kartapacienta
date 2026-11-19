/* 0.11.31: PIN rodiny a jednorázové PINy (A_KP_Pin) uložené i šifrovaně (klíčem serveru, jako A_KP_Osoba.PinSifrovany),
   aby je šlo u pacienta v Telefon a PINy znovu zobrazit (tlačítko Zobrazit PIN). Telefon PIN dál ověřuje jen přes Salt/Hash.
   PINy vydané před touto verzí se zobrazit nedají – tlačítko Nový PIN vydá stejnému držiteli nový. Idempotentní. */
IF COL_LENGTH('dbo.A_KP_Pin', 'PinSifrovany') IS NULL
  ALTER TABLE dbo.A_KP_Pin ADD PinSifrovany nvarchar(300) NULL;
