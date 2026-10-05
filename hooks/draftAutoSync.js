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
  // Called after every pass settles (success, failure or no change) so the
  // caller can re-arm the retry wake-up.
  onPassSettled = () => {},
} = {}) {
  if (typeof syncDueDrafts !== 'function') throw new Error('sync_due_drafts_required');
  let timer = null;
  let running = false;
  let disposed = false;
  let pending = false;

  async function runPass() {
    timer = null;
    if (disposed) return;
    // Single-flight: an in-flight auto pass or a manual sync owns the drafts.
    // A trigger that arrives meanwhile is remembered and replayed once (still
    // debounced) when that work finishes, instead of being dropped.
    if (running) { pending = true; return; }
    if (isBusy()) { trigger(); return; }
    pending = false;
    running = true;
    try {
      await syncDueDrafts();
    } catch (error) {
      try { onError(error); } catch { /* never throw */ }
    } finally {
      running = false;
      try { onPassSettled(); } catch { /* never throw */ }
      if (pending) trigger();
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
    pending = false;
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

export const RETRY_WAKEUP_MIN_MS = 1000;
const MAX_TIMER_MS = 2 ** 31 - 1;
const RETRY_WAIT_STATES = Object.freeze([
  'queued', 'submitting', 'uploading', 'awaiting_processing', 'retry_wait',
]);

// Milliseconds until the earliest FUTURE `next_retry_at` among syncable drafts,
// clamped to [minMs, MAX_TIMER_MS]; null when nothing is due later.
export function nextRetryDelayMs(drafts, now = new Date(), minMs = RETRY_WAKEUP_MIN_MS) {
  const current = new Date(now).getTime();
  let earliest = null;
  for (const draft of drafts ?? []) {
    if (!RETRY_WAIT_STATES.includes(draft?.local_state) || !draft.next_retry_at) continue;
    const at = new Date(draft.next_retry_at).getTime();
    if (!Number.isFinite(at) || at <= current) continue;
    if (earliest === null || at < earliest) earliest = at;
  }
  if (earliest === null) return null;
  return Math.min(Math.max(earliest - current, minMs), MAX_TIMER_MS);
}

// Re-arms one timer for the earliest backoff expiry while online and active, and
// calls `trigger` when it elapses. Call `setDrafts` after every pass/reload.
export function createRetryWakeup({
  trigger,
  now = () => new Date(),
  schedule = setTimeout,
  cancel = clearTimeout,
  minMs = RETRY_WAKEUP_MIN_MS,
} = {}) {
  if (typeof trigger !== 'function') throw new Error('trigger_required');
  let drafts = [];
  let active = false;
  let disposed = false;
  let timer = null;

  function clear() {
    if (timer !== null) cancel(timer);
    timer = null;
  }

  function arm() {
    clear();
    if (disposed || !active) return;
    const delay = nextRetryDelayMs(drafts, now(), minMs);
    if (delay === null) return;
    timer = schedule(() => { timer = null; trigger(); }, delay);
  }

  return {
    setDrafts(next) { drafts = Array.isArray(next) ? next : []; arm(); },
    setActive(next) { active = Boolean(next); arm(); },
    rearm: arm,
    dispose() { disposed = true; clear(); },
  };
}
