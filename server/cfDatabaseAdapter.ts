import fs from "fs";
import path from "path";
import type { D1LikeDatabase, D1LikePreparedStatement, D1LikeAllResult, D1LikeRunResult } from "../cloudflare-worker/src/d1Types";

/**
 * Unified Node.js D1 Adapter for `server.ts`:
 * 1. When CF_ACCOUNT_ID + CF_API_TOKEN + CF_D1_DATABASE_ID are set, executes directly against Cloudflare D1 REST API.
 * 2. Otherwise runs seamlessly against Node's built-in `node:sqlite` (`DatabaseSync`) backed by `./tmp/abdomedi-cf-d1.sqlite`,
 *    auto-applying `cloudflare-worker/migrations/*.sql` so local dev & tests match Cloudflare D1 100%.
 */

function stripSqlCommentsAndSplit(sqlText: string): string[] {
  const withoutComments = sqlText
    .split(/\r?\n/)
    .map((line) => (line.trim().startsWith("--") ? "" : line))
    .join("\n");
  return withoutComments
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

class RemoteD1DatabaseAdapter implements D1LikeDatabase {
  constructor(
    private accountId: string,
    private apiToken: string,
    private databaseId: string
  ) {}

  private async executeRemote<T>(sql: string, params: unknown[]): Promise<T[]> {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sql, params: params.map((v) => (v === undefined ? null : v)) })
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const msg = json?.errors?.[0]?.message || `Cloudflare D1 API error (${res.status})`;
      throw new Error(msg);
    }
    const firstResult = Array.isArray(json.result) ? json.result[0] : json.result;
    return (firstResult?.results || []) as T[];
  }

  prepare(query: string): D1LikePreparedStatement {
    let bound: unknown[] = [];
    const self = this;
    const stmt: D1LikePreparedStatement & { _sql: string; _params: () => unknown[] } = {
      _sql: query,
      _params: () => bound,
      bind(...values: unknown[]) {
        bound = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const rows = await self.executeRemote<Record<string, unknown>>(query, bound);
        if (!rows.length) return null;
        if (colName) return (rows[0][colName] as T) ?? null;
        return rows[0] as T;
      },
      async all<T = Record<string, unknown>>(): Promise<D1LikeAllResult<T>> {
        const rows = await self.executeRemote<T>(query, bound);
        return { results: rows, success: true };
      },
      async run(): Promise<D1LikeRunResult> {
        await self.executeRemote(query, bound);
        return { success: true };
      }
    };
    return stmt;
  }

  async batch<T = unknown>(statements: D1LikePreparedStatement[]): Promise<T[]> {
    const results: T[] = [];
    for (const st of statements) {
      results.push((await st.all()) as unknown as T);
    }
    return results;
  }
}

class LocalSqliteD1Adapter implements D1LikeDatabase {
  private sqliteDb: any;

  constructor(dbFilePath: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.sqliteDb = new DatabaseSync(dbFilePath);
    this.sqliteDb.exec("PRAGMA journal_mode = WAL;");
    this.sqliteDb.exec("PRAGMA synchronous = NORMAL;");
    this.applyMigrations();
  }

  private applyMigrations() {
    const migrationsDir = path.resolve(process.cwd(), "cloudflare-worker", "migrations");
    if (!fs.existsSync(migrationsDir)) return;
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      const statements = stripSqlCommentsAndSplit(content);
      for (const sql of statements) {
        this.sqliteDb.exec(sql);
      }
    }
  }

  private normalizeParams(params: unknown[]): any[] {
    return params.map((v) => {
      if (v === undefined) return null;
      if (typeof v === "boolean") return v ? 1 : 0;
      return v;
    });
  }

  prepare(query: string): D1LikePreparedStatement {
    let bound: unknown[] = [];
    const dbRef = this.sqliteDb;
    const normalize = this.normalizeParams.bind(this);
    const trimmedLower = query.trim().toLowerCase();
    const hasReturning = /\breturning\b/i.test(query);

    const stmt: D1LikePreparedStatement & { _execFirst?: () => any } = {
      bind(...values: unknown[]) {
        bound = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const prepared = dbRef.prepare(query);
        const row = prepared.get(...normalize(bound)) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async all<T = Record<string, unknown>>(): Promise<D1LikeAllResult<T>> {
        const prepared = dbRef.prepare(query);
        if (trimmedLower.startsWith("select") || trimmedLower.startsWith("with") || trimmedLower.startsWith("pragma") || hasReturning) {
          const rows = prepared.all(...normalize(bound)) as T[];
          return { results: rows, success: true };
        }
        prepared.run(...normalize(bound));
        return { results: [], success: true };
      },
      async run(): Promise<D1LikeRunResult> {
        const prepared = dbRef.prepare(query);
        if (hasReturning) {
          prepared.all(...normalize(bound));
          return { success: true };
        }
        const info = prepared.run(...normalize(bound));
        return {
          success: true,
          meta: {
            changes: Number(info?.changes ?? 0),
            last_row_id: Number(info?.lastInsertRowid ?? 0)
          }
        };
      }
    };
    return stmt;
  }

  async batch<T = unknown>(statements: D1LikePreparedStatement[]): Promise<T[]> {
    const out: T[] = [];
    this.sqliteDb.exec("BEGIN IMMEDIATE");
    try {
      for (const st of statements) {
        out.push((await st.run()) as unknown as T);
      }
      this.sqliteDb.exec("COMMIT");
      return out;
    } catch (err) {
      try {
        this.sqliteDb.exec("ROLLBACK");
      } catch {}
      throw err;
    }
  }
}

let cachedAdapter: D1LikeDatabase | null = null;

export function getServerD1Database(): D1LikeDatabase {
  if (cachedAdapter) return cachedAdapter;

  const accountId = process.env.CF_ACCOUNT_ID?.trim();
  const apiToken = process.env.CF_API_TOKEN?.trim();
  const databaseId = (process.env.CF_D1_DATABASE_ID || "bee8445c-49fc-4458-8405-afa56575b7c9").trim();

  if (accountId && apiToken && databaseId && process.env.CF_USE_REMOTE_D1 === "true") {
    console.log(`[CF-D1] Connected via Cloudflare D1 HTTP API (Database: ${databaseId})`);
    cachedAdapter = new RemoteD1DatabaseAdapter(accountId, apiToken, databaseId);
    return cachedAdapter;
  }

  const sqlitePath = process.env.CF_LOCAL_D1_PATH || path.resolve(process.cwd(), "tmp", "abdomedi-cf-d1.sqlite");
  console.log(`[CF-D1] Using D1-compatible SQLite database at ${sqlitePath}`);
  cachedAdapter = new LocalSqliteD1Adapter(sqlitePath);
  return cachedAdapter;
}
