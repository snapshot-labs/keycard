import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import {
  currentDay,
  currentMonth,
  keys,
  reqs,
  reqsDaily,
  reqsMonthly
} from './schema';

export const updateTotal = async (key: string, app: string) => {
  // Independent approximate counters; no cross-row atomicity needed, so no
  // transaction. A rare partial failure just undercounts by one, self-heals.
  // Kept sequential on purpose: Promise.all would grab 2 pool connections per
  // request on this hot path, and the tight single-instance pool makes that
  // connection pressure cost more than the saved latency.
  await db
    .insert(reqs)
    .values({ key, app, total: 1 })
    .onConflictDoUpdate({
      target: [reqs.key, reqs.app],
      set: { total: sql`${reqs.total} + 1`, last_active: sql`now()` }
    });
  await db
    .insert(reqsDaily)
    .values({ key, app, day: currentDay, total: 1 })
    .onConflictDoUpdate({
      target: [reqsDaily.key, reqsDaily.day, reqsDaily.app],
      set: { total: sql`${reqsDaily.total} + 1` }
    });
  await db
    .insert(reqsMonthly)
    .values({ key, app, month: currentMonth, total: 1 })
    .onConflictDoUpdate({
      target: [reqsMonthly.key, reqsMonthly.month, reqsMonthly.app],
      set: { total: sql`${reqsMonthly.total} + 1` }
    });
};

export const updateKey = async (key: string, owner: string) => {
  const updated = await db
    .update(keys)
    .set({ key })
    .where(eq(keys.owner, owner))
    .returning({ owner: keys.owner });
  return updated.length > 0;
};

export const createNewKey = async (
  owner: string,
  name: string,
  key: string
) => {
  const inserted = await db
    .insert(keys)
    .values({ owner, name, key })
    .onConflictDoNothing({ target: keys.owner })
    .returning({ owner: keys.owner });
  return inserted.length > 0;
};
