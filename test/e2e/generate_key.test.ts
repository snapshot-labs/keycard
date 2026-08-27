import { eq } from 'drizzle-orm';
import request from 'supertest';
import { limits } from '../../src/config.json';
import { closeDatabase, db } from '../../src/db';
import { whitelistAddress } from '../../src/methods';
import { keys, reqsDaily } from '../../src/schema';
import { sha256 } from '../../src/utils';
import { updateTotal } from '../../src/writer';
import { cleanupDb, HOST } from '../utils';

const SIGNATURE =
  '0xd71bd768491701b907ebbf5e1c7c14c5d354e96d5af24e618b7d9fcadcec126d01ba5366714b21a7a38680ba4fdbb61ca6ef72908e9ceb3f33e97589b5e31b301b';
const ADDRESS = '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3';
const GENERATED_KEY = sha256(SIGNATURE + ADDRESS);
const APP = Object.keys(limits)[0];

describe('POST / { method: generateKey }', () => {
  beforeEach(async () => {
    await cleanupDb(ADDRESS);
    await cleanupDb(GENERATED_KEY);
  });

  afterAll(async () => {
    await cleanupDb(ADDRESS);
    await cleanupDb(GENERATED_KEY);
    return closeDatabase();
  });

  describe('when the user is whitelisted', () => {
    it('update and return the key', async () => {
      await whitelistAddress({ name: 'test', address: ADDRESS });

      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'generate_key', params: { sig: SIGNATURE } });

      expect(response.status).toBe(200);
      expect(response.body.result.key).toHaveLength(64);
    });
  });

  describe('when the previous key already has usage', () => {
    it('carries the counters over to the new key', async () => {
      await whitelistAddress({ name: 'test', address: ADDRESS });
      const [{ key: previousKey }] = await db
        .select({ key: keys.key })
        .from(keys)
        .where(eq(keys.owner, ADDRESS));
      await updateTotal(previousKey, APP);

      const generateKey = () =>
        request(HOST)
          .post('/')
          .set({ secret: process.env.SECRET })
          .send({ method: 'generate_key', params: { sig: SIGNATURE } });

      const newKey = (await generateKey()).body.result.key;
      expect(newKey).not.toBe(previousKey);
      // Deterministic signers send the same signature every time: the repeat
      // call must not drop what the first one carried over.
      expect((await generateKey()).body.result.key).toBe(newKey);

      const counts = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'get_keys', params: { app: APP } });

      expect(counts.body.result[APP].key_counts[newKey]).toMatchObject({
        month: 1
      });
      expect(
        await db.select().from(reqsDaily).where(eq(reqsDaily.key, previousKey))
      ).toHaveLength(0);

      await cleanupDb(previousKey);
    });
  });

  describe('when the owner is stored lowercase (legacy rows)', () => {
    it('still authenticates via citext and returns the key', async () => {
      await db.insert(keys).values({
        owner: ADDRESS.toLowerCase(),
        name: 'test',
        key: 'test-citext-key'
      });

      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'generate_key', params: { sig: SIGNATURE } });

      expect(response.status).toBe(200);
      expect(response.body.result.key).toHaveLength(64);
    });
  });

  describe('when the signature is not valid', () => {
    it('update and return the key', async () => {
      await whitelistAddress({ name: 'test', address: ADDRESS });

      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'generate_key', params: { sig: 'test' } });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toContain('Invalid signature');
    });
  });

  describe('when the user is not whitelisted', () => {
    it('returns a 401 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'generate_key', params: { sig: SIGNATURE } });

      expect(response.status).toBe(401);
      expect(response.body.error.data).toContain('Not whitelisted');
    });
  });
});
