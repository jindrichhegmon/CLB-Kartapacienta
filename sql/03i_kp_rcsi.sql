/* 0.11.147: čtení bez čekání na zámky (READ_COMMITTED_SNAPSHOT) – čtení (přehled pacientů, karta) nečeká na rozpracované zápisy
   (synchronizace s PéčeDoma, ukládání plánu). Platí pro celou databázi PeceDomaPlus, tedy i pro PéčeDoma Plus. V provozní databázi zapnuto
   27. 11. 2026 ručně (se souhlasem vlastníka); tady jen pro novou instalaci – když je už zapnuto nebo účet nemá právo, nic se neděje. */
IF EXISTS (SELECT 1 FROM sys.databases WHERE name = DB_NAME() AND is_read_committed_snapshot_on = 0)
BEGIN
  BEGIN TRY
    ALTER DATABASE CURRENT SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
  END TRY
  BEGIN CATCH
    PRINT 'READ_COMMITTED_SNAPSHOT se nepodařilo zapnout: ' + ERROR_MESSAGE();
  END CATCH
END
