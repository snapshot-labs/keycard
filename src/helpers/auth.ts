import { rpcError } from './utils';

const APPS_SECRET = process.env.SECRET || '';

const PUBLIC_METHODS = ['generate_key', 'get_keys_by_owner'];

export const authChecker = async (req, res, next) => {
  const { id = null, method } = req.body;
  const { secret = '' } = req.headers;

  if (!PUBLIC_METHODS.includes(method) && secret !== APPS_SECRET) {
    console.log('[Received] method:', method, id);
    return rpcError(res, 401, 'Wrong secret', id);
  }
  next();
};
