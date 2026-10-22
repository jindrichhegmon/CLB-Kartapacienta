/* Propojení s PéčeDoma (od 0.7.0). Idempotentní.
   A_KP_Pacient.PdKlientID       = ID klienta v databázi PéčeDoma (Famicura, uuid) – pacient založený výběrem klienta z PéčeDoma
                                   nebo ze souboru Export pro Kartu pacienta; podle něj běží synchronizace
   A_KP_Pacient.PdPortalKlientID = KlientID portálu PéčeDoma (A_MSPPP_Klient), jen informativně
   A_KP_PdSync                   = poslední stav převzatý z PéčeDoma: aktivní léky (SOS a pravidelné) a nejbližší plánovaná návštěva
                                   (kalendář FK). Plán péče se tím nemění – léky lékař převezme do nové verze plánu ručně.
   Nastavení tenanta (A_KP_Nastaveni): PD_ODKAZ (adresa portálu PéčeDoma organizace), PD_API (server jhn-apps), PD_TOKEN, PD_SYNC (1/0).
   Běží před 02_kp_rls.sql, takže index podle tenanta a predikáty RLS se doplní ve stejném běhu. */
IF COL_LENGTH('dbo.A_KP_Pacient', 'PdKlientID') IS NULL
  ALTER TABLE dbo.A_KP_Pacient ADD PdKlientID uniqueidentifier NULL;
IF COL_LENGTH('dbo.A_KP_Pacient', 'PdPortalKlientID') IS NULL
  ALTER TABLE dbo.A_KP_Pacient ADD PdPortalKlientID int NULL;

IF OBJECT_ID('dbo.A_KP_PdSync') IS NULL
CREATE TABLE dbo.A_KP_PdSync (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_PdSync_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  PacientID int NOT NULL,
  Sos nvarchar(MAX) NULL,                  -- JSON: ["Morphin 10 mg s.c. – při bolesti", …]
  Medikace nvarchar(MAX) NULL,             -- JSON: ["MST Continus 30 mg – 1-0-1", …]
  PristiNavsteva datetime2(0) NULL,
  PristiKdo nvarchar(200) NULL,            -- lékař / sestra z kalendáře FK
  PristiPozn nvarchar(300) NULL,           -- služba · stav · místo
  Aktualizovano datetime2(0) NOT NULL CONSTRAINT DF_A_KP_PdSync_A DEFAULT (SYSDATETIME()),
  Chyba nvarchar(300) NULL,                -- poslední chyba synchronizace (NULL = v pořádku)
  CONSTRAINT PK_A_KP_PdSync PRIMARY KEY (PacientID),
  CONSTRAINT FK_A_KP_PdSync_Pac FOREIGN KEY (PacientID) REFERENCES dbo.A_KP_Pacient(PacientID),
  CONSTRAINT FK_A_KP_PdSync_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);
