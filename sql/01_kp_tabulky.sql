-- Karta pacienta (paliativní průkaz) – tabulky A_KP_* v databázi PeceDomaPlus
-- Stejný princip tenantů jako Péče doma Plus:
--   * první sloupec IDTENANT char(16), DEFAULT = SESSION_CONTEXT('IDTENANT'), FK na dbo.Tenants
--   * Row-Level Security sec.TenantPolicy (skript 02) – bez nastaveného kontextu 0 řádků, '*' = správce
-- Skript je idempotentní (IF OBJECT_ID … IS NULL), lze pouštět opakovaně.
-- Tenant = provozovatel sítě (např. Nadace Most k domovu Zlín pro Zlínský kraj);
-- uvnitř tenanta jsou poskytovatelé (nemocnice, hospic, PL, domov…), uživatelé, pacienti, garance a tým.

IF OBJECT_ID('dbo.A_KP_Nastaveni') IS NULL
CREATE TABLE dbo.A_KP_Nastaveni (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Nastaveni_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  Klic nvarchar(60) NOT NULL,
  Hodnota nvarchar(MAX) NULL,
  Zmeneno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Nastaveni_Z DEFAULT (SYSDATETIME()),
  CONSTRAINT PK_A_KP_Nastaveni PRIMARY KEY (IDTENANT, Klic),
  CONSTRAINT FK_A_KP_Nastaveni_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF OBJECT_ID('dbo.A_KP_Poskytovatel') IS NULL
CREATE TABLE dbo.A_KP_Poskytovatel (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Poskytovatel_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  PoskytovatelID int IDENTITY(1,1) NOT NULL,
  Nazev nvarchar(200) NOT NULL,
  ICO varchar(8) NULL,
  ICP varchar(20) NULL,
  Typ varchar(12) NOT NULL,
  SmiBytGarant AS (CASE WHEN Typ IN ('NEMOCNICE','HOSPIC','AMBULANCE','PL') THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END),
  Telefon24 nvarchar(40) NULL,
  Adresa nvarchar(300) NULL,
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_Poskytovatel_A DEFAULT (1),
  Vytvoreno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Poskytovatel_V DEFAULT (SYSDATETIME()),
  CONSTRAINT PK_A_KP_Poskytovatel PRIMARY KEY (PoskytovatelID),
  CONSTRAINT CK_A_KP_Poskytovatel_Typ CHECK (Typ IN ('NEMOCNICE','HOSPIC','AMBULANCE','PL','DOMOV','ZZS','JINY')),
  CONSTRAINT FK_A_KP_Poskytovatel_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF OBJECT_ID('dbo.A_KP_Uzivatel') IS NULL
CREATE TABLE dbo.A_KP_Uzivatel (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Uzivatel_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  UzivatelID int IDENTITY(1,1) NOT NULL,
  PoskytovatelID int NOT NULL,
  Jmeno nvarchar(150) NOT NULL,
  Login nvarchar(100) NOT NULL,
  Email nvarchar(200) NULL,
  Telefon nvarchar(40) NULL,
  HesloHash nvarchar(300) NULL,
  HesloPrvni nvarchar(300) NULL,
  MusiZmenitHeslo bit NOT NULL CONSTRAINT DF_A_KP_Uzivatel_M DEFAULT (1),
  Role nvarchar(60) NOT NULL,              -- čárkou: admin, lekar, sestra, ctenar
  CisloCLK nvarchar(20) NULL,
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_Uzivatel_A DEFAULT (1),
  PosledniPrihlaseni datetime2(0) NULL,
  Vytvoreno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Uzivatel_V DEFAULT (SYSDATETIME()),
  CONSTRAINT PK_A_KP_Uzivatel PRIMARY KEY (UzivatelID),
  CONSTRAINT FK_A_KP_Uzivatel_Posk FOREIGN KEY (PoskytovatelID) REFERENCES dbo.A_KP_Poskytovatel(PoskytovatelID),
  CONSTRAINT FK_A_KP_Uzivatel_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_A_KP_Uzivatel_Login')
  CREATE UNIQUE INDEX UX_A_KP_Uzivatel_Login ON dbo.A_KP_Uzivatel (IDTENANT, Login);

IF OBJECT_ID('dbo.A_KP_Pacient') IS NULL
CREATE TABLE dbo.A_KP_Pacient (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Pacient_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  PacientID int IDENTITY(1,1) NOT NULL,
  KodPrukazu varchar(12) NOT NULL,         -- P-0001 (zobrazuje se v notifikacích místo jména)
  Jmeno nvarchar(80) NOT NULL,
  Prijmeni nvarchar(80) NOT NULL,
  RodneCislo varchar(11) NULL,
  DatumNarozeni date NULL,
  RokNarozeni smallint NULL,
  Pohlavi nvarchar(10) NULL,
  Pojistovna varchar(3) NULL,
  Adresa nvarchar(300) NULL,
  Pobyt nvarchar(200) NULL,                -- kde pacient právě pobývá (domov, pokoj…)
  Telefon nvarchar(40) NULL,               -- telefon pacienta / k lůžku (jen v centrále)
  Stav varchar(10) NOT NULL CONSTRAINT DF_A_KP_Pacient_S DEFAULT ('AKTIVNI'),
  Souhlas nvarchar(200) NULL,              -- potvrzení informace pacientovi
  ZalozilUzivatelID int NULL,
  Zalozeno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Pacient_Z DEFAULT (SYSDATETIME()),
  Uzavreno datetime2(0) NULL,
  DuvodUzavreni nvarchar(200) NULL,
  CONSTRAINT PK_A_KP_Pacient PRIMARY KEY (PacientID),
  CONSTRAINT CK_A_KP_Pacient_Stav CHECK (Stav IN ('AKTIVNI','UZAVRENY')),
  CONSTRAINT FK_A_KP_Pacient_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_A_KP_Pacient_Kod')
  CREATE UNIQUE INDEX UX_A_KP_Pacient_Kod ON dbo.A_KP_Pacient (IDTENANT, KodPrukazu);
IF COL_LENGTH('dbo.A_KP_Pacient', 'Telefon') IS NULL
  ALTER TABLE dbo.A_KP_Pacient ADD Telefon nvarchar(40) NULL;

IF OBJECT_ID('dbo.A_KP_Garance') IS NULL
CREATE TABLE dbo.A_KP_Garance (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Garance_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  GaranceID int IDENTITY(1,1) NOT NULL,
  PacientID int NOT NULL,
  PoskytovatelID int NOT NULL,
  LekarUzivatelID int NULL,
  Stav varchar(10) NOT NULL,               -- NAVRZENO, PLATNA, UKONCENA, ODMITNUTO
  Od datetime2(0) NULL,
  Do datetime2(0) NULL,
  NavrhlUzivatelID int NULL,
  Navrzeno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Garance_N DEFAULT (SYSDATETIME()),
  Poznamka nvarchar(500) NULL,
  CONSTRAINT PK_A_KP_Garance PRIMARY KEY (GaranceID),
  CONSTRAINT CK_A_KP_Garance_Stav CHECK (Stav IN ('NAVRZENO','PLATNA','UKONCENA','ODMITNUTO')),
  CONSTRAINT FK_A_KP_Garance_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Garance_Posk FOREIGN KEY (PoskytovatelID) REFERENCES dbo.A_KP_Poskytovatel(PoskytovatelID),
  CONSTRAINT FK_A_KP_Garance_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_A_KP_Garance_Platna')
  CREATE UNIQUE INDEX UX_A_KP_Garance_Platna ON dbo.A_KP_Garance (IDTENANT, PacientID) WHERE Stav = 'PLATNA';

IF OBJECT_ID('dbo.A_KP_Tym') IS NULL
CREATE TABLE dbo.A_KP_Tym (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Tym_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  TymID int IDENTITY(1,1) NOT NULL,
  PacientID int NOT NULL,
  PoskytovatelID int NOT NULL,
  Role varchar(10) NOT NULL,               -- GARANT, PECE, LEKAR, HOST
  Od datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Tym_O DEFAULT (SYSDATETIME()),
  Do datetime2(0) NULL,
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_Tym_A DEFAULT (1),
  CONSTRAINT PK_A_KP_Tym PRIMARY KEY (TymID),
  CONSTRAINT CK_A_KP_Tym_Role CHECK (Role IN ('GARANT','PECE','LEKAR','HOST')),
  CONSTRAINT FK_A_KP_Tym_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Tym_Posk FOREIGN KEY (PoskytovatelID) REFERENCES dbo.A_KP_Poskytovatel(PoskytovatelID),
  CONSTRAINT FK_A_KP_Tym_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF OBJECT_ID('dbo.A_KP_PlanVerze') IS NULL
CREATE TABLE dbo.A_KP_PlanVerze (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_PlanVerze_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  PlanVerzeID int IDENTITY(1,1) NOT NULL,
  PacientID int NOT NULL,
  Verze int NOT NULL,
  Data nvarchar(MAX) NOT NULL,             -- JSON: cil, limity[], doklad{}, funkce, alergie, sos[], medikace[], dg
  PlatnostDo date NULL,
  PodepsalUzivatelID int NOT NULL,
  PodepsalJmeno nvarchar(150) NOT NULL,
  Typ varchar(10) NOT NULL CONSTRAINT DF_A_KP_PlanVerze_Typ DEFAULT ('ZMENA'),  -- ZALOZENI, ZMENA, REVIZE
  Poznamka nvarchar(500) NULL,
  Vytvoreno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_PlanVerze_V DEFAULT (SYSDATETIME()),
  CONSTRAINT PK_A_KP_PlanVerze PRIMARY KEY (PlanVerzeID),
  CONSTRAINT CK_A_KP_PlanVerze_Json CHECK (ISJSON(Data) = 1),
  CONSTRAINT FK_A_KP_PlanVerze_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_PlanVerze_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_A_KP_PlanVerze')
  CREATE UNIQUE INDEX UX_A_KP_PlanVerze ON dbo.A_KP_PlanVerze (IDTENANT, PacientID, Verze);

IF OBJECT_ID('dbo.A_KP_Kontakt') IS NULL
CREATE TABLE dbo.A_KP_Kontakt (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Kontakt_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  KontaktID int IDENTITY(1,1) NOT NULL,
  PacientID int NOT NULL,
  Jmeno nvarchar(150) NOT NULL,
  Telefon nvarchar(40) NOT NULL,
  Skupina varchar(10) NOT NULL,            -- ROZHODUJE, INFORMOVAT, PECUJE
  Poznamka nvarchar(200) NULL,
  Poradi int NOT NULL CONSTRAINT DF_A_KP_Kontakt_P DEFAULT (100),
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_Kontakt_A DEFAULT (1),
  Zmeneno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Kontakt_Z DEFAULT (SYSDATETIME()),
  CONSTRAINT PK_A_KP_Kontakt PRIMARY KEY (KontaktID),
  CONSTRAINT CK_A_KP_Kontakt_Sk CHECK (Skupina IN ('ROZHODUJE','INFORMOVAT','PECUJE')),
  CONSTRAINT FK_A_KP_Kontakt_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Kontakt_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF OBJECT_ID('dbo.A_KP_Zarizeni') IS NULL
CREATE TABLE dbo.A_KP_Zarizeni (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Zarizeni_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  ZarizeniID int IDENTITY(1,1) NOT NULL,
  Stitek nvarchar(60) NULL,                -- evidenční označení telefonu
  PacientID int NULL,
  Stav varchar(12) NOT NULL CONSTRAINT DF_A_KP_Zarizeni_S DEFAULT ('CEKA'),  -- CEKA, SPAROVANO, ZABLOKOVANO, VRACENO
  ParovaciKod varchar(12) NULL,
  ParovaciPlatnost datetime2(0) NULL,
  TokenHash varchar(64) NULL,              -- sha256 hex tokenu zařízení
  Tajemstvi nvarchar(300) NULL,            -- tajemství pro kód lékaře, šifrované klíčem serveru
  Sparovano datetime2(0) NULL,
  PosledniSync datetime2(0) NULL,
  Baterie tinyint NULL,
  VerzeAplikace nvarchar(20) NULL,
  DelkaFronty int NULL,
  VerzePlanuVZarizeni int NULL,
  Vytvoreno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Zarizeni_V DEFAULT (SYSDATETIME()),
  CONSTRAINT PK_A_KP_Zarizeni PRIMARY KEY (ZarizeniID),
  CONSTRAINT CK_A_KP_Zarizeni_Stav CHECK (Stav IN ('CEKA','SPAROVANO','ZABLOKOVANO','VRACENO')),
  CONSTRAINT FK_A_KP_Zarizeni_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Zarizeni_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF OBJECT_ID('dbo.A_KP_Pin') IS NULL
CREATE TABLE dbo.A_KP_Pin (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Pin_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  PinID int IDENTITY(1,1) NOT NULL,
  PacientID int NOT NULL,
  Jmeno nvarchar(150) NOT NULL,
  Role varchar(10) NOT NULL,               -- SESTRA, RODINA, HOSPIC, PL
  PoskytovatelID int NULL,
  Salt varchar(32) NOT NULL,
  Hash varchar(64) NOT NULL,               -- PBKDF2-SHA256 (ověřuje i telefon offline)
  Iterace int NOT NULL,
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_Pin_A DEFAULT (1),
  Vytvoreno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Pin_V DEFAULT (SYSDATETIME()),
  VytvorilUzivatelID int NULL,
  CONSTRAINT PK_A_KP_Pin PRIMARY KEY (PinID),
  CONSTRAINT CK_A_KP_Pin_Role CHECK (Role IN ('SESTRA','RODINA','HOSPIC','PL')),
  CONSTRAINT FK_A_KP_Pin_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Pin_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF OBJECT_ID('dbo.A_KP_Denik') IS NULL
CREATE TABLE dbo.A_KP_Denik (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Denik_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  DenikID bigint IDENTITY(1,1) NOT NULL,
  UUID uniqueidentifier NOT NULL,          -- přidělí telefon / server; idempotence synchronizace
  PacientID int NOT NULL,
  Typ nvarchar(30) NOT NULL,               -- Změna stavu, Podán SOS lék, Zhoršení stavu, Výjezd ZZS, Revize…
  Text nvarchar(MAX) NOT NULL,
  Autor nvarchar(150) NOT NULL,
  Role varchar(10) NOT NULL,               -- lekar, sestra, rodina, hospic, pl, zzs, system
  UzivatelID int NULL,
  ZarizeniID int NULL,
  CasZapisu datetime2(0) NOT NULL,         -- čas na zařízení (kdy se událost stala)
  CasPrijeti datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Denik_P DEFAULT (SYSDATETIME()),
  Overeno bit NOT NULL CONSTRAINT DF_A_KP_Denik_O DEFAULT (1),
  CONSTRAINT PK_A_KP_Denik PRIMARY KEY (DenikID),
  CONSTRAINT FK_A_KP_Denik_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Denik_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_A_KP_Denik_UUID')
  CREATE UNIQUE INDEX UX_A_KP_Denik_UUID ON dbo.A_KP_Denik (IDTENANT, UUID);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_A_KP_Denik_Pac')
  CREATE INDEX IX_A_KP_Denik_Pac ON dbo.A_KP_Denik (IDTENANT, PacientID, DenikID);

IF OBJECT_ID('dbo.A_KP_Dokument') IS NULL
CREATE TABLE dbo.A_KP_Dokument (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Dokument_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  DokumentID int IDENTITY(1,1) NOT NULL,
  PacientID int NOT NULL,
  Typ varchar(12) NOT NULL,                -- DVP, ZPRAVA, SOUHLAS, JINY
  Nazev nvarchar(200) NOT NULL,
  KdeOriginal nvarchar(200) NULL,
  MimeType varchar(80) NULL,
  Obsah varbinary(MAX) NULL,
  Velikost int NULL,
  VlozilUzivatelID int NULL,
  Vytvoreno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Dokument_V DEFAULT (SYSDATETIME()),
  CONSTRAINT PK_A_KP_Dokument PRIMARY KEY (DokumentID),
  CONSTRAINT FK_A_KP_Dokument_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Dokument_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF OBJECT_ID('dbo.A_KP_AuditLog') IS NULL
CREATE TABLE dbo.A_KP_AuditLog (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_AuditLog_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  AuditID bigint IDENTITY(1,1) NOT NULL,
  Cas datetime2(3) NOT NULL CONSTRAINT DF_A_KP_AuditLog_C DEFAULT (SYSDATETIME()),
  UzivatelID int NULL,
  ZarizeniID int NULL,
  Kdo nvarchar(150) NULL,
  PacientID int NULL,
  Akce nvarchar(60) NOT NULL,
  Detail nvarchar(1000) NULL,
  IP nvarchar(45) NULL,
  CONSTRAINT PK_A_KP_AuditLog PRIMARY KEY (AuditID),
  CONSTRAINT FK_A_KP_AuditLog_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_A_KP_AuditLog_Pac')
  CREATE INDEX IX_A_KP_AuditLog_Pac ON dbo.A_KP_AuditLog (IDTENANT, PacientID, AuditID);

IF OBJECT_ID('dbo.A_KP_AIDotaz') IS NULL
CREATE TABLE dbo.A_KP_AIDotaz (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_AIDotaz_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  AIDotazID bigint IDENTITY(1,1) NOT NULL,
  Cas datetime2(0) NOT NULL CONSTRAINT DF_A_KP_AIDotaz_C DEFAULT (SYSDATETIME()),
  UzivatelID int NULL,
  Ucel nvarchar(40) NOT NULL,
  DelkaTextu int NOT NULL,
  PocetNahrad int NOT NULL,
  Blokovano bit NOT NULL,
  Model nvarchar(60) NULL,
  Vysledek nvarchar(20) NULL,               -- OK, BLOK, CHYBA, LOKALNE
  CONSTRAINT PK_A_KP_AIDotaz PRIMARY KEY (AIDotazID),
  CONSTRAINT FK_A_KP_AIDotaz_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
-- obsah dotazu se do logu záměrně neukládá (bez obsahu, jen kdo / kdy / k čemu)
