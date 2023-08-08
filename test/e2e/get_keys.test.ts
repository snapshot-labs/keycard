import request from 'supertest';
import { HOST } from '../utils';

describe('POST / { method: get_keys }', () => {
  describe('when the given app exists', () => {
    it.todo('returns the requests usage of each key');
  });

  describe('when the given app does not exist', () => {
    it('returns a 401 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'get_keys', app: 'test' });

      expect(response.status).toBe(401);
      expect(response.body.error.data).toContain('not allowed');
    });
  });
});
