/**
 * Přístup do PeceDomaPlus s tenantem v SESSION_CONTEXT (Row-Level Security sec.TenantPolicy).
 *
 * Každá operace běží v jedné transakci na jednom spojení:
 *   1. EXEC sp_set_session_context 'IDTENANT' = tenant (nebo '*' pro správu tenantů)
 *   2. dotazy – RLS vrací a dovolí zapisovat jen řádky tenanta, DEFAULT doplní IDTENANT sám
 *   3. kontext se vynuluje a transakce potvrdí
 * Kontext se nastavuje VŽDY na začátku, takže případný zbytek z jiného požadavku na stejném
 * spojení z poolu nemůže prosáknout.
 *
 *   const rows = await vTenantu(t, (q) => q.all('SELECT * FROM dbo.A_KP_Pacient WHERE Stav=@s', { s: 'AKTIVNI' }));
 */
import sql from 'mssql';
import { config } from './config.js';

let poolP = null;
export function pool() {
  if (!poolP) {
    const p = new sql.ConnectionPool({
      server: config.db.server, port: config.db.port, database: config.db.database,
      user: config.db.user, password: config.db.password,
      connectionTimeout: 15000, requestTimeout: 30000,
      pool: { max: 8, min: 0, idleTimeoutMillis: 60000 },
      options: { encrypt: config.db.encrypt, trustServerCertificate: config.db.trustServerCertificate, enableArithAbort: true, useUTC: false },
    });
    poolP = p.connect();
    poolP.catch(() => { poolP = null; });
  }
  return poolP;
}

function bind(req, params) {
  for (const [k, v] of Object.entries(params || {})) {
    if (v instanceof Date) req.input(k, sql.DateTime2, v);
    else if (typeof v === 'number' && Number.isInteger(v)) req.input(k, sql.BigInt, v);
    else if (typeof v === 'number') req.input(k, sql.Float, v);
    else if (typeof v === 'boolean') req.input(k, sql.Bit, v);
    else if (Buffer.isBuffer(v)) req.input(k, sql.VarBinary(sql.MAX), v);
    else req.input(k, sql.NVarChar(sql.MAX), v === undefined || v === null ? null : String(v));
  }
  return req;
}

function api(tx) {
  const run = async (text, params) => bind(new sql.Request(tx), params).query(text);
  return {
    all: async (text, params) => (await run(text, params)).recordset || [],
    one: async (text, params) => ((await run(text, params)).recordset || [])[0] || null,
    exec: async (text, params) => { const r = await run(text, params); return (r.rowsAffected || []).reduce((a, b) => a + b, 0); },
    run,
  };
}

const TENANT_RE = /^[A-Z0-9]{16}$/;

/** Spustí fn(q) v kontextu tenanta. tenant = 16 znaků A–Z0–9, nebo '*' (správce), nebo null (bez dat). */
export async function vTenantu(tenant, fn) {
  if (tenant !== '*' && tenant !== null && !TENANT_RE.test(String(tenant || ''))) {
    throw Object.assign(new Error('Neplatný tenant'), { status: 400 });
  }
  const p = await pool();
  const tx = new sql.Transaction(p);
  await tx.begin();
  const q = api(tx);
  try {
    await q.run("EXEC sp_set_session_context @key = N'IDTENANT', @value = @t", { t: tenant });
    const vysledek = await fn(q);
    await q.run("EXEC sp_set_session_context @key = N'IDTENANT', @value = NULL");
    await tx.commit();
    return vysledek;
  } catch (e) {
    try { await tx.rollback(); } catch { /* transakce už byla zrušena serverem */ }
    throw e;
  }
}

/** Dávka bez transakce (DDL migrace), v kontextu správce. */
export async function davka(text) {
  const p = await pool();
  const r = await p.request().batch(`EXEC sp_set_session_context @key = N'IDTENANT', @value = N'*';\n${text}`);
  return r.recordsets || [];
}

export { sql };
