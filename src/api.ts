import express from 'express';
import { name as packageName, version as packageVersion } from '../package.json';

const router = express.Router();

router.get('/api', async (req, res) => {
  const commit = process.env.COMMIT_HASH || '';
  const version = commit ? `${packageVersion}#${commit.substring(0, 7)}` : packageVersion;
  return res.json({
    name: packageName,
    version
  });
});

export default router;
