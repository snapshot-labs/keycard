import { and, eq, sql } from 'drizzle-orm';
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
  if (await db.$count(keys, eq(keys.owner, owner))) return false;

  await db.insert(keys).values({ owner, name, key });
  return true;
};

export const insertKey = async (owner: string, name: string, key: string) => {
  const [row] = await db
    .insert(keys)
    .values({ owner, name, key })
    .returning({ created: keys.created });
  return row.created.getTime();
};

// Only touches active keys, so a deleted key can't be renamed or deleted again
export const updateOwnerKey = async (
  owner: string,
  key: string,
  values: { name?: string; active?: boolean }
) => {
  const updated = await db
    .update(keys)
    .set(values)
    .where(and(eq(keys.key, key), eq(keys.owner, owner), eq(keys.active, true)))
    .returning({ key: keys.key });
  return updated.length > 0;
};
