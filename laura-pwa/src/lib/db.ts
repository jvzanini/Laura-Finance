import { Pool } from 'pg';

// Lazy init: valida env vars apenas no primeiro uso em runtime.
// Antes o Pool era construído top-level, disparando `throw` durante
// `next build` (coleta page data importa módulos sem env real).
// Proxy mantém a API `pool.query/connect` dos callers.

function requireEnvInProd(key: string, fallback: string): string {
    const value = process.env[key];
    if (value) return value;
    if (process.env.NODE_ENV === 'production') {
        throw new Error(`${key} é obrigatória em produção`);
    }
    return fallback;
}

const globalForPg = globalThis as unknown as {
    pgPool: Pool | undefined;
};

function resolvePool(): Pool {
    if (globalForPg.pgPool) return globalForPg.pgPool;
    const p = new Pool({
        user: requireEnvInProd('POSTGRES_USER', 'laura'),
        password: requireEnvInProd('POSTGRES_PASSWORD', 'laura_password'),
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'laura_finance',
        max: parseInt(process.env.PG_POOL_MAX || '100'),
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
    });
    if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = p;
    return p;
}

export const pool = new Proxy({} as Pool, {
    get(_target, prop) {
        return (resolvePool() as unknown as Record<string | symbol, unknown>)[prop];
    },
}) as Pool;
