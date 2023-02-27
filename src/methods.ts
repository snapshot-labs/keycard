import db from './helpers/mysql';
import { updateTotal } from './writer';
import { limits } from './config.json';

const apps = Object.keys(limits);

type Key = {
  key: string;
  owner: string;
  name: string;
  created: string;
  updated: string;
  active: number;
};

const getKey = async (key: string): Promise<Key | null> => {
  try {
    const [keyData] = await db.queryAsync('SELECT * FROM `keys` WHERE `key` = ?', [key]);
    return keyData;
  } catch (e) {
    console.log(e);
    return Promise.reject('Error while getting key');
  }
};

const getActiveKeys = async (app: string) => {
  const keys = await db.queryAsync(
    `
      SELECT k.key, m.total as month_total
      FROM \`keys\` k
      LEFT JOIN reqs_monthly m ON m.key = k.key AND m.month = DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y')
      WHERE app = ? AND active = 1
    `,
    [app]
  );
  return keys;
};

export const logReq = async (key: string, app: string) => {
  try {
    const keyData: Key | null = await getKey(key);

    if (!keyData?.key) return Promise.reject('Key does not exist');
    if (keyData?.active === 0) return Promise.reject('Key is not active');
    if (apps.includes(app) === false) return Promise.reject('App is not allowed');
    const success: boolean = await updateTotal(keyData.key, app);

    return { success };
  } catch (e) {
    console.log(e);
    return Promise.reject('Error while increasing count');
  }
};

export const getKeys = async (app: string) => {
  try {
    if (apps.includes(app) === false) return Promise.reject('App is not allowed');
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
