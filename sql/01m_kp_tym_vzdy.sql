/* Tým přiřazený vždy (od 0.11.66). Idempotentní.
   A_KP_TymLidi.PrirazenVzdy = 1: tým se automaticky přiřadí ke každé kartě pacienta (stávající i nově založené);
   u pacienta ho nejde odebrat, jen deaktivovat jednotlivé členy. */
IF COL_LENGTH('dbo.A_KP_TymLidi', 'PrirazenVzdy') IS NULL
  ALTER TABLE dbo.A_KP_TymLidi ADD PrirazenVzdy bit NOT NULL CONSTRAINT DF_A_KP_TymLidi_PV DEFAULT (0);
