import db from './helpers/mysql';

export const updateTotal = async (key: string, app: string) => {
  const sql = `
    INSERT INTO reqs (\`key\`, app, total) VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE total = total + 1;

    INSERT INTO reqs_daily (\`key\`, day, app, total) VALUES (?, DATE_FORMAT(CURRENT_TIMESTAMP, '%d-%m-%Y'), ?, 1)
    ON DUPLICATE KEY UPDATE total = total + 1;

    INSERT INTO reqs_monthly (\`key\`, month, app, total) VALUES (?, DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y'), ?, 1)
    ON DUPLICATE KEY UPDATE total = total + 1;
  `;

  await db.queryAsync(sql, [key, app, key, app, key, app]);
  return true;
};
