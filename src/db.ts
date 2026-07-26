import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10e3,
    query_timeout: 15e3,
    idleTimeoutMillis: 30e3,
    maxLifetimeSeconds: 600,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10e3
  },
  schema
});

// Stable app-wide advisory lock key ('keyc' in ASCII); any fixed int works.
const MIGRATION_LOCK_ID = 0x6b657963;

export async function runMigrations() {
  // drizzle's migrator takes no lock itself; serialize replicas here so
  // concurrent startups can't race on CREATE TABLE / pending migrations.
  // Session advisory locks require a direct (non-pooled) connection: behind a
  // transaction-mode pooler (PgBouncer/PSBouncer port 6432) they leak and
  // don't serialize — keep DATABASE_URL on the direct port (5432).
  const client = await db.$client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await migrate(db, { migrationsFolder: 'drizzle' });
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    client.release();
  }
}

export async function closeDatabase() {
  await db.$client.end();
  console.log('Database connection pool closed.');
}
