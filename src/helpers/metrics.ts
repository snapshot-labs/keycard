import type { Express } from 'express';
import init, { client } from '@snapshot-labs/snapshot-metrics';
import { capture } from '@snapshot-labs/snapshot-sentry';
import http from 'node:http';
import https from 'node:https';
import db from './mysql';

let server;
const agentOptions = { keepAlive: true, keepAliveMsecs: 10e3, maxSockets: 5 };
const httpAgent = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath: [/^\/$/] });

  app.use((req, res, next) => {
    if (!server) {
      // @ts-ignore
      server = req.socket.server;
    }
    next();
  });
}

async function collectSubscriberCounts() {
  const subscriberCounts = await Promise.all([
    db.queryAsync('SELECT count(*) as count FROM `keys` WHERE `key` IS NOT NULL'),
    db.queryAsync('SELECT count(*) as count FROM `keys` WHERE `key` IS NULL')
  ]);

  return [
    { status: 'active', count: subscriberCounts[0][0].count },
    { status: 'pending', count: subscriberCounts[1][0].count }
  ];
}

new client.Gauge({
  name: 'snapshot_subscriber_counts',
  help: 'Number of Snapshot subscribers by status',
  labelNames: ['status'],
  async collect() {
    const subscriberCounts = await collectSubscriberCounts();

    subscriberCounts.forEach(({ status, count }) => {
      this.set({ status }, count);
    });
  }
});

new client.Gauge({
  name: 'total_api_requests_count',
  help: 'Total number of API requests',
  async collect() {
    this.set((await db.queryAsync(`SELECT SUM(total) as count FROM reqs`))[0].count as any);
  }
});

// Metrics PushGateway test
// @todo To be moved to snapshot-metrics package after live testing
const INSTANCE = process.env.METRICS_INSTANCE;
const JOB_NAME = process.env.METRICS_JOB_NAME ?? 'prometheus';
const PUSHGATEWAY_URL = process.env.METRICS_PUSHGATEWAY_URL;

if (PUSHGATEWAY_URL && INSTANCE && JOB_NAME) {
  console.log(`Sending metrics to Pushgateway ${PUSHGATEWAY_URL}`);
  const gateway = new client.Pushgateway(PUSHGATEWAY_URL, {
    timeout: 5e3,
    agent: new URL(PUSHGATEWAY_URL).protocol === 'http:' ? httpAgent : httpsAgent
  });
  const metricsGroup = {
    jobName: JOB_NAME as string,
    groupings: {
      instance: `${INSTANCE}:${process.env.HOSTNAME || '80'}`
    }
  };

  function defaultErrorHandler(e: any) {
    console.error('Error while pushing to Pushgateway', e);
  }

  function pushMetrics(errorHandler = defaultErrorHandler) {
    gateway.pushAdd(metricsGroup).catch(errorHandler);
  }

  setInterval(pushMetrics, 15e3, e => capture(e));
}

new client.Gauge({
  name: 'express_open_connections_size',
  help: 'Number of open connections on the express server',
  async collect() {
    if (server) {
      this.set(server._connections);
    }
  }
});
