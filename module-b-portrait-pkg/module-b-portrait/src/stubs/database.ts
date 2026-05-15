// Stub for api/src/utils/database.ts.
//
// personaCard.ts uses `pool.get/run` for the dating_persona_card_cache table
// and `safeJsonParse` for jsonb columns. In coursework there is no database;
// every cache lookup misses, every save is a no-op, and the algorithm path is
// recomputed each call. The "missing relation" branch (`42P01`) in the
// vendored file already handles that, so we throw it from `pool.get` to keep
// the same code path warm.
//
// safeJsonParse is also used to parse profile/answers when reading dating
// rows. We keep an honest implementation that mirrors the upstream version.

class MissingRelationError extends Error {
  code = '42P01';
  constructor() {
    super('relation not configured in coursework module');
  }
}

export const pool = {
  async get(_sql: string, _params?: unknown[]): Promise<any> {
    throw new MissingRelationError();
  },
  async run(_sql: string, _params?: unknown[]): Promise<void> {
    // No-op: cache writes are silently skipped.
  },
  async query(_sql: string, _params?: unknown[]): Promise<{ rows: any[] }> {
    return { rows: [] };
  },
};

export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
