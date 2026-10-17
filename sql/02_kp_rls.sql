-- Karta pacienta – indexy podle tenanta, ochrana deníku a přidání tabulek A_KP_* do sec.TenantPolicy.
-- Idempotentní: přidá jen to, co chybí.

-- index IX_<tabulka>_Tenant na každé tabulce (stejně jako u A_MSPPP_*)
DECLARE @t sysname, @s nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
  SELECT name FROM sys.tables WHERE name LIKE 'A[_]KP[_]%' AND schema_id = SCHEMA_ID('dbo');
OPEN c; FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_' + @t + '_Tenant')
  BEGIN
    SET @s = N'CREATE INDEX ' + QUOTENAME('IX_' + @t + '_Tenant') + N' ON dbo.' + QUOTENAME(@t) + N' (IDTENANT)';
    EXEC (@s);
  END
  FETCH NEXT FROM c INTO @t;
END
CLOSE c; DEALLOCATE c;

-- deník a audit jen doplňovat: UPDATE a DELETE odmítnout (správce '*' může mazat při archivaci tenanta)
IF OBJECT_ID('dbo.TR_A_KP_Denik_JenPridat') IS NULL
EXEC (N'CREATE TRIGGER dbo.TR_A_KP_Denik_JenPridat ON dbo.A_KP_Denik AFTER UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  IF CAST(SESSION_CONTEXT(N''IDTENANT'') AS nvarchar(16)) = N''*'' AND NOT EXISTS (SELECT 1 FROM inserted) RETURN;
  THROW 51001, N''Zápisy deníku nelze měnit ani mazat, jen doplňovat.'', 1;
END');

IF OBJECT_ID('dbo.TR_A_KP_AuditLog_JenPridat') IS NULL
EXEC (N'CREATE TRIGGER dbo.TR_A_KP_AuditLog_JenPridat ON dbo.A_KP_AuditLog AFTER UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  IF CAST(SESSION_CONTEXT(N''IDTENANT'') AS nvarchar(16)) = N''*'' AND NOT EXISTS (SELECT 1 FROM inserted) RETURN;
  THROW 51002, N''Log přístupů nelze měnit ani mazat.'', 1;
END');

-- Row-Level Security: FILTER + BLOCK predikát pro každou tabulku A_KP_*, která v politice ještě není
DECLARE @add nvarchar(max) = N'';
SELECT @add = @add + CASE WHEN @add = N'' THEN N'' ELSE N', ' END
  + N'ADD FILTER PREDICATE sec.fn_TenantPredicate(IDTENANT) ON dbo.' + QUOTENAME(t.name)
  + N', ADD BLOCK PREDICATE sec.fn_TenantPredicate(IDTENANT) ON dbo.' + QUOTENAME(t.name)
FROM sys.tables t
WHERE t.name LIKE 'A[_]KP[_]%' AND t.schema_id = SCHEMA_ID('dbo')
  AND NOT EXISTS (SELECT 1 FROM sys.security_predicates p
                  JOIN sys.security_policies sp ON sp.object_id = p.object_id AND sp.name = 'TenantPolicy'
                  WHERE p.target_object_id = t.object_id);
IF @add <> N''
BEGIN
  SET @s = N'ALTER SECURITY POLICY sec.TenantPolicy ' + @add;
  EXEC (@s);
END

SELECT t.name AS tabulka,
       (SELECT COUNT(*) FROM sys.security_predicates p WHERE p.target_object_id = t.object_id) AS predikatu
FROM sys.tables t WHERE t.name LIKE 'A[_]KP[_]%' ORDER BY t.name;
