import { verifyMessage } from '@ethersproject/wallet';
import db from './helpers/mysql';
import { updateKey, updateTotal } from './writer';
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
      SELECT k.key, m.total as month_total
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
    const signer = verifyMessage('generateKey', params.sig);
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
    if (keyData?.month_total >= limits[app].monthly)
      return { error: 'Key is restricted for this month', code: 429 };

    const success: boolean = await updateTotal(keyData.key, app);
    return { success };
  } catch (e) {
    capture(e, { context: { key, app } });
    return { error: 'Error while increasing count', code: 500 };
  }
};

export const getKeys = async (app: string) => {
  try {
    if (!apps.includes(app)) return { error: 'App is not allowed', code: 401 };
    const activeKeys = await getActiveKeys(app);
    const result = {
      [app]: {
        active: activeKeys.map((key: any) => key.key),
        restricted_monthly: activeKeys
          .filter((key: any) => key.month_total >= limits[app].monthly)
          .map((key: any) => key.key)
      }
    };
    return result;
  } catch (e) {
    capture(e, { context: { app } });
    return { error: 'Error while getting keys', code: 500 };
  }
};
