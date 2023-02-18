import db from './helpers/mysql';

export const updateRequestTotal = async (key: number) => {
  const sql = `
        INSERT INTO reqs (\`key\`, total) VALUES (?, 1)
        ON DUPLICATE KEY UPDATE total = total + 1;
        INSERT INTO reqs_daily (\`key\`, day, total) VALUES (?, DATE_FORMAT(CURRENT_TIMESTAMP, '%d-%m-%Y'), 1)
        ON DUPLICATE KEY UPDATE total = total + 1;
        INSERT INTO reqs_monthly (\`key\`, month, total) VALUES (?, DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y'), 1)
        ON DUPLICATE KEY UPDATE total = total + 1;
    `;

  const result = await db.queryAsync(sql, [key, key, key]);
  return result.affectedRows > 0;
};
