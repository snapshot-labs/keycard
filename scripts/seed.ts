import 'dotenv/config';
import { closeDatabase, db } from '../src/db';
import { keys } from '../src/schema';

const SEED_KEYS = [
  { key: '123456789', name: 'API key for free users', owner: 'test' },
  {
    key: '987654321',
    name: 'API key for pro users',
    owner: 'test1',
    tier: 1
  }
];

async function seed() {
  console.log(`Seeding ${SEED_KEYS.length} API keys...`);
  const inserted = await db
    .insert(keys)
    .values(SEED_KEYS)
    .onConflictDoNothing()
    .returning({ key: keys.key, owner: keys.owner });
  inserted.forEach(row =>
    console.log(`- Inserted key ${row.key} (owner: ${row.owner})`)
  );
  console.log(
    `Seed complete: ${inserted.length} inserted, ${
      SEED_KEYS.length - inserted.length
    } already existed`
  );
}

seed()
  .catch(err => {
    console.error('Seed failed', err);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase().catch(() => undefined));
