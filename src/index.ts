import 'dotenv/config';
import { fallbackLogger, initLogger } from '@snapshot-labs/snapshot-sentry';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import initMetrics from './helpers/metrics';
import { rpcError } from './helpers/utils';
import rpc from './rpc';

const app = express();
const PORT = process.env.PORT || 3007;

initLogger(app);
initMetrics(app);

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ limit: '4mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.use(compression());
app.use('/', rpc);

fallbackLogger(app);

app.use((_, res) => {
  rpcError(res, 404, {}, '');
});

app.listen(PORT, () => console.log(`Listening at http://localhost:${PORT}`));
