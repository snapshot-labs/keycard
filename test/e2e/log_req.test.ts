import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { limits } from '../../src/config.json';
import { closeDatabase, db } from '../../src/db';
import { currentMonth, keys, reqs, reqsMonthly } from '../../src/schema';
import { updateTotal } from '../../src/writer';
import { cleanupDb, HOST } from '../utils';

const NAME = 'test-log-req-name';
const ADDRESS = '0x0000000000000000000000000000000000000000';
const KEY = 'test-log-req-key';

const apps = Object.keys(limits);

async function getTotals(key: string) {
  const [{ total, last_active }] = await db
    .select({ total: reqs.total, last_active: reqs.last_active })
    .from(reqs)
    .where(eq(reqs.key, key));
  const [{ total: monthlyTotal }] = await db
    .select({ total: reqsMonthly.total })
    .from(reqsMonthly)
    .where(and(eq(reqsMonthly.month, currentMonth), eq(reqsMonthly.key, key)));

  return { total, last_active, monthlyTotal };
}

describe('POST / { method: log_req }', () => {
  beforeEach(async () => {
    await cleanupDb(KEY);
  });

  afterAll(async () => {
    await cleanupDb(KEY);
    return closeDatabase();
  });

  describe('when the app does not exists', () => {
    it('returns a 401 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'log_req', params: { app: 'test', key: 'key' } });

      expect(response.status).toBe(401);
      expect(response.body.error.data).toContain('not allowed');
    });
  });

  describe('when the key does not exist', () => {
    it('returns a 401 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'log_req', params: { app: apps[0], key: 'key' } });

      expect(response.status).toBe(401);
      expect(response.body.error.data).toContain('Key does not exist');
    });
  });

  describe('when the key is not active', () => {
    it('returns a 401 error', async () => {
      await db
        .insert(keys)
        .values({ owner: ADDRESS, name: NAME, active: false, key: KEY });

      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'log_req', params: { app: apps[0], key: KEY } });

      expect(response.status).toBe(401);
      expect(response.body.error.data).toContain('Key is not active');
    });
  });

  describe('when the key is active', () => {
    it('increments the key total usage', async () => {
      await db.insert(keys).values({ owner: ADDRESS, name: NAME, key: KEY });
      await updateTotal(KEY, apps[0]);

      const before = await getTotals(KEY);

      await new Promise(r => setTimeout(r, 1000));

      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'log_req', params: { app: apps[0], key: KEY } });

      await new Promise(r => setTimeout(r, 1000));

      const after = await getTotals(KEY);

      expect(response.status).toBe(200);
      expect(response.body.result.success).toBe(true);
      expect(after.last_active.getTime()).toBeGreaterThan(
        before.last_active.getTime()
      );
      expect(after.total).toBeGreaterThan(before.total);
      expect(after.monthlyTotal).toBeGreaterThan(before.monthlyTotal);
    });

    it('rejects a key that differs only in casing', async () => {
      await db.insert(keys).values({ owner: ADDRESS, name: NAME, key: KEY });

      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({
          method: 'log_req',
          params: { app: apps[0], key: KEY.toUpperCase() }
        });

      await new Promise(r => setTimeout(r, 1000));

      const rows = await db
        .select({ key: reqs.key })
        .from(reqs)
        .where(eq(reqs.key, KEY));

      // Keys are opaque case-sensitive credentials on PostgreSQL (text):
      // a differently-cased key is a different key and must not log usage.
      expect(response.status).toBe(401);
      expect(response.body.error.data).toContain('Key does not exist');
      expect(rows).toHaveLength(0);
    });
  });
});
