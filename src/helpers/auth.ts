import { rpcError } from './utils';

const APPS_SECRET = process.env.SECRET || '';

export const appAuthChecker = async (req, res, next) => {
  const { id = null } = req.body;
  const { secret = '' } = req.headers;

  if (secret !== APPS_SECRET) {
    return rpcError(res, 401, 'Wrong secret', id);
  }

  next();
};
