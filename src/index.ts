import 'dotenv/config';
import './instrument';
import {
  capture,
  fallbackLogger,
  Sentry
} from '@snapshot-labs/snapshot-sentry';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { closeDatabase, runMigrations } from './db';
import initMetrics from './helpers/metrics';
import { rpcError } from './helpers/utils';
import rpc from './rpc';

const app = express();
const PORT = process.env.PORT || 3007;

const { stop: stopMetrics } = initMetrics(app);

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ limit: '4mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.use(compression());
app.use('/', rpc);

app.use((_, res) => {
  rpcError(res, 404, {}, '');
});

fallbackLogger(app);

async function start() {
  await runMigrations();
  const server = app.listen(PORT, () =>
    console.log(`Listening at http://localhost:${PORT}`)
  );
  // Bind failures arrive on the error event after listen() returns, so
  // start().catch alone would miss them.
  server.on('error', fail);

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

function fail(err: unknown) {
  console.error('Failed to start', err);
  capture(err);
  // Exit once Sentry has delivered the event, with a 2s upper bound.
  Sentry.flush(2000).then(() => process.exit(1));
}

start().catch(fail);
