import mysql from 'mysql';
import Pool from 'mysql/lib/Pool';
import Connection from 'mysql/lib/Connection';
import bluebird from 'bluebird';
import { ConnectionString } from 'connection-string';

const connectionLimit = parseInt(process.env.CONNECTION_LIMIT || '25');
const mysqlUrl = `${process.env.DATABASE_URL}/${process.env.MYSQL_DATABASE_NAME}`;
const config = new ConnectionString(mysqlUrl);
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

export default db;
