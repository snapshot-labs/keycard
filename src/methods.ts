import { verifyMessage } from '@ethersproject/wallet';
import db from './helpers/mysql';
import { updateKey, updateTotal } from './writer';
import { limits } from './config.json';
import { sha256 } from './utils';

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
    console.log('Receive key request from', signer, 'with sig', params.sig);
    const whitelisted = await isWhitelist(signer);
    if (!whitelisted) return Promise.reject('Not whitelisted');
    const key = sha256(params.sig + signer);
    await updateKey(key, signer);
    return { key };
  } catch (e) {
    console.log(e);
    return Promise.reject('Error while generating key');
  }
};

export const logReq = async (key: string, app: string) => {
  try {
    if (!apps.includes(app)) return Promise.reject('App is not allowed');

    const keyData: Key | null = await getKey(key, app);

    if (!keyData?.key) return Promise.reject('Key does not exist');
    if (!keyData?.active) return Promise.reject('Key is not active');
    if (keyData?.month_total >= limits[app].monthly)
      return Promise.reject('Key is restricted for this month');

    const success: boolean = await updateTotal(keyData.key, app);
    return { success };
  } catch (e) {
    console.log(e);
    return Promise.reject('Error while increasing count');
  }
};

export const getKeys = async (app: string) => {
  try {
    if (!apps.includes(app)) return Promise.reject('App is not allowed');
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
    console.log(e);
    return Promise.reject('Error while getting keys');
  }
};
