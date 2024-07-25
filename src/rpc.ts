import { capture } from '@snapshot-labs/snapshot-sentry';
import express from 'express';
import { authChecker } from './helpers/auth';
import { rpcError, rpcSuccess } from './helpers/utils';
import { generateKey, getKeys, logReq, whitelistAddress } from './methods';
import { name as packageName, version as packageVersion } from '../package.json';

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
  if (!method) return rpcError(res, 400, 'missing method', id);
  try {
    let result: any = {};
    if (method === 'log_req') result = await logReq(params.key, params.app);
    else if (method === 'get_keys') result = await getKeys(params.app);
    else if (method === 'generate_key') result = await generateKey(params);
    else if (method === 'whitelist') result = await whitelistAddress(params);
    else return rpcError(res, 400, 'invalid method', id);

    if (result.error) return rpcError(res, result.code || 500, result.error, id);
    return rpcSuccess(res, result, id);
  } catch (e) {
    capture(e, { context: { method } });
    return rpcError(res, 500, e, id);
  }
});

export default router;
