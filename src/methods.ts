import { randomUUID } from 'crypto';
import { getAddress } from '@ethersproject/address';
import { verifyMessage } from '@ethersproject/wallet';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { limits } from './config.json';
import { db } from './db';
import { isAliasOf } from './helpers/aliases';
import { recoverSigner, SignedType } from './helpers/eip712';
import {
  currentDate,
  currentMonth,
  keys,
  reqsDaily,
  reqsMonthly
} from './schema';
import { nextMonthStart, sha256 } from './utils';
import {
  createNewKey,
  insertKey,
  updateKey,
  updateOwnerKey,
  updateTotal
} from './writer';

const apps = Object.keys(limits);
const SIGNATURE_WINDOW = 300; // 5 minutes before or after the server time

const USAGE_DAYS = 30;
const USAGE_MONTHS = 12;
const MAX_KEYS_PER_OWNER = 10;

type GetKeysByOwnerParams = {
  from: string;
  alias: string;
  timestamp: number;
  sig: string;
};

type CreateKeyParams = GetKeysByOwnerParams & { name: string };
type DeleteKeyParams = GetKeysByOwnerParams & { key: string };
type RenameKeyParams = DeleteKeyParams & { name: string };

const validateName = (name: unknown) => {
  if (!name) return 'Missing name';
  if (typeof name !== 'string' || !/^[a-zA-Z0-9 @()./_-]+$/.test(name))
    return 'Invalid name';
  if (name.length > 32) return 'Name too long';
};

const verifyOwner = async (
  params: GetKeysByOwnerParams,
  type: SignedType = 'GetKeys'
): Promise<{ owner: string } | { error: string; code: number }> => {
  const { sig, ...message } = params ?? {};
  const { from, alias, timestamp } = message;

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
    signer = recoverSigner(type, message, sig);
  } catch {
    return { error: 'Invalid signature', code: 400 };
  }

  if (signer !== getAddress(alias))
    return { error: 'Invalid signature', code: 400 };
  if (!(await isAliasOf(owner, signer)))
    return { error: 'Alias not authorized', code: 401 };

  return { owner };
};

const getOwnerKeys = (owner: string) =>
  db
    .select({ key: keys.key, name: keys.name })
    .from(keys)
    .where(and(eq(keys.owner, owner), eq(keys.active, true)));

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
    const reset = nextMonthStart();
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
    const auth = await verifyOwner(params);
    if ('error' in auth) return auth;

    const rows = await db
      .select({ key: keys.key, name: keys.name, created: keys.created })
      .from(keys)
      .where(and(eq(keys.owner, auth.owner), eq(keys.active, true)));
    if (rows.length === 0)
      return { keys: [], usage: { daily: [], monthly: [] } };

    const ownerKeys = rows.map(row => row.key);
    const daily = await db
      .select({
        key: reqsDaily.key,
        app: reqsDaily.app,
        day: reqsDaily.day,
        total: reqsDaily.total
      })
      .from(reqsDaily)
      .where(
        and(
          inArray(reqsDaily.key, ownerKeys),
          sql`to_date(${reqsDaily.day}, 'DD-MM-YYYY')
            >= ${currentDate} - make_interval(days => ${USAGE_DAYS - 1})`
        )
      );
    const monthly = await db
      .select({
        key: reqsMonthly.key,
        app: reqsMonthly.app,
        month: reqsMonthly.month,
        total: reqsMonthly.total
      })
      .from(reqsMonthly)
      .where(
        and(
          inArray(reqsMonthly.key, ownerKeys),
          sql`to_date(${reqsMonthly.month}, 'MM-YYYY') >= date_trunc('month',
            ${currentDate}) - make_interval(months => ${USAGE_MONTHS - 1})`
        )
      );

    return {
      keys: rows.map(row => ({
        key: row.key,
        name: row.name,
        // Legacy MySQL epoch-second shape preserved for API consumers
        created: Math.floor(row.created.getTime() / 1e3)
      })),
      usage: { daily, monthly }
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
    const nameError = validateName(name);
    if (nameError) return { error: nameError, code: 400 };
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

export const createKey = async (params: CreateKeyParams) => {
  try {
    const nameError = validateName(params?.name);
    if (nameError) return { error: nameError, code: 400 };

    const auth = await verifyOwner(params, 'CreateKey');
    if ('error' in auth) return auth;

    const ownerKeys = await getOwnerKeys(auth.owner);
    // Also rejects a replayed signature, as it carries the same name
    if (ownerKeys.some(row => row.name === params.name))
      return { error: 'Name already used', code: 409 };
    if (ownerKeys.length >= MAX_KEYS_PER_OWNER)
      return { error: 'Too many keys', code: 403 };

    const key = sha256(randomUUID() + auth.owner);
    const created = await insertKey(auth.owner, params.name, key);
    return { key, name: params.name, created: Math.floor(created / 1e3) };
  } catch (err) {
    capture(err, { context: { from: params?.from, alias: params?.alias } });
    return { error: 'Error while creating key', code: 500 };
  }
};

export const renameKey = async (params: RenameKeyParams) => {
  try {
    const nameError = validateName(params?.name);
    if (nameError) return { error: nameError, code: 400 };

    const auth = await verifyOwner(params, 'RenameKey');
    if ('error' in auth) return auth;

    const ownerKeys = await getOwnerKeys(auth.owner);
    if (
      ownerKeys.some(row => row.name === params.name && row.key !== params.key)
    )
      return { error: 'Name already used', code: 409 };

    if (!(await updateOwnerKey(auth.owner, params.key, { name: params.name })))
      return { error: 'Key not found', code: 404 };
    return { success: true };
  } catch (err) {
    capture(err, { context: { from: params?.from, alias: params?.alias } });
    return { error: 'Error while renaming key', code: 500 };
  }
};

export const deleteKey = async (params: DeleteKeyParams) => {
  try {
    const auth = await verifyOwner(params, 'DeleteKey');
    if ('error' in auth) return auth;

    if (!(await updateOwnerKey(auth.owner, params.key, { active: false })))
      return { error: 'Key not found', code: 404 };
    return { success: true };
  } catch (err) {
    capture(err, { context: { from: params?.from, alias: params?.alias } });
    return { error: 'Error while deleting key', code: 500 };
  }
};
