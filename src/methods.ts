import { getAddress } from '@ethersproject/address';
import { verifyMessage } from '@ethersproject/wallet';
import db from './helpers/mysql';
import { createNewKey, updateKey, updateTotal } from './writer';
import { limits } from './config.json';
import { sha256 } from './utils';
import { capture } from '@snapshot-labs/snapshot-sentry';

const apps = Object.keys(limits);

type Key = {
  key: string;
  owner: string;
  name: string;
  created: string;
  updated: string;
  active: number;
  month_total: number;
};

const getKey = async (key: string, app: string): Promise<Key | null> => {
  const [keyData] = await db.queryAsync(
    `
      SELECT k.key, k.active, m.total as month_total FROM \`keys\` k
        LEFT JOIN reqs_monthly m ON m.key = k.key
        AND m.month = DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y')
        AND m.app = ?
      WHERE k.key = ?`,
    [app, key]
  );
  return keyData;
};

const getActiveKeys = async (app: string) => {
  const keys = await db.queryAsync(
    `
      SELECT k.key, k.level, m.total as month_total
      FROM \`keys\` k
        LEFT JOIN reqs_monthly m ON m.key = k.key
        AND m.month = DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y')
        AND m.app = ?
      WHERE active = 1 AND k.key IS NOT NULL
    `,
    [app]
  );
  return keys;
};

const isWhitelist = async (address: string) => {
  const [whitelisted] = await db.queryAsync('SELECT * FROM `keys` WHERE owner = ?', [address]);
  return !!whitelisted;
};

export const generateKey = async (params: any) => {
  try {
    let signer: string;
    try {
      signer = verifyMessage('generateKey', params.sig);
    } catch (e: any) {
      return { error: 'Invalid signature', code: 400 };
    }
    console.log('Generate key request from', signer, 'with sig', params.sig);
    const whitelisted = await isWhitelist(signer);
    if (!whitelisted) return { error: 'Not whitelisted', code: 401 };
    const key = sha256(params.sig + signer);
    await updateKey(key, signer);
    return { key };
  } catch (e) {
    capture(e, { context: { params } });
    return { error: 'Error while generating key', code: 500 };
  }
};

export const logReq = async (key: string, app: string) => {
  try {
    if (!apps.includes(app)) return { error: 'App is not allowed', code: 401 };

    const keyData: Key | null = await getKey(key, app);

    if (!keyData?.key) return { error: 'Key does not exist', code: 401 };
    if (!keyData?.active) return { error: 'Key is not active', code: 401 };

    // Increase the total count for this key, but don't wait for it to finish.
    updateTotal(keyData.key, app).catch(e => {
      capture(e, { key, app });
    });
    return { success: true };
  } catch (e) {
    capture(e, { context: { key, app } });
    return { error: 'Error while increasing count', code: 500 };
  }
};

export const getKeys = async (app: string) => {
  try {
    if (!apps.includes(app)) return { error: 'App is not allowed', code: 401 };
    const activeKeys = await getActiveKeys(app);
    // Reset timestamp is the first day of the next month
    const resetTimestamp = (
      Date.UTC(new Date().getFullYear(), new Date().getMonth() + 1, 1) / 1e3
    ).toFixed(0);
    const result = {
      [app]: {
        // monthly_counts will be deprecated in the future
        monthly_counts: activeKeys.reduce((obj, { key, month_total }) => {
          obj[key] = month_total ?? 0;
          return obj;
        }, {}),
        active_keys_counts: activeKeys.reduce((obj, { key, level, month_total }) => {
          obj[key] = { level, month: month_total ?? 0 };
          return obj;
        }, {}),
        limits: limits[app],
        reset: resetTimestamp
      }
    };
    return result;
  } catch (e) {
    capture(e, { context: { app } });
    return { error: 'Error while getting keys', code: 500 };
  }
};

export const whitelistAddress = async (params: any) => {
  try {
    const { name } = params;
    let { address } = params;
    if (!name) return { error: 'Missing name', code: 400 };
    if (!address) return { error: 'Missing address', code: 400 };
    try {
      address = getAddress(address);
    } catch (e) {
      return { error: 'Invalid address', code: 400 };
    }
    const success = await createNewKey(address, name);
    return { success };
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return { error: 'Address already whitelisted', code: 409 };
    if (e.code === 'ER_DATA_TOO_LONG') return { error: 'Name too long', code: 400 };
    capture(e, { context: { params } });
    return { error: 'Error while whitelisting address', code: 500 };
  }
};
