/* Telefony s kartou u týmu (od 0.11.85). Idempotentní.
   A_KP_TymTelefon = zapůjčené telefony s kartou (číslo telefonu, normalizované +420…), které garant zatrhl u týmu lidí.
                     Tým se přiřadí všem aktivním pacientům, jejichž průkaz je v tomto telefonu spárovaný, a každému dalšímu
                     pacientovi, který se do telefonu spáruje (typicky telefon na oddělení domova a tým sester domova).
                     Odtržení telefonu tým od pacientů neodebírá – to se dělá u pacienta (Tým a garance → Týmy u pacienta).
   Běží před 02_kp_rls.sql (index podle tenanta a predikáty RLS doplní tentýž běh). */
IF OBJECT_ID('dbo.A_KP_TymTelefon') IS NULL
CREATE TABLE dbo.A_KP_TymTelefon (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_TymTelefon_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  TymTelefonID int IDENTITY(1,1) NOT NULL,
  TymLidiID int NOT NULL,
  Telefon nvarchar(20) NOT NULL,
  Pridano datetime2(0) NOT NULL CONSTRAINT DF_A_KP_TymTelefon_P DEFAULT (SYSDATETIME()),
  PridalUzivatelID int NULL,
  CONSTRAINT PK_A_KP_TymTelefon PRIMARY KEY (TymTelefonID),
  CONSTRAINT FK_A_KP_TymTelefon_Tym FOREIGN KEY (TymLidiID) REFERENCES dbo.A_KP_TymLidi(TymLidiID),
  CONSTRAINT FK_A_KP_TymTelefon_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_A_KP_TymTelefon')
  EXEC (N'CREATE UNIQUE INDEX UX_A_KP_TymTelefon ON dbo.A_KP_TymTelefon (IDTENANT, TymLidiID, Telefon)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_A_KP_TymTelefon_Telefon')
  EXEC (N'CREATE INDEX IX_A_KP_TymTelefon_Telefon ON dbo.A_KP_TymTelefon (IDTENANT, Telefon)');
