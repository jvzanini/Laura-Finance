import { Pool } from 'pg';

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

export const pool =
    globalForPg.pgPool ??
    new Pool({
        user: requireEnvInProd('POSTGRES_USER', 'laura'),
        password: requireEnvInProd('POSTGRES_PASSWORD', 'laura_password'),
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'laura_finance',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;
