// Caches one in-flight/successful model load. `reset()` drops the cached promise so
// the next `load()` starts a fresh attempt (used after a hung or failed load).
// `pendingSinceMs()` reports how long the current load has been in flight (null
// when nothing is pending) so callers can tell a slow load from a hung one.
export function createLazyModelLoader(factory, { now = () => Date.now() } = {}) {
  let promise = null;
  let startedAt = null;
  function load() {
    if (!promise) {
      const attempt = Promise.resolve().then(factory);
      promise = attempt;
      startedAt = now();
      attempt.then(() => {
        if (promise === attempt) startedAt = null;
      }, () => {
        if (promise === attempt) { promise = null; startedAt = null; }
      });
    }
    return promise;
  }
  function reset() {
    promise = null;
    startedAt = null;
  }
  function pendingSinceMs() {
    return startedAt === null ? null : Math.max(0, now() - startedAt);
  }
  return { load, reset, pendingSinceMs };
}
