/* Plán péče z PéčeDoma (od 0.11.65). Idempotentní.
   Lékař v PéčeDoma (Data klienta → Karta pacienta) zapíše novou verzi plánu bez účtu v Kartě – podepsaný je jménem
   („PéčeDoma: MUDr. …“), PodepsalUzivatelID proto smí být NULL. Starší verze mají účet vždy. */
IF COLUMNPROPERTY(OBJECT_ID('dbo.A_KP_PlanVerze'), 'PodepsalUzivatelID', 'AllowsNull') = 0
  ALTER TABLE dbo.A_KP_PlanVerze ALTER COLUMN PodepsalUzivatelID int NULL;
