import http from 'http';
import { Wallet } from '@ethersproject/wallet';
import request from 'supertest';
import db from '../../src/helpers/mysql';
import { whitelistAddress } from '../../src/methods';
import { cleanupDb, HOST } from '../utils';

const DOMAIN = { name: 'snapshot', version: '0.1.4' };

const GetKeysSchema = {
  GetKeys: [
    { name: 'from', type: 'string' },
    { name: 'alias', type: 'address' },
    { name: 'timestamp', type: 'uint64' }
  ]
};

const OWNER = '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6';

const registered = new Set<string>();
let hubMode: 'ok' | 'graphql-error' | 'http-error' = 'ok';
let hub: http.Server;

async function signedParams(
  wallet: Wallet,
  from: string,
  alias = wallet.address
) {
  const message = { from, alias, timestamp: Math.floor(Date.now() / 1e3) };
  const sig = await wallet._signTypedData(DOMAIN, GetKeysSchema, message);

  return { ...message, sig };
}

function registerAlias(address: string, alias: string) {
  registered.add(`${address}:${alias}`.toLowerCase());
}

describe('POST / { method: get_keys_by_owner }', () => {
  beforeAll(done => {
    hub = http
      .createServer((req, res) => {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          if (hubMode === 'http-error') {
            res.writeHead(500);
            return res.end();
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (hubMode === 'graphql-error') {
            return res.end(
              JSON.stringify({ errors: [{ message: 'rate limited' }] })
            );
          }

          const { address, alias } = JSON.parse(body).variables;
          const aliases = registered.has(`${address}:${alias}`.toLowerCase())
            ? [{ address, alias }]
            : [];
          res.end(JSON.stringify({ data: { aliases } }));
        });
      })
      .listen(3078, done);
  });

  beforeEach(async () => {
    hubMode = 'ok';
    registered.clear();
    await cleanupDb(OWNER);
  });

  afterAll(async () => {
    await cleanupDb(OWNER);
    hub.close();
    return db.endAsync();
  });

  describe('when the alias is registered for the owner', () => {
    it('returns the keys including the key value', async () => {
      const { key } = await whitelistAddress({
        name: 'test key',
        address: OWNER
      });
      const wallet = Wallet.createRandom();
      registerAlias(OWNER, wallet.address);

      const response = await request(HOST)
        .post('/')
        .send({
          method: 'get_keys_by_owner',
          params: await signedParams(wallet, OWNER)
        });

      expect(response.status).toBe(200);
      expect(response.body.result.keys).toHaveLength(1);
      expect(response.body.result.keys[0].key).toBe(key);
      expect(response.body.result.keys[0].name).toBe('test key');
    });

    it('returns an empty list when the owner has no keys', async () => {
      const wallet = Wallet.createRandom();
      registerAlias(OWNER, wallet.address);

      const response = await request(HOST)
        .post('/')
        .send({
          method: 'get_keys_by_owner',
          params: await signedParams(wallet, OWNER)
        });

      expect(response.status).toBe(200);
      expect(response.body.result.keys).toEqual([]);
    });
  });

  describe('when the alias is not registered for the owner', () => {
    it('returns a 401 error', async () => {
      const wallet = Wallet.createRandom();

      const response = await request(HOST)
        .post('/')
        .send({
          method: 'get_keys_by_owner',
          params: await signedParams(wallet, OWNER)
        });

      expect(response.status).toBe(401);
      expect(response.body.error.data).toContain('Alias not authorized');
    });
  });

  describe('when the signature is not valid', () => {
    it('returns a 400 error', async () => {
      const wallet = Wallet.createRandom();

      const response = await request(HOST)
        .post('/')
        .send({
          method: 'get_keys_by_owner',
          params: {
            ...(await signedParams(wallet, OWNER)),
            sig: 'test'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toContain('Invalid signature');
    });

    it('returns a 400 error when signed by another alias', async () => {
      const wallet = Wallet.createRandom();
      const otherAlias = Wallet.createRandom().address;
      registerAlias(OWNER, otherAlias);

      const response = await request(HOST)
        .post('/')
        .send({
          method: 'get_keys_by_owner',
          params: await signedParams(wallet, OWNER, otherAlias)
        });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toContain('Invalid signature');
    });
  });

  describe('when the address is not valid', () => {
    it('returns a 400 error', async () => {
      const wallet = Wallet.createRandom();

      const response = await request(HOST)
        .post('/')
        .send({
          method: 'get_keys_by_owner',
          params: await signedParams(wallet, 'test')
        });

      expect(response.status).toBe(400);
      expect(response.body.error.data).toContain('Invalid address');
    });
  });

  describe('when the hub is not available', () => {
    it('returns a 500 error on hub failure', async () => {
      hubMode = 'http-error';
      const wallet = Wallet.createRandom();
      registerAlias(OWNER, wallet.address);

      const response = await request(HOST)
        .post('/')
        .send({
          method: 'get_keys_by_owner',
          params: await signedParams(wallet, OWNER)
        });

      expect(response.status).toBe(500);
    });

    it('returns a 500 error on hub graphql errors', async () => {
      hubMode = 'graphql-error';
      const wallet = Wallet.createRandom();
      registerAlias(OWNER, wallet.address);

      const response = await request(HOST)
        .post('/')
        .send({
          method: 'get_keys_by_owner',
          params: await signedParams(wallet, OWNER)
        });

      expect(response.status).toBe(500);
    });
  });
});
