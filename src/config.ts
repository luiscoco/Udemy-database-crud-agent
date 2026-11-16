import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AppContextSchema, type AppContext } from './domain.js';

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in .env before running this command.`);
  return value;
}

export function createPool(environmentName = 'DATABASE_URL'): Pool {
  const pool = new Pool({
    connectionString: requiredEnv(environmentName),
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 5000,
    lock_timeout: 2000,
    application_name: 'inventory-agent-course',
  });
  pool.on('error', () => console.error('An idle database connection failed. Check PostgreSQL availability.'));
  return pool;
}

/** A local instructor fixture, NOT authentication. Replace at a server boundary. */
export function demoContext(requestId = randomUUID()): AppContext {
  return AppContextSchema.parse({
    tenantId: requiredEnv('DEMO_TENANT_ID'),
    userId: requiredEnv('DEMO_USER_ID'),
    role: requiredEnv('DEMO_ROLE'),
    requestId,
  });
}
