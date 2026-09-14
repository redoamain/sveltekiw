/* eslint-disable @typescript-eslint/no-explicit-any */
import sql from "mssql";
import dotenv from "dotenv";
import pino from "pino";
import pretty from "pino-pretty";
import { AsyncLocalStorage } from "node:async_hooks";

const ENV_PATH = `.env.${process.env.NODE_ENV || "development"}`;
// Pakai file env spesifik (mis. .env.development) bila ada, kalau tidak fallback ke .env
import { existsSync } from "node:fs";
dotenv.config({
  path: existsSync(ENV_PATH) ? ENV_PATH : ".env",
});

// Logger terstruktur (pino)
export const log = pino(
  { level: process.env.LOG_LEVEL || "info" },
  pretty(),
);

// AsyncLocalStorage untuk menyimpan konteks database per request
export const dbContext = new AsyncLocalStorage<{ useBackup: boolean }>();

// Helper untuk mendapatkan useBackup dari konteks
export const isUsingBackup = (): boolean => {
  const ctx = dbContext.getStore();
  return ctx?.useBackup ?? false;
};

const config: sql.config = {
  user: process.env.DB_USER ?? "",
  password: process.env.DB_PASSWORD ?? "",
  server: process.env.DB_SERVER ?? "",
  port: 1433,
  database: process.env.DB_DATABASE ?? "",
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 60000,
  },
};

// Pool terpisah untuk autentikasi (MenuCP) — seperti `getPoolLogin` di kiw.
// Jika DB_DATABASE2 tidak di-set, fallback ke DB_DATABASE agar tetap jalan
// di environment single-DB (KIW Monitoring Inventori standalone).
const loginConfig: sql.config = {
  user: process.env.DB_USER ?? "",
  password: process.env.DB_PASSWORD ?? "",
  server: process.env.DB_SERVER ?? "",
  port: 1433,
  database: process.env.DB_DATABASE2 || process.env.DB_DATABASE || "",
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
};

// ─── Backup server (tidak live) ──────────────────────────────────────────────
const backupConfig: sql.config = {
  user: process.env.DB_BACKUP_USER ?? "",
  password: process.env.DB_BACKUP_PASSWORD ?? "",
  server: process.env.DB_BACKUP_SERVER ?? "",
  port: 1433,
  database: process.env.DB_BACKUP_DATABASE ?? "",
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 60000,
  },
};

const backupLoginConfig: sql.config = {
  user: process.env.DB_BACKUP_USER ?? "",
  password: process.env.DB_BACKUP_PASSWORD ?? "",
  server: process.env.DB_BACKUP_SERVER ?? "",
  port: 1433,
  database: process.env.DB_BACKUP_DATABASE2 || process.env.DB_BACKUP_DATABASE || "",
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
};

let poolPromise: Promise<sql.ConnectionPool> | undefined;
let poolPromiseLogin: Promise<sql.ConnectionPool> | undefined;
let poolPromiseBackup: Promise<sql.ConnectionPool> | undefined;
let poolPromiseBackupLogin: Promise<sql.ConnectionPool> | undefined;

const createPool = async (
  cfg: sql.config,
  label = "default",
): Promise<sql.ConnectionPool> => {
  try {
    const pool = new sql.ConnectionPool(cfg);
    const connected = await pool.connect();
    connected.on("error", (err: Error) => {
      log.error({ err }, `❌ Database pool error [${label}]`);
      if (label === "login") poolPromiseLogin = undefined;
      else if (label === "backup") poolPromiseBackup = undefined;
      else if (label === "backup-login") poolPromiseBackupLogin = undefined;
      else poolPromise = undefined;
    });
    log.info(`✅ Connected to MSSQL [${label}]: ${cfg.database}`);
    return connected;
  } catch (err) {
    log.error({ err }, `❌ Database connection failed [${label}]`);
    throw err;
  }
};

export const getPool = async (): Promise<sql.ConnectionPool> => {
  if (!poolPromise) poolPromise = createPool(config, "default");
  try {
    const pool = await poolPromise;
    await pool.request().query("SELECT 1 AS test");
    return pool;
  } catch {
    log.warn("🔄 Reconnecting to database [default]...");
    poolPromise = createPool(config, "default");
    return poolPromise;
  }
};

export const getPoolLogin = async (): Promise<sql.ConnectionPool> => {
  if (!poolPromiseLogin) poolPromiseLogin = createPool(loginConfig, "login");
  try {
    const pool = await poolPromiseLogin;
    await pool.request().query("SELECT 1 AS test");
    return pool;
  } catch {
    log.warn("🔄 Reconnecting to database [login]...");
    poolPromiseLogin = createPool(loginConfig, "login");
    return poolPromiseLogin;
  }
};

