// Caches one in-flight/successful model load. `reset()` drops the cached promise so
// the next `load()` starts a fresh attempt (used after a hung or failed load).
export function createLazyModelLoader(factory) {
  let promise = null;
  function load() {
    if (!promise) {
      const attempt = Promise.resolve().then(factory);
      promise = attempt;
      attempt.catch(() => {
        if (promise === attempt) promise = null;
      });
    }
    return promise;
  }
  function reset() {
    promise = null;
  }
  return { load, reset };
}
