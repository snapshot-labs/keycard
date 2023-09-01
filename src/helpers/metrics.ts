import type { Express } from 'express';
import init, { client } from '@snapshot-labs/snapshot-metrics';
import { capture } from '@snapshot-labs/snapshot-sentry';
import http from 'http';
import db from './mysql';

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath: [/^\/$/] });
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

async function sleep(time: number) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

if (PUSHGATEWAY_URL && INSTANCE && JOB_NAME) {
  const gateway = new client.Pushgateway(PUSHGATEWAY_URL, {
    timeout: 5e3,
    agent: new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 10e3,
      maxSockets: 5
    })
  });

  function defaultErrorHandler(e: any) {
    console.error('Error while pushing to Pushgateway', e);
  }

  async function pushMetrics(errorHandler = defaultErrorHandler) {
    try {
      gateway
        .pushAdd({
          jobName: JOB_NAME as string,
          groupings: {
            instance: `${INSTANCE}:${process.env.HOSTNAME || '80'}`
          }
        })
        .catch(errorHandler);
    } finally {
      await sleep(5e3);
      await pushMetrics(errorHandler);
    }
  }

  pushMetrics(e => capture(e));
}
