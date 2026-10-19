-- Karta pacienta 0.4.0 – Lidé a týmy pracovišť (zapíší se jednou, k pacientovi se jen přiřazují).
-- A_KP_Osoba: člověk pracoviště (garant i partner – domov, PL…) s rolí na kartě a osobním PINem (platí u všech pacientů, ke kterým je přiřazen).
-- A_KP_PacientOsoba: přiřazení člověka k pacientovi (jen pracoviště v týmu kolem pacienta).
-- Běží před 02_kp_rls.sql, takže index IX_<tab>_Tenant a predikáty v sec.TenantPolicy doplní tentýž běh migrace. Idempotentní.

IF OBJECT_ID('dbo.A_KP_Osoba') IS NULL
CREATE TABLE dbo.A_KP_Osoba (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Osoba_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  OsobaID int IDENTITY(1,1) NOT NULL,
  PoskytovatelID int NOT NULL,
  Tym nvarchar(60) NULL,                   -- tým uvnitř pracoviště (např. „Tým Zlín-sever“), k pacientovi jde přiřadit celý tým
  Jmeno nvarchar(150) NOT NULL,
  Role varchar(10) NOT NULL,               -- role na kartě: LEKAR, PL, HOSPIC, SESTRA (sestra / pečovatel v domově)
  Telefon nvarchar(30) NULL,
  Email nvarchar(150) NULL,
  Poznamka nvarchar(200) NULL,
  Salt varchar(32) NULL,                   -- osobní PIN: PBKDF2-SHA256 (telefon ho ověřuje offline)
  Hash varchar(64) NULL,
  Iterace int NULL,
  PinVydan datetime2(0) NULL,
  Zdroj varchar(10) NOT NULL CONSTRAINT DF_A_KP_Osoba_Z DEFAULT ('RUCNE'),   -- RUCNE, CSV, PECEDOMA
  ExterniID nvarchar(60) NULL,             -- např. pd:<UzivatelID> z PéčeDoma
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_Osoba_A DEFAULT (1),
  Vytvoreno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Osoba_V DEFAULT (SYSDATETIME()),
  VytvorilUzivatelID int NULL,
  CONSTRAINT PK_A_KP_Osoba PRIMARY KEY (OsobaID),
  CONSTRAINT CK_A_KP_Osoba_Role CHECK (Role IN ('LEKAR','PL','HOSPIC','SESTRA')),
  CONSTRAINT FK_A_KP_Osoba_Posk FOREIGN KEY (PoskytovatelID) REFERENCES dbo.A_KP_Poskytovatel(PoskytovatelID),
  CONSTRAINT FK_A_KP_Osoba_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF OBJECT_ID('dbo.A_KP_PacientOsoba') IS NULL
CREATE TABLE dbo.A_KP_PacientOsoba (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_PacientOsoba_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  PacientOsobaID int IDENTITY(1,1) NOT NULL,
  PacientID int NOT NULL,
  OsobaID int NOT NULL,
  Od datetime2(0) NOT NULL CONSTRAINT DF_A_KP_PacientOsoba_Od DEFAULT (SYSDATETIME()),
  Do datetime2(0) NULL,
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_PacientOsoba_A DEFAULT (1),
  PridalUzivatelID int NULL,
  CONSTRAINT PK_A_KP_PacientOsoba PRIMARY KEY (PacientOsobaID),
  CONSTRAINT FK_A_KP_PacientOsoba_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_PacientOsoba_Os FOREIGN KEY (OsobaID) REFERENCES dbo.A_KP_Osoba(OsobaID),
  CONSTRAINT FK_A_KP_PacientOsoba_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_A_KP_PacientOsoba_Aktivni')
  CREATE UNIQUE INDEX UX_A_KP_PacientOsoba_Aktivni ON dbo.A_KP_PacientOsoba (PacientID, OsobaID) WHERE Aktivni = 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_A_KP_Osoba_Posk')
  CREATE INDEX IX_A_KP_Osoba_Posk ON dbo.A_KP_Osoba (PoskytovatelID, Aktivni);
