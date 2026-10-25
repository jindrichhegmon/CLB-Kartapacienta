/* Týmy lidí (od 0.10.0). Idempotentní.
   A_KP_TymLidi    = pojmenovaný tým uvnitř pracoviště (agenda Lidé a týmy); členství člověka = A_KP_Osoba.Tym (název) + stejné pracoviště
   A_KP_PacientTym = tým vybraný u pacienta (záložka Tým a garance → Týmy u pacienta); členové se materializují do A_KP_PacientOsoba
                     se sloupcem TymLidiID (odkud přišli) – telefon i detail dál čtou A_KP_PacientOsoba. Člen jde u pacienta jen deaktivovat.
   Běží před 02_kp_rls.sql (index podle tenanta a predikáty RLS doplní tentýž běh). */
IF OBJECT_ID('dbo.A_KP_TymLidi') IS NULL
CREATE TABLE dbo.A_KP_TymLidi (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_TymLidi_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  TymLidiID int IDENTITY(1,1) NOT NULL,
  PoskytovatelID int NOT NULL,
  Nazev nvarchar(60) NOT NULL,
  Popis nvarchar(200) NULL,
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_TymLidi_A DEFAULT (1),
  Vytvoreno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_TymLidi_V DEFAULT (SYSDATETIME()),
  VytvorilUzivatelID int NULL,
  CONSTRAINT PK_A_KP_TymLidi PRIMARY KEY (TymLidiID),
  CONSTRAINT FK_A_KP_TymLidi_Posk FOREIGN KEY (PoskytovatelID) REFERENCES dbo.A_KP_Poskytovatel(PoskytovatelID),
  CONSTRAINT FK_A_KP_TymLidi_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_A_KP_TymLidi_Nazev')
  CREATE UNIQUE INDEX UX_A_KP_TymLidi_Nazev ON dbo.A_KP_TymLidi (IDTENANT, PoskytovatelID, Nazev);

IF OBJECT_ID('dbo.A_KP_PacientTym') IS NULL
CREATE TABLE dbo.A_KP_PacientTym (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_PacientTym_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  PacientTymID int IDENTITY(1,1) NOT NULL,
  PacientID int NOT NULL,
  TymLidiID int NOT NULL,
  Od datetime2(0) NOT NULL CONSTRAINT DF_A_KP_PacientTym_Od DEFAULT (SYSDATETIME()),
  Do datetime2(0) NULL,
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_PacientTym_A DEFAULT (1),
  PridalUzivatelID int NULL,
  CONSTRAINT PK_A_KP_PacientTym PRIMARY KEY (PacientTymID),
  CONSTRAINT FK_A_KP_PacientTym_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_PacientTym_Tym FOREIGN KEY (TymLidiID) REFERENCES dbo.A_KP_TymLidi(TymLidiID),
  CONSTRAINT FK_A_KP_PacientTym_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF COL_LENGTH('dbo.A_KP_PacientOsoba', 'TymLidiID') IS NULL
  ALTER TABLE dbo.A_KP_PacientOsoba ADD TymLidiID int NULL;   -- NULL = přiřazen jednotlivě (před 0.10.0)

-- týmy, které už lidé mají v A_KP_Osoba.Tym, dostanou hlavičku
INSERT INTO dbo.A_KP_TymLidi (IDTENANT, PoskytovatelID, Nazev)
SELECT DISTINCT o.IDTENANT, o.PoskytovatelID, LTRIM(RTRIM(o.Tym)) FROM dbo.A_KP_Osoba o
WHERE o.Tym IS NOT NULL AND LTRIM(RTRIM(o.Tym)) <> N''
  AND NOT EXISTS (SELECT 1 FROM dbo.A_KP_TymLidi t WHERE t.IDTENANT = o.IDTENANT AND t.PoskytovatelID = o.PoskytovatelID AND t.Nazev = LTRIM(RTRIM(o.Tym)));
