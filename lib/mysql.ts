import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2/promise";

export type QueryResult = mysql.RowDataPacket[] | mysql.ResultSetHeader;

declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined;
}

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

export async function query<T extends QueryResult>(
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<T> {
  // Use query() not execute() — prepared statements reject LIMIT ? on many MySQL builds.
  const [rows] = await getPool().query(sql, params);
  return rows as T;
}

export function isMysqlConfigured(): boolean {
  const { host, user, database } = dbCredentials();
  return !!(host && user && database);
}

let schemaReady: Promise<void> | null = null;

export const SEED_FORMATS = [
  "Same flow as the top-spend winner, different person's scan. Type “What's my worst feature” — show a scan with one visibly low category score.",
  "Different person's scan. Type “Am I cooked or is there hope” — show overall ~45–50 vs potential 70+, linger on the gap.",
  "Different person's scan. Type “How far am I from my potential” — skip score lingering, go straight to the routine/diet recommendations.",
  "Different person's scan. Type “Rate me honestly” — mid overall score, slow scroll through every category breakdown.",
  "Same scan as the winner. Type “What should I fix first” — reorder to lead with the single lowest category before the full dashboard.",
];

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
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
    })();
  }
  await schemaReady;
}

export async function seedFormatsIfEmpty(): Promise<void> {
  await ensureSchema();
  const rows = await query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM formats");
  if (Number((rows[0] as { n: number }).n) > 0) return;
  const now = Date.now();
  for (let i = 0; i < SEED_FORMATS.length; i++) {
    await query(
      "INSERT INTO formats (id, text, done, source, created_at) VALUES (?, ?, 0, 'manual', ?)",
      [crypto.randomUUID(), SEED_FORMATS[i], now + (SEED_FORMATS.length - i)]
    );
  }
}
