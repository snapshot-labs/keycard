import 'dotenv/config';
import {
  capture,
  fallbackLogger,
  initLogger
} from '@snapshot-labs/snapshot-sentry';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import initMetrics from './helpers/metrics';
import { closeDatabase } from './helpers/mysql';
import { rpcError } from './helpers/utils';
import rpc from './rpc';

const app = express();
const PORT = process.env.PORT || 3007;

initLogger();
const { stop: stopMetrics } = initMetrics(app);

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

async function start() {
  const server = app.listen(PORT, () =>
    console.log(`Listening at http://localhost:${PORT}`)
  );

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      console.log('Express server closed.');

      try {
        stopMetrics();
        await closeDatabase();
        console.log('Graceful shutdown completed.');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

start().catch(err => {
  console.error('Failed to start', err);
  capture(err);
  // Grace period so Sentry's async transport can deliver the event before exit.
  setTimeout(() => process.exit(1), 2000);
});
