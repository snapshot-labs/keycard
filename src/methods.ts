import { randomUUID } from 'crypto';
import { getAddress } from '@ethersproject/address';
import { verifyMessage } from '@ethersproject/wallet';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { and, eq } from 'drizzle-orm';
import { limits } from './config.json';
import { db } from './db';
import { isAliasOf } from './helpers/aliases';
import { recoverGetKeysSigner } from './helpers/eip712';
import { currentMonth, keys, reqsMonthly } from './schema';
import { sha256 } from './utils';
import { createNewKey, updateKey, updateTotal } from './writer';

const apps = Object.keys(limits);
const SIGNATURE_WINDOW = 300; // 5 minutes before or after the server time

type GetKeysByOwnerParams = {
  from: string;
  alias: string;
  timestamp: number;
  sig: string;
};

const getKey = async (key: string) => {
  const [keyData] = await db
    .select({ active: keys.active })
    .from(keys)
    .where(eq(keys.key, key));
  return keyData;
};

const getActiveKeys = async (app: string) => {
  return db
    .select({
      key: keys.key,
      tier: keys.tier,
      month_total: reqsMonthly.total
    })
    .from(keys)
    .leftJoin(
      reqsMonthly,
      and(
        eq(reqsMonthly.key, keys.key),
        eq(reqsMonthly.month, currentMonth),
        eq(reqsMonthly.app, app)
      )
    )
    .where(eq(keys.active, true));
};

export const generateKey = async (params: any) => {
  try {
    let signer: string;
    try {
      signer = verifyMessage('generateKey', params.sig);
    } catch {
      return { error: 'Invalid signature', code: 400 };
    }
    console.log('Generate key request from', signer);
    const key = sha256(params.sig + signer);
    const whitelisted = await updateKey(key, signer);
    if (!whitelisted) return { error: 'Not whitelisted', code: 401 };
    return { key };
  } catch (err) {
    capture(err);
    return { error: 'Error while generating key', code: 500 };
  }
};

export const logReq = async (key: string, app: string) => {
  try {
    if (!apps.includes(app)) return { error: 'App is not allowed', code: 401 };

    const keyData = await getKey(key);

    if (!keyData) return { error: 'Key does not exist', code: 401 };
    if (!keyData.active) return { error: 'Key is not active', code: 401 };

    // Increase the total count for this key, but don't wait for it to finish.
    updateTotal(key, app).catch(err => {
      capture(err, { key, app });
    });
    return { success: true };
  } catch (err) {
    capture(err, { context: { key, app } });
    return { error: 'Error while increasing count', code: 500 };
  }
};

export const getKeys = async (app: string) => {
  try {
    if (!apps.includes(app)) return { error: 'App is not allowed', code: 401 };
    const activeKeys = await getActiveKeys(app);
    // Reset timestamp is the first day of the next month
    const reset = Number(
      (
        Date.UTC(new Date().getFullYear(), new Date().getMonth() + 1, 1) / 1e3
      ).toFixed(0)
    );
    const result = {
      [app]: {
        key_counts: activeKeys.reduce((obj, { key, tier, month_total }) => {
          obj[key] = { tier, month: month_total ?? 0 };
          return obj;
        }, {}),
        limits: limits[app],
        reset
      }
    };
    return result;
  } catch (err) {
    capture(err, { context: { app } });
    return { error: 'Error while getting keys', code: 500 };
  }
};

export const getKeysByOwner = async (params: GetKeysByOwnerParams) => {
  try {
    const { from, alias, timestamp, sig } = params ?? {};

    let owner: string;
    try {
      owner = getAddress(from);
    } catch {
      return { error: 'Invalid address', code: 400 };
    }

    if (!Number.isFinite(timestamp))
      return { error: 'Invalid timestamp', code: 400 };

    const ts = Math.floor(Date.now() / 1e3);
    if (timestamp > ts + SIGNATURE_WINDOW || timestamp < ts - SIGNATURE_WINDOW)
      return { error: 'Signature expired', code: 401 };

    let signer: string;
    try {
      signer = recoverGetKeysSigner({ from, alias, timestamp }, sig);
    } catch {
      return { error: 'Invalid signature', code: 400 };
    }

    if (signer !== getAddress(alias))
      return { error: 'Invalid signature', code: 400 };
    if (!(await isAliasOf(owner, signer)))
      return { error: 'Alias not authorized', code: 401 };

    const rows = await db
      .select({ key: keys.key, name: keys.name, created: keys.created })
      .from(keys)
      .where(and(eq(keys.owner, owner), eq(keys.active, true)));
    return {
      keys: rows.map(row => ({
        key: row.key,
        name: row.name,
        // Legacy MySQL epoch-second shape preserved for API consumers
        created: Math.floor(row.created.getTime() / 1e3)
      }))
    };
  } catch (err) {
    capture(err, { context: { from: params?.from, alias: params?.alias } });
    return { error: 'Error while getting keys', code: 500 };
  }
};

export const whitelistAddress = async (params: any) => {
  try {
    const { name } = params;
    let { address } = params;
    if (!name) return { error: 'Missing name', code: 400 };
    if (typeof name !== 'string' || !/^[a-zA-Z0-9 @()./_-]+$/.test(name))
      return { error: 'Invalid name', code: 400 };
    if (name.length > 32) return { error: 'Name too long', code: 400 };
    if (!address) return { error: 'Missing address', code: 400 };
    try {
      address = getAddress(address);
    } catch {
      return { error: 'Invalid address', code: 400 };
    }
    const key = sha256(randomUUID() + address);
    const created = await createNewKey(address, name, key);
    if (!created) return { error: 'Address already whitelisted', code: 409 };
    return { success: true, key };
  } catch (err) {
    capture(err, { context: { params } });
    return { error: 'Error while whitelisting address', code: 500 };
  }
};
