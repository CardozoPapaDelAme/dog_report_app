/**
 * @module services/withTimeout
 * Promise timeout helper used by fail-open client flows (photo validation, colour detection).
 */
// Resolves with the promise's value, or rejects with `timeout` after `ms`.
// The underlying work is not cancelled; callers use this to fail open.
/**
 * @template T
 * @param {Promise<T>} promise - Work to wait for.
 * @param {number} ms - Timeout in milliseconds.
 * @param {Function} [schedule=setTimeout] - Injectable timer (tests).
 * @param {Function} [cancel=clearTimeout] - Injectable timer cancellation (tests).
 * @returns {Promise<T>}
 * @throws {Error} With `code: 'timeout'` when `ms` elapses first; otherwise the rejection of `promise`.
 */
export function withTimeout(promise, ms, schedule = setTimeout, cancel = clearTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = schedule(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => cancel(timer));
}
