import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL,
    // Single instance, direct connection to a 25-connection cluster.
    connectionTimeoutMillis: 10e3,
    query_timeout: 15e3,
    idleTimeoutMillis: 30e3,
    maxLifetimeSeconds: 600,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10e3
  },
  schema
});

export async function runMigrations() {
  // No advisory lock — safe single-instance only; concurrent replicas
  // can race on pending migrations (wrap in pg_advisory_lock if scaling out)
  await migrate(db, { migrationsFolder: 'drizzle' });
}

export async function closeDatabase() {
  await db.$client.end();
  console.log('Database connection pool closed.');
}