export const getPoolBackup = async (): Promise<sql.ConnectionPool> => {
  if (!poolPromiseBackup) poolPromiseBackup = createPool(backupConfig, "backup");
  try {
    const pool = await poolPromiseBackup;
    await pool.request().query("SELECT 1 AS test");
    return pool;
  } catch {
    log.warn("🔄 Reconnecting to database [backup]...");
    poolPromiseBackup = createPool(backupConfig, "backup");
    return poolPromiseBackup;
  }
};

export const getPoolBackupLogin = async (): Promise<sql.ConnectionPool> => {
  if (!poolPromiseBackupLogin) poolPromiseBackupLogin = createPool(backupLoginConfig, "backup-login");
  try {
    const pool = await poolPromiseBackupLogin;
    await pool.request().query("SELECT 1 AS test");
    return pool;
  } catch {
    log.warn("🔄 Reconnecting to database [backup-login]...");
    poolPromiseBackupLogin = createPool(backupLoginConfig, "backup-login");
    return poolPromiseBackupLogin;
  }
};

// Parameter ter-tipe untuk request.input(name, type, value)
export interface TypedInput {
  name: string;
  type: (() => sql.ISqlType) | sql.ISqlType;
  value: any;
}

const isConnectionError = (error: unknown): boolean => {
  const dbError = error as sql.ConnectionError;
  return (
    dbError?.code === "ECONNCLOSED" ||
    dbError?.message?.includes("Connection is closed") ||
    dbError?.message?.includes("Connection lost")
  );
};

const bindInputs = (request: sql.Request, inputs: TypedInput[] = []) => {
  inputs.forEach(({ name, type, value }) => request.input(name, type, value));
  return request;
};

const withRetry = async <T>(
  run: (pool: sql.ConnectionPool) => Promise<T>,
): Promise<T> => {
  try {
    return await run(await getPool());
  } catch (error) {
    if (isConnectionError(error)) {
      poolPromise = undefined;
      return await run(await getPool());
    }
    throw error;
  }
};

const withRetryBackup = async <T>(
  run: (pool: sql.ConnectionPool) => Promise<T>,
): Promise<T> => {
  try {
    return await run(await getPoolBackup());
  } catch (error) {
    if (isConnectionError(error)) {
      poolPromiseBackup = undefined;
      return await run(await getPoolBackup());
    }
    throw error;
  }
};

// Jalankan query ad-hoc dengan auto-reconnect
export const runQuery = async (
  query: string,
  inputs: TypedInput[] = [],
): Promise<sql.IResult<any>> => {
  const useBackup = isUsingBackup();
  return useBackup
    ? withRetryBackup((pool) => bindInputs(pool.request(), inputs).query(query))
    : withRetry((pool) => bindInputs(pool.request(), inputs).query(query));
};

// Jalankan stored procedure dengan auto-reconnect
export const runProcedure = async (
  procedure: string,
  inputs: TypedInput[] = [],
): Promise<sql.IResult<any>> => {
  const useBackup = isUsingBackup();
  return useBackup
    ? withRetryBackup((pool) => bindInputs(pool.request(), inputs).execute(procedure))
    : withRetry((pool) => bindInputs(pool.request(), inputs).execute(procedure));
};

// ─── Backup helpers ──────────────────────────────────────────────────────────
export const runQueryBackup = async (
  query: string,
  inputs: TypedInput[] = [],
): Promise<sql.IResult<any>> =>
  withRetryBackup((pool) => bindInputs(pool.request(), inputs).query(query));

export const runProcedureBackup = async (
  procedure: string,
  inputs: TypedInput[] = [],
): Promise<sql.IResult<any>> =>
  withRetryBackup((pool) => bindInputs(pool.request(), inputs).execute(procedure));

// ─── Dynamic helpers (pilih pool berdasarkan parameter) ──────────────────────
export const runQueryDynamic = async (
  query: string,
  inputs: TypedInput[] = [],
  useBackup = false,
): Promise<sql.IResult<any>> =>
  useBackup
    ? withRetryBackup((pool) => bindInputs(pool.request(), inputs).query(query))
    : withRetry((pool) => bindInputs(pool.request(), inputs).query(query));

export const runProcedureDynamic = async (
  procedure: string,
  inputs: TypedInput[] = [],
  useBackup = false,
): Promise<sql.IResult<any>> =>
  useBackup
    ? withRetryBackup((pool) => bindInputs(pool.request(), inputs).execute(procedure))
    : withRetry((pool) => bindInputs(pool.request(), inputs).execute(procedure));

// Jalankan WORK unit dalam satu TRANSACTION dengan rollback otomatis saat gagal.
// Tidak menutup pool (pool adalah shared); hanya membuka/menutup transaksi.
export async function withTransaction<T>(
  work: (tx: sql.Transaction) => Promise<T>,
): Promise<T> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await work(tx);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // abaikan error rollback; error asli lebih penting
    }
    throw error;
  }
}

export async function withTransactionBackup<T>(
  work: (tx: sql.Transaction) => Promise<T>,
): Promise<T> {
  const pool = await getPoolBackup();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await work(tx);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // abaikan error rollback; error asli lebih penting
    }
    throw error;
  }
}