import { readFile } from 'node:fs/promises';
import { createPool } from '../src/config.js';

const pool = createPool('DATABASE_ADMIN_URL');
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(await readFile(new URL('../sql/001_init.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../sql/002_runtime_role.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
    console.log('Database schema and local runtime role are ready.');
  } catch {
    await client.query('ROLLBACK');
    throw new Error('Database setup failed.');
  } finally { client.release(); }
} catch {
  console.error('Database setup failed. Check the local PostgreSQL container and DATABASE_ADMIN_URL.');
  process.exitCode = 1;
} finally { await pool.end(); }
