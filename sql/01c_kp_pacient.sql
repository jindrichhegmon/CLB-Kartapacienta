/* Karta ve vlastním telefonu pacienta – „Můj průkaz“ (od 0.5.0). Idempotentní.
   A_KP_Zarizeni.Rezim   = ZAPUJCENY (telefon půjčený garantem, jen karta) | PACIENT (vlastní telefon pacienta);
                           u PACIENT je v Telefon už při vydání kódu číslo pacienta, na které kód smí.
   A_KP_Sdileni          = co pacient sám poslal týmu (vybral, viděl náhled, potvrdil) – jen doplňovat.
   A_KP_Dokument         = navíc datum a pracoviště dokumentu (původ informace).
   Běží před 02_kp_rls.sql, takže index podle tenanta a predikáty RLS se doplní ve stejném běhu. */
IF COL_LENGTH('dbo.A_KP_Zarizeni', 'Rezim') IS NULL
  ALTER TABLE dbo.A_KP_Zarizeni ADD Rezim varchar(10) NOT NULL
    CONSTRAINT DF_A_KP_Zarizeni_R DEFAULT ('ZAPUJCENY')
    CONSTRAINT CK_A_KP_Zarizeni_Rezim CHECK (Rezim IN ('ZAPUJCENY','PACIENT'));

IF COL_LENGTH('dbo.A_KP_Dokument', 'DatumDokumentu') IS NULL
  ALTER TABLE dbo.A_KP_Dokument ADD DatumDokumentu date NULL;
IF COL_LENGTH('dbo.A_KP_Dokument', 'Pracoviste') IS NULL
  ALTER TABLE dbo.A_KP_Dokument ADD Pracoviste nvarchar(200) NULL;

IF OBJECT_ID('dbo.A_KP_Sdileni') IS NULL
CREATE TABLE dbo.A_KP_Sdileni (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Sdileni_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  SdileniID int IDENTITY(1,1) NOT NULL,
  PacientID int NOT NULL,
  ZarizeniID int NOT NULL,
  Polozky nvarchar(MAX) NOT NULL,          -- JSON: [{druh, nazev, obsah, puvod, aktualizovano}]
  Vytvoreno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Sdileni_V DEFAULT (SYSDATETIME()),
  CONSTRAINT PK_A_KP_Sdileni PRIMARY KEY (SdileniID),
  CONSTRAINT FK_A_KP_Sdileni_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Sdileni_Zar FOREIGN KEY (ZarizeniID) REFERENCES dbo.A_KP_Zarizeni(ZarizeniID),
  CONSTRAINT FK_A_KP_Sdileni_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_A_KP_Sdileni_Pac')
  CREATE INDEX IX_A_KP_Sdileni_Pac ON dbo.A_KP_Sdileni (IDTENANT, PacientID, SdileniID);

-- sdílení pacientem jen doplňovat (správce '*' může mazat při archivaci tenanta)
IF OBJECT_ID('dbo.TR_A_KP_Sdileni_JenPridat') IS NULL
EXEC (N'CREATE TRIGGER dbo.TR_A_KP_Sdileni_JenPridat ON dbo.A_KP_Sdileni AFTER UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  IF CAST(SESSION_CONTEXT(N''IDTENANT'') AS nvarchar(16)) = N''*'' AND NOT EXISTS (SELECT 1 FROM inserted) RETURN;
  THROW 51003, N''Co sdílel pacient, nelze měnit ani mazat.'', 1;
END');
