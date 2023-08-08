import request from 'supertest';
import db from '../../src/helpers/mysql';
import { whitelistAddress } from '../../src/methods';
import { cleanupDb, HOST } from '../utils';

const SIGNATURE =
  '0xd71bd768491701b907ebbf5e1c7c14c5d354e96d5af24e618b7d9fcadcec126d01ba5366714b21a7a38680ba4fdbb61ca6ef72908e9ceb3f33e97589b5e31b301b';
const ADDRESS = '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3';

describe('POST / { method: generateKey }', () => {
  beforeEach(async () => {
    await cleanupDb(ADDRESS);
  });

  afterAll(async () => {
    await cleanupDb(ADDRESS);
    return db.endAsync();
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
