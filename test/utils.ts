import { eq, or } from 'drizzle-orm';
import { db } from '../src/db';
import { keys, reqs, reqsMonthly } from '../src/schema';

export const HOST = `http://localhost:${process.env.PORT || 3077}`;

export async function cleanupDb(key = '') {
  await Promise.all([
    db
      .delete(keys)
      .where(or(eq(keys.key, key), eq(keys.name, key), eq(keys.owner, key))),
    db.delete(reqs).where(eq(reqs.key, key)),
    db.delete(reqsMonthly).where(eq(reqsMonthly.key, key))
  ]);
}
