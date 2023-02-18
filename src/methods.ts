import db from './helpers/mysql';
import { updateRequestTotal } from './writer';
import { limits } from './config.json';

type Key = {
  id: number;
  key: string;
  owner: string;
  name: string;
  app: string;
  created: string;
  updated: string;
  active: number;
};

const getKey = async (key: string): Promise<Key | null> => {
  try {
    const [keyData] = await db.queryAsync(`SELECT * FROM \`keys\` WHERE \`key\` = ?`, [key]);
    return keyData;
  } catch (e) {
    console.log(e);
    return Promise.reject('Error while getting key');
  }
};

const getActiveKeysWithSpace = async (app: string) => {
  const keys = await db.queryAsync(
    `SELECT k.key, d.total as day_total, m.total as month_total  FROM \`keys\` k
      LEFT JOIN reqs_daily d ON d.key = id
      LEFT JOIN reqs_monthly m ON m.key = id
      WHERE app = ? AND active = 1
      AND (d.day = DATE_FORMAT(CURRENT_TIMESTAMP, '%d-%m-%Y') OR d.day IS NULL)
      AND (m.month = DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y') OR m.month IS NULL)`,
    [app]
  );
  return keys;
};

export const increaseCount = async (key: string, app: string) => {
  try {
    const keyData: Key | null = await getKey(key);

    if (!keyData) return Promise.reject('Key does not exist');
    if (keyData?.active === 0) return Promise.reject('Key is not active');
    if (keyData?.app !== app) return Promise.reject('Key does not belong to this app');

    const success: boolean = await updateRequestTotal(keyData.id);

    return { success };
  } catch (e) {
    console.log(e);
    return Promise.reject('Error while increasing count');
  }
};

export const getKeys = async (app: string) => {
  try {
    const activeKeys = await getActiveKeysWithSpace(app);
    const result = {
      [app]: {
        active: activeKeys.map((key: any) => key.key),
        restricted_daily: activeKeys
          .filter((key: any) => key.day_total >= limits[app].daily)
          .map((key: any) => key.key),
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
