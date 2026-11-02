/* Výchozí kontakty organizace (od 0.11.70). Idempotentní.
   A_KP_KontaktVychozi = sada kontaktů platná pro celou organizaci (tenant), např. linka paliativní podpory, sloužící sestra,
                         ambulance. U klienta se jen zatrhne „použít“ – vznikne řádek A_KP_Kontakt s VychoziID (kopie údajů,
                         aby krizová karta, telefon i PéčeDoma četly kontakty beze změny). Úprava výchozího kontaktu z kteréhokoli
                         klienta se propíše do všech zatržených klientů (server přepíše kopie).
   Skupina jen PECUJE / INFORMOVAT – „rozhoduje“ je vždy konkrétní osoba u konkrétního pacienta.
   Běží před 02_kp_rls.sql (index podle tenanta a predikáty RLS doplní tentýž běh). */
IF OBJECT_ID('dbo.A_KP_KontaktVychozi') IS NULL
CREATE TABLE dbo.A_KP_KontaktVychozi (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_KontaktVychozi_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  VychoziID int IDENTITY(1,1) NOT NULL,
  Jmeno nvarchar(150) NOT NULL,
  Telefon nvarchar(40) NOT NULL,
  Skupina varchar(10) NOT NULL,
  Poznamka nvarchar(200) NULL,
  Poradi int NOT NULL CONSTRAINT DF_A_KP_KontaktVychozi_P DEFAULT (100),
  Aktivni bit NOT NULL CONSTRAINT DF_A_KP_KontaktVychozi_A DEFAULT (1),
  Zmeneno datetime2(0) NOT NULL CONSTRAINT DF_A_KP_KontaktVychozi_Z DEFAULT (SYSDATETIME()),
  ZmenilUzivatelID int NULL,
  CONSTRAINT PK_A_KP_KontaktVychozi PRIMARY KEY (VychoziID),
  CONSTRAINT CK_A_KP_KontaktVychozi_Sk CHECK (Skupina IN ('INFORMOVAT','PECUJE')),
  CONSTRAINT FK_A_KP_KontaktVychozi_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

IF COL_LENGTH('dbo.A_KP_Kontakt', 'VychoziID') IS NULL
  EXEC (N'ALTER TABLE dbo.A_KP_Kontakt ADD VychoziID int NULL CONSTRAINT FK_A_KP_Kontakt_Vychozi FOREIGN KEY REFERENCES dbo.A_KP_KontaktVychozi(VychoziID)');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_A_KP_Kontakt_Vychozi')
  EXEC (N'CREATE INDEX IX_A_KP_Kontakt_Vychozi ON dbo.A_KP_Kontakt (IDTENANT, VychoziID)');
