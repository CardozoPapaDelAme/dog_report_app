import postgres from 'postgres';

import { getConfig } from './config.js';

let sql;

export function getSql() {
  const { databaseUrl } = getConfig();
  if (!databaseUrl) {
    throw new Error('APP_BACKEND_DATABASE_URL is not set');
  }
  if (!sql) {
    sql = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      ssl: 'require',
      idle_timeout: 5,
      connect_timeout: 10,
    });
  }
  return sql;
}
