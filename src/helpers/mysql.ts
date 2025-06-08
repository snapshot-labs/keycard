import bluebird from 'bluebird';
import { ConnectionString } from 'connection-string';
import mysql from 'mysql';
import Connection from 'mysql/lib/Connection';
import Pool from 'mysql/lib/Pool';

const connectionLimit = parseInt(process.env.CONNECTION_LIMIT || '25');
const config = new ConnectionString(process.env.DATABASE_URL);
bluebird.promisifyAll([Pool, Connection]);

const db: any = mysql.createPool({
  ...config,
  host: config.hosts?.[0].name,
  port: config.hosts?.[0].port,
  connectionLimit,
  multipleStatements: true,
  connectTimeout: 60e3,
  acquireTimeout: 60e3,
  timeout: 60e3,
  charset: 'utf8mb4',
  database: config.path?.[0]
});

process.on('SIGINT', () => {
  db.end(() => {
    console.log('Database connection pool closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  db.end(() => {
    console.log('Database connection pool closed.');
    process.exit(0);
  });
});

export default db;
