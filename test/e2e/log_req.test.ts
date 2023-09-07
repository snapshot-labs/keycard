import request from 'supertest';
import db from '../../src/helpers/mysql';
import { limits } from '../../src/config.json';
import { updateTotal } from '../../src/writer';
import { HOST, cleanupDb } from '../utils';

const NAME = 'test-log-req-name';
const ADDRESS = '0x0000000000000000000000000000000000000000';
const KEY = 'test-log-req-key';

const apps = Object.keys(limits);

describe('POST / { method: log_req }', () => {
  beforeEach(async () => {
    await cleanupDb(KEY);
  });

  afterAll(async () => {
    await cleanupDb(KEY);
    return db.endAsync();
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
      await db.queryAsync('INSERT INTO `keys` (owner, name, active, `key`) VALUES (?, ?, 0, ?)', [
        ADDRESS,
        NAME,
        KEY
      ]);

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
      await db.queryAsync('INSERT INTO `keys` (owner, name, `key`) VALUES (?, ?, ?)', [
        ADDRESS,
        NAME,
        KEY
      ]);
      await updateTotal(KEY, apps[0]);

      const { total: beforeTotal, last_active: beforeLastActive } = (
        await db.queryAsync('SELECT total, last_active from reqs WHERE `key` = ?', KEY)
      )[0];
      const { total: beforeDailyTotal } = (
        await db.queryAsync(
          "SELECT total from reqs_daily WHERE day = DATE_FORMAT(CURRENT_TIMESTAMP, '%d-%m-%Y') AND `key` = ?",
          KEY
        )
      )[0];
      const { total: beforeMonthlyTotal } = (
        await db.queryAsync(
          "SELECT total from reqs_monthly WHERE month = DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y') AND `key` = ?",
          KEY
        )
      )[0];

      await new Promise(r => setTimeout(r, 1000));

      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'log_req', params: { app: apps[0], key: KEY } });

      await new Promise(r => setTimeout(r, 1000));

      const { total: afterTotal, last_active: afterLastActive } = (
        await db.queryAsync('SELECT total, last_active from reqs WHERE `key` = ?', KEY)
      )[0];
      const { total: afterDailyTotal } = (
        await db.queryAsync(
          "SELECT total from reqs_daily WHERE day = DATE_FORMAT(CURRENT_TIMESTAMP, '%d-%m-%Y') AND `key` = ?",
          KEY
        )
      )[0];
      const { total: afterMonthlyTotal } = (
        await db.queryAsync(
          "SELECT total from reqs_monthly WHERE month = DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y') AND `key` = ?",
          KEY
        )
      )[0];

      expect(response.status).toBe(200);
      expect(response.body.result.success).toBe(true);
      expect(afterLastActive).toBeGreaterThan(beforeLastActive);
      expect(afterTotal).toBeGreaterThan(beforeTotal);
      expect(afterDailyTotal).toBeGreaterThan(beforeDailyTotal);
      expect(afterMonthlyTotal).toBeGreaterThan(beforeMonthlyTotal);
    });
  });
});
