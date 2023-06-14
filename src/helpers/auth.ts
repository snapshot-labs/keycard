import { rpcError } from './utils';

const APPS_SECRET = process.env.SECRET || '';

export const authChecker = async (req, res, next) => {
  const { id = null, method } = req.body;
  const { secret = '' } = req.headers;

  if (method !== 'generate_key' && secret !== APPS_SECRET) {
    console.log('[Received] method:', method, id);
    return rpcError(res, 401, 'Wrong secret', id);
  }
  next();
};
