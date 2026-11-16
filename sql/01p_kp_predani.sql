/* Předání do Průkazu pacienta (od 0.11.113). Idempotentní.
   A_KP_Predani = co přesně Karta předala do Průkazu pacienta (vlastní telefon pacienta, Rezim PACIENT) při propojení
                  a při každém načtení údajů – snímek v JSON (plán, diagnózy, alergie, léky, DVP, kontakty, tým, garant).
                  Ukazuje se v centrále v Historii předání; jen doplňovat.
   Běží před 02_kp_rls.sql, takže index podle tenanta a predikáty RLS se doplní ve stejném běhu. */
IF OBJECT_ID('dbo.A_KP_Predani') IS NULL
CREATE TABLE dbo.A_KP_Predani (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Predani_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  PredaniID bigint IDENTITY(1,1) NOT NULL,
  Cas datetime2(3) NOT NULL CONSTRAINT DF_A_KP_Predani_C DEFAULT (SYSDATETIME()),
  PacientID int NOT NULL,
  ZarizeniID int NOT NULL,
  Akce varchar(12) NOT NULL CONSTRAINT CK_A_KP_Predani_Akce CHECK (Akce IN ('PROPOJENI','NACTENI')),
  VerzePlanu int NULL,
  Obsah nvarchar(MAX) NOT NULL,          -- JSON: { plan, dg, alergie, leky, kontakty, tym, garant }
  CONSTRAINT PK_A_KP_Predani PRIMARY KEY (PredaniID),
  CONSTRAINT FK_A_KP_Predani_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Predani_Zar FOREIGN KEY (ZarizeniID) REFERENCES dbo.A_KP_Zarizeni(ZarizeniID),
  CONSTRAINT FK_A_KP_Predani_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_A_KP_Predani_Pac')
  CREATE INDEX IX_A_KP_Predani_Pac ON dbo.A_KP_Predani (IDTENANT, PacientID, PredaniID);

-- předání jen doplňovat (správce '*' může mazat při archivaci tenanta)
IF OBJECT_ID('dbo.TR_A_KP_Predani_JenPridat') IS NULL
EXEC (N'CREATE TRIGGER dbo.TR_A_KP_Predani_JenPridat ON dbo.A_KP_Predani AFTER UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  IF CAST(SESSION_CONTEXT(N''IDTENANT'') AS nvarchar(16)) = N''*'' AND NOT EXISTS (SELECT 1 FROM inserted) RETURN;
  THROW 51004, N''Záznam o předání do Průkazu nelze měnit ani mazat.'', 1;
END');
