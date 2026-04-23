import pg from 'pg';
import { createHash } from 'node:crypto';

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

let pool: pg.Pool | null = null;
let poolInitFailed = false;
let schemaReady: Promise<void> | null = null;

function getPool(): pg.Pool | null {
  if (pool || poolInitFailed) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    poolInitFailed = true;
    return null;
  }
  try {
    pool = new pg.Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on('error', (err) => {
      console.error('[rateLimit] pg pool error:', err);
    });
    return pool;
  } catch (err) {
    console.error('[rateLimit] failed to init pg pool:', err);
    poolInitFailed = true;
    return null;
  }
}

async function ensureSchema(p: pg.Pool): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await p.query(`
      CREATE TABLE IF NOT EXISTS lead_rate_limit_hits (
        id BIGSERIAL PRIMARY KEY,
        ip TEXT NOT NULL,
        hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_lead_rate_limit_hits_ip_time
        ON lead_rate_limit_hits (ip, hit_at DESC);
      CREATE INDEX IF NOT EXISTS idx_lead_rate_limit_hits_time
        ON lead_rate_limit_hits (hit_at);
    `);
  })().catch((err) => {
    // Reset so a later request can retry schema setup.
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

const memoryBuckets = new Map<string, number[]>();

function checkRateLimitMemory(ip: string): RateLimitResult {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (memoryBuckets.get(ip) || []).filter((t) => t > cutoff);

  if (memoryBuckets.size > 5000) {
    for (const [k, v] of memoryBuckets) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) memoryBuckets.delete(k);
      else memoryBuckets.set(k, fresh);
    }
  }

  if (hits.length >= RATE_LIMIT_MAX) {
    const retryAfter = Math.max(
      1,
      Math.ceil((hits[0] + RATE_LIMIT_WINDOW_MS - now) / 1000)
    );
    return { allowed: false, retryAfter };
  }

  hits.push(now);
  memoryBuckets.set(ip, hits);
  return { allowed: true, retryAfter: 0 };
}

let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

async function maybeSweep(p: pg.Pool): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  try {
    await p.query(
      `DELETE FROM lead_rate_limit_hits WHERE hit_at < NOW() - ($1 || ' seconds')::interval`,
      [String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))]
    );
  } catch (err) {
    console.error('[rateLimit] sweep failed:', err);
  }
}

// Map an arbitrary IP string to a stable signed 64-bit int for pg_advisory_xact_lock.
function ipLockKey(ip: string): string {
  const h = createHash('sha256').update(ip).digest();
  // Take first 8 bytes, interpret as signed BigInt.
  const u = h.readBigUInt64BE(0);
  const signed = u >= 0x8000000000000000n ? u - 0x10000000000000000n : u;
  return signed.toString();
}

async function checkRateLimitDb(ip: string): Promise<RateLimitResult> {
  const p = getPool();
  if (!p) return checkRateLimitMemory(ip);

  try {
    await ensureSchema(p);
  } catch (err) {
    console.error('[rateLimit] schema setup failed, falling back to memory:', err);
    return checkRateLimitMemory(ip);
  }

  const windowSeconds = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
  const lockKey = ipLockKey(ip);
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    // Serialize concurrent check+insert for the same IP across all instances.
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [lockKey]);

    const { rows } = await client.query<{ hit_at: Date }>(
      `SELECT hit_at FROM lead_rate_limit_hits
       WHERE ip = $1 AND hit_at > NOW() - ($2 || ' seconds')::interval
       ORDER BY hit_at ASC`,
      [ip, String(windowSeconds)]
    );

    if (rows.length >= RATE_LIMIT_MAX) {
      await client.query('COMMIT');
      const earliest = rows[0].hit_at.getTime();
      const retryAfter = Math.max(
        1,
        Math.ceil((earliest + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000)
      );
      return { allowed: false, retryAfter };
    }

    await client.query(
      `INSERT INTO lead_rate_limit_hits (ip) VALUES ($1)`,
      [ip]
    );
    await client.query('COMMIT');

    maybeSweep(p).catch(() => {});

    return { allowed: true, retryAfter: 0 };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error('[rateLimit] db check failed, falling back to memory:', err);
    return checkRateLimitMemory(ip);
  } finally {
    client.release();
  }
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimitDb(ip);
}
