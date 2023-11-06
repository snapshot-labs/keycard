import request from 'supertest';
import db from '../../src/helpers/mysql';
import { updateTotal } from '../../src/writer';
import { limits } from '../../src/config.json';
import { cleanupDb, HOST } from '../utils';

const NAME = 'test-get-keys-name';
const ADDRESS = '0x0000000000000000000000000000000000000002';
const KEY = 'test-get-keys-key';

const apps = Object.keys(limits);

describe('POST / { method: get_keys }', () => {
  describe('when the given app exists', () => {
    beforeEach(async () => {
      await cleanupDb(KEY);
    });

    afterAll(async () => {
      await cleanupDb(KEY);
      return db.endAsync();
    });

    it('returns the requests usage of each key', async () => {
      await db.queryAsync('INSERT INTO `keys` (owner, name, `key`) VALUES (?, ?, ?)', [
        ADDRESS,
        NAME,
        KEY
      ]);
      await updateTotal(KEY, apps[0]);

      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'get_keys', params: { app: apps[0] } });

      expect(response.status).toBe(200);
      expect(response.body.result[apps[0]].key_counts[KEY]).toMatchObject({
        tier: 0,
        month: 1
      });
      expect(response.body.result[apps[0]].limits.monthly).toBe(limits[apps[0]][0].monthly);
      expect(parseInt(response.body.result[apps[0]].reset)).toBeGreaterThan(Date.now() / 1e3);
    });
  });

  describe('when the given app does not exist', () => {
    it('returns a 401 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'get_keys', params: { app: 'test' } });

      expect(response.status).toBe(401);
      expect(response.body.error.data).toContain('not allowed');
    });
  });
});
