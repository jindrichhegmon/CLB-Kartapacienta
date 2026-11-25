/* 0.11.143: diagnózy obousměrně s PéčeDoma (Data klienta → Diagnóza a Info, A_MSPPP_Anamneza). DgSpolecne = text diagnóz po poslední
   synchronizaci – podle něj Karta pozná, co od té doby přibylo nebo ubylo v Kartě a co v PéčeDoma (slučování po řádcích).
   NULL = ještě nesynchronizováno (první synchronizace texty jen sjednotí, nic nemaže). Idempotentní. */
IF COL_LENGTH('dbo.A_KP_PdSync', 'DgSpolecne') IS NULL
  ALTER TABLE dbo.A_KP_PdSync ADD DgSpolecne nvarchar(max) NULL;
