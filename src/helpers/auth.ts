import { rpcError } from './utils';

const APPS_SECRET = process.env.APPS_SECRET || '';

export const appAuthChecker = async (req, res, next) => {
  const { id = null } = req.body;
  const { secret = '' } = req.headers;

  if (secret !== APPS_SECRET) {
    return rpcError(res, 401, 'Wrong secret', id);
  }

  next();
};
