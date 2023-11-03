import type { Express } from 'express';
import init, { client } from '@snapshot-labs/snapshot-metrics';
import { capture } from '@snapshot-labs/snapshot-sentry';
import db from './mysql';
import config from '../config.json';

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath: [/^\/$/], errorHandler: (e: any) => capture(e), db });
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

const totalMonthlyApiRequestsLimit = new client.Gauge({
  name: 'total_monthly_api_requests_limit',
  help: 'Monthly API requests limit per app',
  labelNames: ['app', 'tier']
});
Object.entries(config.limits).forEach(([app, tierLimit]) => {
  Object.entries(tierLimit).forEach(([tier, limit]) => {
    totalMonthlyApiRequestsLimit.set({ app, tier }, limit.monthly);
  });
});

new client.Gauge({
  name: 'monthly_api_requests_aggregation_total',
  help: 'Total number of API requests for each month',
  labelNames: ['month', 'year', 'app', 'type'],
  async collect() {
    const results = await db.queryAsync(
      `SELECT
          SUM(total) as total,
          MAX(total) as max,
          MIN(total) as min,
          AVG(total) as average,
          DATE_FORMAT(CURRENT_TIMESTAMP, '%m') as periodMonth,
          DATE_FORMAT(CURRENT_TIMESTAMP, '%Y') as periodYear,
          app
          FROM reqs_monthly
          WHERE month = DATE_FORMAT(CURRENT_TIMESTAMP, '%m-%Y')
          GROUP BY app`
    );

    results.forEach(result => {
      ['total', 'min', 'max', 'average'].forEach(type => {
        this.set(
          { month: result.periodMonth, year: result.periodYear, app: result.app, type },
          result[type] as any
        );
      });
    });
  }
});
