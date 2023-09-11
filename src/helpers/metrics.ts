import type { Express } from 'express';
import init, { client } from '@snapshot-labs/snapshot-metrics';
import { capture } from '@snapshot-labs/snapshot-sentry';
import db from './mysql';

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath: [/^\/$/], errorHandler: (e: any) => capture(e) });
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
