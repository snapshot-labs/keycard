import init, { client } from '@snapshot-labs/snapshot-metrics';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { avg, eq, max, min, sum } from 'drizzle-orm';
import { Express } from 'express';
import config from '../config.json';
import { db } from '../db';
import { currentMonth, keys, reqs, reqsMonthly } from '../schema';

export default function initMetrics(app: Express) {
  return init(app, {
    whitelistedPath: [/^\/$/],
    errorHandler: (e: any) => capture(e),
    db: db.$client
  });
}

new client.Gauge({
  name: 'snapshot_subscriber_counts',
  help: 'Number of Snapshot subscribers',
  labelNames: ['status'],
  async collect() {
    try {
      this.set({ status: 'active' }, await db.$count(keys));
    } catch (err) {
      capture(err);
    }
  }
});

new client.Gauge({
  name: 'total_api_requests_count',
  help: 'Total number of API requests',
  async collect() {
    try {
      const [row] = await db
        .select({ count: sum(reqs.total).mapWith(Number) })
        .from(reqs);
      this.set(row.count ?? 0);
    } catch (err) {
      capture(err);
    }
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
    try {
      const results = await db
        .select({
          total: sum(reqsMonthly.total).mapWith(Number),
          max: max(reqsMonthly.total),
          min: min(reqsMonthly.total),
          average: avg(reqsMonthly.total).mapWith(Number),
          app: reqsMonthly.app,
          month: reqsMonthly.month
        })
        .from(reqsMonthly)
        .where(eq(reqsMonthly.month, currentMonth))
        .groupBy(reqsMonthly.app, reqsMonthly.month);

      const [periodMonth, periodYear] = (results[0]?.month ?? '').split('-');
      results.forEach(result => {
        ['total', 'min', 'max', 'average'].forEach(type => {
          this.set(
            {
              month: periodMonth,
              year: periodYear,
              app: result.app,
              type
            },
            result[type] as any
          );
        });
      });
    } catch (err) {
      capture(err);
    }
  }
});
