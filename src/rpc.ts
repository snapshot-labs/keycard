import express from 'express';
import { name as packageName, version as packageVersion } from '../package.json';
import { rpcError, rpcSuccess } from './helpers/utils';
import { authChecker } from './helpers/auth';
import { getKeys, logReq, generateKey } from './methods';
import { capture } from './helpers/sentry';

const router = express.Router();

router.get('/', async (req, res) => {
  const commit = process.env.COMMIT_HASH || '';
  const version = commit ? `${packageVersion}#${commit.substring(0, 7)}` : packageVersion;
  return res.json({
    name: packageName,
    version
  });
});

router.post('/', authChecker, async (req, res) => {
  const { id = null, method, params = {} } = req.body;
  if (!method) return rpcError(res, 500, 'missing method', id);
  try {
    let result: any = {};
    if (method === 'log_req') result = await logReq(params.key, params.app);
    if (method === 'get_keys') result = await getKeys(params.app);
    if (method === 'generate_key') result = await generateKey(params);

    if (result.error) return rpcError(res, result.code || 500, result.error, id);
    return rpcSuccess(res, result, id);
  } catch (e) {
    capture(e, { context: { method } });
    return rpcError(res, 500, e, id);
  }
});

export default router;
