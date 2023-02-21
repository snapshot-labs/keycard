import express from 'express';
import { name as packageName, version as packageVersion } from '../package.json';
import { rpcError, rpcSuccess } from './helpers/utils';
import { appAuthChecker } from './helpers/auth';
import { getKeys, increaseTotal } from './methods';

const router = express.Router();

router.get('/', async (req, res) => {
  const commit = process.env.COMMIT_HASH || '';
  const version = commit ? `${packageVersion}#${commit.substring(0, 7)}` : packageVersion;
  return res.json({
    name: packageName,
    version
  });
});

router.post('/', appAuthChecker, async (req, res) => {
  const { id = null, method, params = {} } = req.body;
  console.log('[Received] method:', method, 'app:', params.app);
  if (!method) return rpcError(res, 500, 'missing method', id);
  try {
    let result: any = {};
    if (method === 'increase_total') result = await increaseTotal(params.key, params.app);
    if (method === 'get_keys') result = await getKeys(params.app);

    return rpcSuccess(res, result, id);
  } catch (e) {
    console.log(e);
    return rpcError(res, 500, e, id);
  }
});

export default router;
