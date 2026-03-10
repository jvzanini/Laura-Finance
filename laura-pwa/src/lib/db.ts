import { Pool } from 'pg';

// Create a singleton instance for PostgreSQL connection
const globalForPg = globalThis as unknown as {
    pgPool: Pool | undefined;
};

export const pool =
    globalForPg.pgPool ??
    new Pool({
        user: process.env.POSTGRES_USER || 'laura',
        password: process.env.POSTGRES_PASSWORD || 'laura_password',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'laura_finance',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;
