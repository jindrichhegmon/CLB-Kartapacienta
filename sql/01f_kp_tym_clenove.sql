/* Členové týmů (0.10.2): tým patří pracovišti, které ho založilo (zpravidla garant), a mohou v něm být lidé kteréhokoli pracoviště
   organizace (sestra domova, praktický lékař…). Členství = řádek v A_KP_TymClen; člověk může být ve více týmech.
   A_KP_Osoba.Tym (textový tým z 0.4.0) se už nepoužívá – stávající členství se z něj jednou převezme. Idempotentní. */
IF OBJECT_ID('dbo.A_KP_TymClen') IS NULL
CREATE TABLE dbo.A_KP_TymClen (
  IDTENANT char(16) NOT NULL CONSTRAINT DF_A_KP_TymClen_T DEFAULT (CAST(SESSION_CONTEXT(N'IDTENANT') AS char(16))),
  TymClenID int IDENTITY(1,1) NOT NULL,
  TymLidiID int NOT NULL,
  OsobaID int NOT NULL,
  Od datetime2(0) NOT NULL CONSTRAINT DF_A_KP_TymClen_Od DEFAULT (SYSDATETIME()),
  PridalUzivatelID int NULL,
  CONSTRAINT PK_A_KP_TymClen PRIMARY KEY (TymClenID),
  CONSTRAINT UQ_A_KP_TymClen UNIQUE (TymLidiID, OsobaID),
  CONSTRAINT FK_A_KP_TymClen_Tym FOREIGN KEY (TymLidiID) REFERENCES dbo.A_KP_TymLidi(TymLidiID),
  CONSTRAINT FK_A_KP_TymClen_Os FOREIGN KEY (OsobaID) REFERENCES dbo.A_KP_Osoba(OsobaID),
  CONSTRAINT FK_A_KP_TymClen_Tenant FOREIGN KEY (IDTENANT) REFERENCES dbo.Tenants(IDTENANT)
);

-- jednorázové převzetí členství z textového pole A_KP_Osoba.Tym (stejné pracoviště + název týmu)
INSERT INTO dbo.A_KP_TymClen (IDTENANT, TymLidiID, OsobaID)
SELECT t.IDTENANT, t.TymLidiID, o.OsobaID
FROM dbo.A_KP_TymLidi t JOIN dbo.A_KP_Osoba o ON o.IDTENANT = t.IDTENANT AND o.PoskytovatelID = t.PoskytovatelID AND LTRIM(RTRIM(o.Tym)) = t.Nazev
WHERE NOT EXISTS (SELECT 1 FROM dbo.A_KP_TymClen c WHERE c.TymLidiID = t.TymLidiID AND c.OsobaID = o.OsobaID);
