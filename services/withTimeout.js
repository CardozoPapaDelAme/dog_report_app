// Resolves with the promise's value, or rejects with `timeout` after `ms`.
// The underlying work is not cancelled; callers use this to fail open.
export function withTimeout(promise, ms, schedule = setTimeout, cancel = clearTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = schedule(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => cancel(timer));
}
