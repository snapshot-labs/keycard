import request from 'supertest';

const HOST = `http://localhost:${process.env.PORT || 3077}`;

describe('POST /', () => {
  describe('when passing an invalid method', () => {
    it('returns a 400 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ method: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toBe('invalid method');
    });
  });

  describe('when method is missing', () => {
    it('returns a 400 error', async () => {
      const response = await request(HOST)
        .post('/')
        .set({ secret: process.env.SECRET })
        .send({ something: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toBe('missing method');
    });
  });

  describe('when failing the auth check', () => {
    it('returns a 401 error', async () => {
      const response = await request(HOST).post('/').set({ secret: 'test' });

      expect(response.status).toBe(401);
    });
  });
});
