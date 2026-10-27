/* Videohovor (od 0.11.45). Idempotentní.
   A_KP_Videohovor = jeden záznam na hovor: kdo ho zahájil (telefon u pacienta po odemknutí PINem, nebo centrála),
   název místnosti na serveru videohovorů (Jitsi, KP_JITSI_URL), stav a časy. Obsah hovoru se nikde neukládá.
   Stav: ZVONI (čeká na druhou stranu) → PROBIHA (přijat) → UKONCEN; nepřijatý do 3 minut → NEPRIJAT.
   Běží před 02_kp_rls.sql, takže index podle tenanta a predikáty RLS se doplní ve stejném běhu. */
IF OBJECT_ID('dbo.A_KP_Videohovor') IS NULL
CREATE TABLE dbo.A_KP_Videohovor (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_Videohovor_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  VideohovorID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_A_KP_Videohovor PRIMARY KEY,
  PacientID int NOT NULL,
  Mistnost varchar(80) NOT NULL,              -- název místnosti na serveru videohovorů (náhodná část = ochrana před hádáním)
  Zahajil varchar(10) NOT NULL,               -- TELEFON | CENTRALA
  ZahajilJmeno nvarchar(150) NOT NULL,
  ZahajilRole varchar(10) NULL,               -- role odemknutí na telefonu (rodina, sestra, hospic, pl, lekar) / role uživatele
  UzivatelID int NULL,
  ZarizeniID int NULL,
  Stav varchar(10) NOT NULL CONSTRAINT DF_A_KP_Videohovor_S DEFAULT ('ZVONI'),
  Zahajeno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_Videohovor_Z DEFAULT (SYSDATETIME()),
  Prijato datetime2(0) NULL,
  Ukonceno datetime2(0) NULL,
  CONSTRAINT FK_A_KP_Videohovor_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_Videohovor_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_A_KP_Videohovor_Pac')
  CREATE INDEX IX_A_KP_Videohovor_Pac ON dbo.A_KP_Videohovor (PacientID, Stav);
