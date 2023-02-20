import mysql from 'mysql';
import Pool from 'mysql/lib/Pool';
import Connection from 'mysql/lib/Connection';
import bluebird from 'bluebird';
import { ConnectionString } from 'connection-string';

const connectionLimit = parseInt(process.env.CONNECTION_LIMIT || '25');
const config = new ConnectionString(process.env.DATABASE_URL);
bluebird.promisifyAll([Pool, Connection]);

const db: any = mysql.createPool({
  ...config,
  connectionLimit,
  multipleStatements: true,
  connectTimeout: 60e3,
  acquireTimeout: 60e3,
  timeout: 60e3,
  charset: 'utf8mb4',
  database: config.path?.[0]
});

export default db;
