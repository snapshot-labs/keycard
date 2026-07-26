import { eq } from 'drizzle-orm';
import request from 'supertest';
import { closeDatabase, db } from '../../src/db';
import { keys } from '../../src/schema';
import { cleanupDb, HOST } from '../utils';

const NAME = 'test-whitelist-name';
const ADDRESS = '0x0000000000000000000000000000000000000001';

describe('POST / { method: whitelist }', () => {
  beforeEach(async () => {
    await cleanupDb(ADDRESS);
  });

  afterAll(async () => {
    await cleanupDb(ADDRESS);
    return closeDatabase();
  });

  describe('on a valid payload', () => {
    it('whitelists the given address', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({
          method: 'whitelist',
          params: { name: NAME, address: ADDRESS }
        });

      expect(response.status).toBe(200);
      expect(response.body.result.success).toBe(true);
      expect(response.body.result.key).toHaveLength(64);
    });

    it('creates the new key on the Free tier (0)', async () => {
      await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({
          method: 'whitelist',
          params: { name: NAME, address: ADDRESS }
        });

      const [row] = await db
        .select({ tier: keys.tier })
        .from(keys)
        .where(eq(keys.owner, ADDRESS));
      expect(row.tier).toBe(0);
    });
  });

  describe('when the name is missing', () => {
    it('returns a 400 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'whitelist', params: { address: NAME } });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toContain('Missing name');
    });
  });

  describe('when the address is missing', () => {
    it('returns a 400 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'whitelist', params: { name: NAME } });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toContain('Missing address');
    });
  });

  describe('when the address is not valid', () => {
    it('returns a 400 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'whitelist', params: { name: NAME, address: NAME } });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toContain('Invalid address');
    });
  });

  describe('when the address is already whitelisted', () => {
    it('returns a 409 error', async () => {
      await db
        .insert(keys)
        .values({ owner: ADDRESS, name: NAME, key: 'test-whitelist-key' });

      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({
          method: 'whitelist',
          params: { name: NAME, address: ADDRESS }
        });

      expect(response.status).toBe(409);
      expect(response.body.error.data).toContain('already whitelisted');
    });
  });

  describe('when the name is too long', () => {
    it('returns a 400 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({
          method: 'whitelist',
          params: { name: 'x'.repeat(1000), address: ADDRESS }
        });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toContain('Name too long');
    });
  });
});
