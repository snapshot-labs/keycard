import db from './helpers/mysql';

// Tier assigned to newly whitelisted keys. Maps to the "Trail" tier (id 3,
// 200k requests/month) defined in src/config.json. Users on this tier reach
// out to the team to be upgraded to a higher tier.
export const DEFAULT_TIER = 3;

export const updateTotal = async (key: string, app: string) => {
  const sql = `
    INSERT INTO reqs (\`key\`, app, total, last_active) VALUES (?, ?, 1, UNIX_TIMESTAMP())
    ON DUPLICATE KEY UPDATE total = total + 1, last_active = UNIX_TIMESTAMP();

    INSERT INTO reqs_daily (\`key\`, day, app, total) VALUES (?, DATE_FORMAT(CURRENT_TIMESTAMP, '%d-%m-%Y'), ?, 1)
    ON DUPLICATE KEY UPDATE total = total + 1;

    INSERT INTO reqs_monthly (\`key\`, month, app, total) VALUES (?, DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y'), ?, 1)
    ON DUPLICATE KEY UPDATE total = total + 1;
  `;

  await db.queryAsync(sql, [key, app, key, app, key, app]);
  return true;
};

export const updateKey = async (key: string, owner: string) => {
  const sql = 'UPDATE `keys` k SET k.key = ? WHERE owner = ?';
  await db.queryAsync(sql, [key, owner]);
  return true;
};

export const createNewKey = async (owner: string, name: string) => {
  const sql = 'INSERT INTO `keys` (owner, name, tier) VALUES (?, ?, ?)';
  await db.queryAsync(sql, [owner, name, DEFAULT_TIER]);
  return true;
};
