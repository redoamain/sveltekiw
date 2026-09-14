import sql from "mssql";
import { getPool, log } from "@/lib/db";
import { BoundedCache } from "@/lib/cache";

// Fallback in-memory cache jika DB tidak tersedia / belum ada tabel
const memCache = new BoundedCache<{
  SessionId: string;
  IP: string | null;
  UserAgent: string | null;
  CreatedAt: Date;
  LastActiveAt: Date;
  ExpiresAt: Date;
}>({ ttlMs: 8 * 60 * 60 * 1000, maxEntries: 5000 });

let tableEnsured = false;

async function ensureSessionTable(): Promise<boolean> {
  if (tableEnsured) return true;
  try {
    // Coba buat tabel jika belum ada — pakai IF OBJECT_ID
    await getPool().then((pool) =>
      pool.request().query(`
        IF OBJECT_ID('dbo.pp_active_sessions', 'U') IS NULL
        CREATE TABLE [dbo].[pp_active_sessions] (
          [UserName] NVARCHAR(50) NOT NULL PRIMARY KEY,
          [SessionId] NVARCHAR(64) NOT NULL,
          [IP] NVARCHAR(45) NULL,
          [UserAgent] NVARCHAR(500) NULL,
          [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
          [LastActiveAt] DATETIME NOT NULL DEFAULT GETDATE(),
          [ExpiresAt] DATETIME NOT NULL
        );
      `),
    );
    tableEnsured = true;
    return true;
  } catch (e) {
    log.warn({ err: e }, "Gagal ensure pp_active_sessions table — pakai memory fallback");
    tableEnsured = true; // jangan coba terus
    return false;
  }
}

export interface ActiveSession {
  UserName: string;
  SessionId: string;
  IP: string | null;
  UserAgent: string | null;
  CreatedAt: Date;
  LastActiveAt: Date;
  ExpiresAt: Date;
}

export async function getActiveSession(UserName: string): Promise<ActiveSession | null> {
  const key = UserName.trim();
  if (!key) return null;

  // Coba DB dulu
  const dbOk = await ensureSessionTable();
  if (dbOk) {
    try {
      const pool = await getPool();
      const res = await pool
        .request()
        .input("UserName", sql.NVarChar(50), key)
        .query(`SELECT * FROM [dbo].[pp_active_sessions] WHERE UserName = @UserName`);
      const row = res.recordset[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      // cek expired
      const exp = new Date(row.ExpiresAt as string);
      if (exp.getTime() < Date.now()) {
        // hapus yang expired
        await pool.request().input("UserName", sql.NVarChar(50), key).query(`DELETE FROM [dbo].[pp_active_sessions] WHERE UserName=@UserName`);
        memCache.delete(key);
        return null;
      }
      const sess: ActiveSession = {
        UserName: String(row.UserName),
        SessionId: String(row.SessionId),
        IP: row.IP as string | null,
        UserAgent: row.UserAgent as string | null,
        CreatedAt: new Date(row.CreatedAt as string),
        LastActiveAt: new Date(row.LastActiveAt as string),
        ExpiresAt: exp,
      };
      // sync ke memCache juga
      memCache.set(key, sess);
      return sess;
    } catch (e) {
      log.warn({ err: e }, "getActiveSession DB gagal, fallback memCache");
    }
  }

  // Fallback memCache
  const mem = memCache.get(key);
  if (!mem) return null;
  if (mem.ExpiresAt.getTime() < Date.now()) {
    memCache.delete(key);
    return null;
  }
  return { UserName: key, ...mem };
}

export async function createSession(
  UserName: string,
  SessionId: string,
  opts?: { ip?: string | null; ua?: string | null; ttlSec?: number },
): Promise<void> {
  const key = UserName.trim();
  const now = new Date();
  const ttl = opts?.ttlSec ?? 8 * 60 * 60;
  const exp = new Date(now.getTime() + ttl * 1000);
  const sess: ActiveSession = {
    UserName: key,
    SessionId,
    IP: opts?.ip ?? null,
    UserAgent: opts?.ua ?? null,
    CreatedAt: now,
    LastActiveAt: now,
    ExpiresAt: exp,
  };

  memCache.set(key, sess);

  const dbOk = await ensureSessionTable();
  if (!dbOk) return;
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("UserName", sql.NVarChar(50), key)
      .input("SessionId", sql.NVarChar(64), SessionId)
      .input("IP", sql.NVarChar(45), opts?.ip ?? null)
      .input("UserAgent", sql.NVarChar(500), opts?.ua ? String(opts.ua).slice(0, 500) : null)
      .input("ExpiresAt", sql.DateTime, exp)
      .query(`
        MERGE [dbo].[pp_active_sessions] AS target
        USING (SELECT @UserName AS UserName) AS source ON target.UserName = source.UserName
        WHEN MATCHED THEN UPDATE SET SessionId=@SessionId, IP=@IP, UserAgent=@UserAgent, LastActiveAt=GETDATE(), ExpiresAt=@ExpiresAt, CreatedAt=GETDATE()
        WHEN NOT MATCHED THEN INSERT (UserName, SessionId, IP, UserAgent, CreatedAt, LastActiveAt, ExpiresAt) VALUES (@UserName, @SessionId, @IP, @UserAgent, GETDATE(), GETDATE(), @ExpiresAt);
      `);
  } catch (e) {
    log.warn({ err: e }, "createSession DB gagal, tetap di memCache");
  }
}

export async function deleteSession(UserName: string): Promise<void> {
  const key = UserName.trim();
  memCache.delete(key);
  try {
    await ensureSessionTable();
    const pool = await getPool();
    await pool.request().input("UserName", sql.NVarChar(50), key).query(`DELETE FROM [dbo].[pp_active_sessions] WHERE UserName=@UserName`);
  } catch {}
}

export async function touchSession(UserName: string): Promise<void> {
  const key = UserName.trim();
  const mem = memCache.get(key);
  if (mem) {
    mem.LastActiveAt = new Date();
    memCache.set(key, mem);
  }
  try {
    await ensureSessionTable();
    const pool = await getPool();
    await pool.request().input("UserName", sql.NVarChar(50), key).query(`UPDATE [dbo].[pp_active_sessions] SET LastActiveAt=GETDATE() WHERE UserName=@UserName`);
  } catch {}
}

export async function isSessionValid(UserName: string, SessionId: string): Promise<boolean> {
  const sess = await getActiveSession(UserName);
  if (!sess) return false;
  return sess.SessionId === SessionId;
}
