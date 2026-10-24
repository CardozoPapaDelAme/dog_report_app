/**
 * @module infrastructure/db
 * Lazily creates and caches the single `postgres` client used by every repository.
 * The pool is capped at one connection with TLS required, sized for short-lived Edge Function instances.
 *
 * The connection goes through Supavisor in transaction mode. postgres.js pipelines concurrent
 * queries on one connection, which Supavisor does not handle across transactions (INC-4: requests
 * hung and Postgres logged `25001 there is already a transaction in progress`). Every operation is
 * therefore queued so only one query or transaction is in flight per instance, and an operation
 * that exceeds the timeout fails with `CONNECTION_CLOSED` and discards the connection.
 */
import postgres from 'postgres';

import { getConfig } from './config.js';

/** Longest time a queued query or transaction may run before the connection is discarded. */
export const DB_OPERATION_TIMEOUT_MS = 10_000;

/**
 * Builds a serialized SQL client on top of a postgres.js connection factory.
 * Exposed for tests; production code uses {@link getSql}.
 * @param {object} options
 * @param {() => import('postgres').Sql} options.connect Creates a new postgres.js client.
 * @param {number} [options.timeoutMs] Per-operation timeout in milliseconds.
 * @returns {Function & {begin: Function}} Tagged-template function with `begin(fn)`, like postgres.js.
 */
export function createSqlClient({ connect, timeoutMs = DB_OPERATION_TIMEOUT_MS }) {
  let client;
  let tail = Promise.resolve();

  function discard(stale) {
    if (client === stale) client = undefined;
    stale.end({ timeout: 0 }).catch(() => {});
  }

  function runWithTimeout(task) {
    client ??= connect();
    const current = client;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        discard(current);
        const error = new Error('Database operation timed out; connection discarded.');
        error.code = 'CONNECTION_CLOSED';
        reject(error);
      }, timeoutMs);
      Promise.resolve()
        .then(() => task(current))
        .then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          (error) => {
            clearTimeout(timer);
            reject(error);
          },
        );
    });
  }

  function enqueue(task) {
    const run = tail.then(() => runWithTimeout(task));
    tail = run.catch(() => {});
    return run;
  }

  const sql = (strings, ...values) => enqueue((current) => current(strings, ...values));
  sql.begin = (fn) => enqueue((current) => current.begin(fn));
  return sql;
}

let sql;

/**
 * Returns the shared serialized SQL client, creating it on first use.
 * @returns {Function & {begin: Function}} Shared SQL client (tagged template and `begin`).
 * @throws {Error} When `APP_BACKEND_DATABASE_URL` is not set.
 */
export function getSql() {
  const { databaseUrl } = getConfig();
  if (!databaseUrl) {
    throw new Error('APP_BACKEND_DATABASE_URL is not set');
  }
  if (!sql) {
    sql = createSqlClient({
      connect: () =>
        postgres(databaseUrl, {
          max: 1,
          prepare: false,
          ssl: 'require',
          idle_timeout: 5,
          connect_timeout: 10,
        }),
    });
  }
  return sql;
}
