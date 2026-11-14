export interface D1LikeRunResult {
  success?: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number;
    duration?: number;
  };
}

export interface D1LikeAllResult<T = Record<string, unknown>> {
  results: T[];
  success?: boolean;
}

export interface D1LikePreparedStatement {
  bind(...values: unknown[]): D1LikePreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1LikeAllResult<T>>;
  run(): Promise<D1LikeRunResult>;
}

export interface D1LikeDatabase {
  prepare(query: string): D1LikePreparedStatement;
  batch<T = unknown>(statements: D1LikePreparedStatement[]): Promise<T[]>;
}

export type JsonResponder = (request: Request, env: any, body: unknown, status?: number) => Response;
