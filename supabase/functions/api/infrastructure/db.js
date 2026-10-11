/**
 * @module infrastructure/db
 * Lazily creates and caches the single `postgres` client used by every repository.
 * The pool is capped at one connection with TLS required, sized for short-lived Edge Function instances.
 */
import postgres from 'postgres';

import { getConfig } from './config.js';

let sql;

/**
 * Returns the shared `postgres` tagged-template client, creating it on first use.
 * @returns {import('postgres').Sql} Shared SQL client.
 * @throws {Error} When `APP_BACKEND_DATABASE_URL` is not set.
 */
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
