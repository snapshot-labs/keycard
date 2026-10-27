import http from 'http';
import { Wallet } from '@ethersproject/wallet';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { closeDatabase, db } from '../../src/db';
import { keys } from '../../src/schema';
import { cleanupDb, HOST } from '../utils';

const DOMAIN = { name: 'snapshot', version: '0.1.4' };

const TYPES = {
  create_key: {
    CreateKey: [
      { name: 'from', type: 'address' },
      { name: 'alias', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'timestamp', type: 'uint64' }
    ]
  },
  rename_key: {
    RenameKey: [
      { name: 'from', type: 'address' },
      { name: 'alias', type: 'address' },
      { name: 'key', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'timestamp', type: 'uint64' }
    ]
  },
  delete_key: {
    DeleteKey: [
      { name: 'from', type: 'address' },
      { name: 'alias', type: 'address' },
      { name: 'key', type: 'string' },
      { name: 'timestamp', type: 'uint64' }
    ]
  }
};

const OWNER = '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6';

const registered = new Set<string>();
let hub: http.Server;

async function send(
  method: keyof typeof TYPES,
  wallet: Wallet,
  fields: Record<string, string>
) {
  const message = {
    from: OWNER,
    alias: wallet.address,
    ...fields,
    timestamp: Math.floor(Date.now() / 1e3)
  };
  const sig = await wallet._signTypedData(DOMAIN, TYPES[method], message);

  return request(HOST)
    .post('/')
    .send({ method, params: { ...message, sig } });
}

const createKey = (wallet: Wallet, name: string) =>
  send('create_key', wallet, { name });

async function getKey(key: string) {
  const [row] = await db.select().from(keys).where(eq(keys.key, key));
  return row;
}

function registeredWallet() {
  const wallet = Wallet.createRandom();
  registered.add(`${OWNER}:${wallet.address}`.toLowerCase());
  return wallet;
}

beforeAll(done => {
  hub = http
    .createServer((req, res) => {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        const { address, alias } = JSON.parse(body).variables;
        const aliases = registered.has(`${address}:${alias}`.toLowerCase())
          ? [{ address, alias }]
          : [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: { aliases } }));
      });
    })
    .listen(3078, done);
});

beforeEach(async () => {
  registered.clear();
  await db.delete(keys).where(eq(keys.owner, OWNER));
});

afterAll(async () => {
  await cleanupDb(OWNER);
  hub.close();
  return closeDatabase();
});

describe('POST / { method: create_key }', () => {
  it('creates a key for the owner', async () => {
    const response = await createKey(registeredWallet(), 'my app');

    expect(response.status).toBe(200);
    const { key, name, created } = response.body.result;
    expect(name).toBe('my app');
    expect(created).toBeGreaterThan(0);
    expect(await getKey(key)).toMatchObject({
      owner: OWNER,
      name: 'my app',
      tier: 0
    });
  });

  it('rejects a name already used by the owner', async () => {
    const wallet = registeredWallet();
    await createKey(wallet, 'my app');

    const response = await createKey(wallet, 'my app');

    expect(response.status).toBe(409);
    expect(response.body.error.data).toContain('Name already used');
  });

  it('rejects more keys than allowed per owner', async () => {
    const wallet = registeredWallet();
    for (let i = 0; i < 5; i++) await createKey(wallet, `key ${i}`);

    const response = await createKey(wallet, 'one too many');

    expect(response.status).toBe(403);
    expect(response.body.error.data).toContain('Too many keys');
  });

  it('rejects an invalid name', async () => {
    const response = await createKey(registeredWallet(), 'a'.repeat(33));

    expect(response.status).toBe(400);
    expect(response.body.error.data).toContain('Name too long');
  });

  it('rejects an alias not registered for the owner', async () => {
    const response = await createKey(Wallet.createRandom(), 'my app');

    expect(response.status).toBe(401);
    expect(response.body.error.data).toContain('Alias not authorized');
  });
});

describe('POST / { method: rename_key }', () => {
  it('renames a key of the owner', async () => {
    const wallet = registeredWallet();
    const { key } = (await createKey(wallet, 'my app')).body.result;

    const response = await send('rename_key', wallet, { key, name: 'new' });

    expect(response.status).toBe(200);
    expect((await getKey(key)).name).toBe('new');
  });

  it('rejects a name used by another key of the owner', async () => {
    const wallet = registeredWallet();
    const { key } = (await createKey(wallet, 'my app')).body.result;
    await createKey(wallet, 'other');

    const response = await send('rename_key', wallet, { key, name: 'other' });

    expect(response.status).toBe(409);
    expect(response.body.error.data).toContain('Name already used');
  });

  it('rejects a key of another owner', async () => {
    const response = await send('rename_key', registeredWallet(), {
      key: 'not-a-key',
      name: 'new'
    });

    expect(response.status).toBe(404);
    expect(response.body.error.data).toContain('Key not found');
  });
});

describe('POST / { method: delete_key }', () => {
  it('deactivates a key of the owner and frees its name', async () => {
    const wallet = registeredWallet();
    const { key } = (await createKey(wallet, 'my app')).body.result;

    const response = await send('delete_key', wallet, { key });

    expect(response.status).toBe(200);
    expect((await getKey(key)).active).toBe(false);
    expect((await createKey(wallet, 'my app')).status).toBe(200);
  });

  it('rejects a key already deleted', async () => {
    const wallet = registeredWallet();
    const { key } = (await createKey(wallet, 'my app')).body.result;
    await send('delete_key', wallet, { key });

    const response = await send('delete_key', wallet, { key });

    expect(response.status).toBe(404);
    expect(response.body.error.data).toContain('Key not found');
  });

  it('rejects an alias not registered for the owner', async () => {
    const wallet = registeredWallet();
    const { key } = (await createKey(wallet, 'my app')).body.result;

    const response = await send('delete_key', Wallet.createRandom(), { key });

    expect(response.status).toBe(401);
    expect((await getKey(key)).active).toBe(true);
  });
});
