import db from '../src/helpers/mysql';

export const HOST = `http://localhost:${process.env.PORT || 3077}`;

export async function cleanupDb(key = '') {
  await db.queryAsync('DELETE FROM `keys` where `key` = ? OR `key` IS NULL', key);
  await db.queryAsync('DELETE FROM `reqs` where `key` = ? OR `key` IS NULL', key);
  await db.queryAsync('DELETE FROM `reqs_daily` where `key` = ? OR `key` IS NULL', key);
  await db.queryAsync('DELETE FROM `reqs_monthly` where `key` = ? OR `key` IS NULL', key);
}
