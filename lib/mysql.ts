import mysql from "mysql2/promise";

export type QueryResult = mysql.RowDataPacket[] | mysql.ResultSetHeader;

declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined;
}

const TRANSIENT_DB_ERRORS = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
]);

function poolConfig(): mysql.PoolOptions {
  const creds = dbCredentials();
  if (!creds.host || !creds.user || !creds.database) {
    throw new Error(
      "Set DB_HOST/DB_USER/DB_PASSWORD/DB_NAME or DATABASE_URL in .env.local"
    );
  }
  return {
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
    database: creds.database,
    waitForConnections: true,
    connectionLimit: 5,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10_000,
  };
}

export function dbCredentials() {
  const host = (process.env.DB_HOST || process.env.MYSQL_HOST)?.trim();
  if (host) {
    return {
      host,
      port: Number(process.env.DB_PORT || process.env.MYSQL_PORT) || 3306,
      user: (process.env.DB_USER || process.env.MYSQL_USER)?.trim() ?? "",
      password: process.env.DB_PASSWORD ?? process.env.MYSQL_PASSWORD ?? "",
      database: (process.env.DB_NAME || process.env.MYSQL_DATABASE)?.trim() ?? "",
    };
  }
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.slice(1),
    };
  }
  return { host: "", port: 3306, user: "", password: "", database: "" };
}

export function getPool(): mysql.Pool {
  if (!global._mysqlPool) {
    global._mysqlPool = mysql.createPool(poolConfig());
  }
  return global._mysqlPool;
}

async function resetPool(): Promise<void> {
  if (global._mysqlPool) {
    await global._mysqlPool.end().catch(() => {});
    global._mysqlPool = undefined;
  }
  schemaReady = null;
}

function isTransientDbError(e: unknown): boolean {
  const code = (e as NodeJS.ErrnoException)?.code;
  return typeof code === "string" && TRANSIENT_DB_ERRORS.has(code);
}

export async function query<T extends QueryResult>(
  sql: string,
  params: (string | number | boolean | null)[] = [],
  retries = 1
): Promise<T> {
  // Use query() not execute() — prepared statements reject LIMIT ? on many MySQL builds.
  try {
    const [rows] = await getPool().query(sql, params);
    return rows as T;
  } catch (e) {
    if (retries > 0 && isTransientDbError(e)) {
      await resetPool();
      return query(sql, params, retries - 1);
    }
    throw e;
  }
}

export function isMysqlConfigured(): boolean {
  const { host, user, database } = dbCredentials();
  return !!(host && user && database);
}

let schemaReady: Promise<void> | null = null;

async function createSchema(): Promise<void> {
  await query(`
        CREATE TABLE IF NOT EXISTS todos (
          id CHAR(36) PRIMARY KEY,
          text VARCHAR(1000) NOT NULL,
          done TINYINT(1) NOT NULL DEFAULT 0,
          source ENUM('manual', 'claude') NOT NULL DEFAULT 'manual',
          created_at BIGINT NOT NULL,
          INDEX idx_todos_done_created (done, created_at DESC)
        )
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS actions (
          id CHAR(36) PRIMARY KEY,
          severity ENUM('kill', 'scale', 'test', 'info') NOT NULL DEFAULT 'info',
          title VARCHAR(1000) NOT NULL,
          detail VARCHAR(1000) NOT NULL DEFAULT '',
          source ENUM('claude') NOT NULL DEFAULT 'claude',
          created_at BIGINT NOT NULL,
          INDEX idx_actions_created (created_at DESC)
        )
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS formats (
          id CHAR(36) PRIMARY KEY,
          text VARCHAR(1000) NOT NULL,
          done TINYINT(1) NOT NULL DEFAULT 0,
          source ENUM('manual', 'claude') NOT NULL DEFAULT 'manual',
          created_at BIGINT NOT NULL,
          INDEX idx_formats_done_created (done, created_at DESC)
        )
      `);
}

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createSchema().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  await schemaReady;
}