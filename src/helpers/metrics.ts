import init, { client } from '@snapshot-labs/snapshot-metrics';
import db from './mysql';
import type { Express } from 'express';

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath: [/^\/$/] });
}

new client.Gauge({
  name: 'subscribers_per_status_count',
  help: 'Number of subscribers per status',
  labelNames: ['status'],
  async collect() {
    [
      ['active', '`key` IS NOT NULL'],
      ['pending', '`key` IS NULL']
    ].forEach(async function callback(this: any, data: any) {
      this.set(
        { status: data[0] },
        (await db.queryAsync(`SELECT count(*) as count FROM \`keys\` WHERE ${data[1]}`))[0]
          .count as any
      );
    }, this);
  }
});

new client.Gauge({
  name: 'total_api_requests_count',
  help: 'Total number of API requests',
  async collect() {
    this.set((await db.queryAsync(`SELECT SUM(total) as count FROM reqs`))[0].count as any);
  }
});
