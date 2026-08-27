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
  return db.transaction(async tx => {
    // The counter tables are keyed by the key value, so rotating it must move
    // them too, or the owner loses its usage history and gets a fresh monthly
    // quota mid-period. FOR UPDATE serialises concurrent generate_key calls
    // for the same owner, which would otherwise split counters across keys.
    const [previous] = await tx
      .select({ key: keys.key })
      .from(keys)
      .where(eq(keys.owner, owner))
      .for('update');
    if (!previous) return false;
    if (previous.key === key) return true;

    // Plain UPDATEs, not merges: the new key is a fresh hash with no counter
    // rows of its own, so the (key, ...) primary keys cannot collide.
    await tx.update(keys).set({ key }).where(eq(keys.owner, owner));
    await tx.update(reqs).set({ key }).where(eq(reqs.key, previous.key));
    await tx
      .update(reqsDaily)
      .set({ key })
      .where(eq(reqsDaily.key, previous.key));
    await tx
      .update(reqsMonthly)
      .set({ key })
      .where(eq(reqsMonthly.key, previous.key));
    return true;
  });
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
