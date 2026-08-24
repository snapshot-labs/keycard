import { eq, or } from 'drizzle-orm';
import { db } from '../src/db';
import { keys, reqs, reqsDaily, reqsMonthly } from '../src/schema';

export const HOST = `http://localhost:${process.env.PORT || 3077}`;

export async function cleanupDb(key = '') {
  await db.transaction(async tx => {
    await tx
      .delete(keys)
      .where(or(eq(keys.key, key), eq(keys.name, key), eq(keys.owner, key)));
    await tx.delete(reqs).where(eq(reqs.key, key));
    await tx.delete(reqsDaily).where(eq(reqsDaily.key, key));
    await tx.delete(reqsMonthly).where(eq(reqsMonthly.key, key));
  });
}
