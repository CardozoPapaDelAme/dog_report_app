// RNF12: pure scheduler that retries the durable draft queue when the network
// returns or the app comes to the foreground.
//
// Eligibility is owned by the queue, not duplicated here: `syncDueDrafts` only
// lists queued/submitting/uploading/awaiting_processing/retry_wait drafts and
// skips those whose `next_retry_at` (backoff / Retry-After) has not elapsed.
// `draft` (waiting on the user) and `terminal_error` / `synced` are never touched.
// Retries reuse the same submit/upload path, so the final report UUID keeps the
// server idempotent (replay -> 200).
export const AUTO_SYNC_DEBOUNCE_MS = 2000;

export function createDraftAutoSync({
  syncDueDrafts,
  isBusy = () => false,
  debounceMs = AUTO_SYNC_DEBOUNCE_MS,
  schedule = setTimeout,
  cancel = clearTimeout,
  onError = () => {},
} = {}) {
  if (typeof syncDueDrafts !== 'function') throw new Error('sync_due_drafts_required');
  let timer = null;
  let running = false;
  let disposed = false;

  async function runPass() {
    timer = null;
    // Single-flight: an in-flight auto pass or a manual sync owns the drafts.
    if (disposed || running || isBusy()) return;
    running = true;
    try {
      await syncDueDrafts();
    } catch (error) {
      try { onError(error); } catch { /* never throw */ }
    } finally {
      running = false;
    }
  }

  // Coalesces bursts: every trigger restarts one debounce window, one pass runs.
  function trigger() {
    if (disposed) return;
    if (timer !== null) cancel(timer);
    timer = schedule(() => { void runPass(); }, debounceMs);
  }

  function dispose() {
    disposed = true;
    if (timer !== null) cancel(timer);
    timer = null;
  }

  return { trigger, dispose };
}

export function networkIsOnline(state) {
  return Boolean(state?.isConnected) && state?.isInternetReachable !== false;
}

// Fires only on an offline -> online transition (or the first online reading).
export function createNetworkTrigger(onReconnect) {
  let online = false;
  return function handleNetworkState(state) {
    const next = networkIsOnline(state);
    const reconnected = next && !online;
    online = next;
    if (reconnected) onReconnect();
  };
}
