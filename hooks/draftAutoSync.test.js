import { createDraftAutoSync, createNetworkTrigger } from './draftAutoSync.js';
import { REPORT_DRAFT_STATE, draftSyncIsDue } from '../models/reportDraft.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

// Manual clock so debounce is deterministic.
function fakeClock() {
  let nextId = 1;
  const timers = new Map();
  return {
    schedule: (fn) => { const id = nextId++; timers.set(id, fn); return id; },
    cancel: (id) => { timers.delete(id); },
    flush: async () => {
      const fns = [...timers.values()];
      timers.clear();
      fns.forEach((fn) => fn());
      await new Promise((r) => setTimeout(r, 0));
    },
    pending: () => timers.size,
  };
}

Deno.test('RNF12 reconnect triggers exactly one pass', async () => {
  const clock = fakeClock();
  let passes = 0;
  const sync = createDraftAutoSync({ syncDueDrafts: async () => { passes += 1; }, ...clock });
  const onNetwork = createNetworkTrigger(sync.trigger);
  onNetwork({ isConnected: false, isInternetReachable: false });
  await clock.flush();
  assert(passes === 0, 'offline must not sync');
  onNetwork({ isConnected: true, isInternetReachable: true });
  onNetwork({ isConnected: true, isInternetReachable: true });
  await clock.flush();
  assert(passes === 1);
});

Deno.test('connected but internet unreachable does not trigger', async () => {
  const clock = fakeClock();
  let passes = 0;
  const sync = createDraftAutoSync({ syncDueDrafts: async () => { passes += 1; }, ...clock });
  const onNetwork = createNetworkTrigger(sync.trigger);
  onNetwork({ isConnected: true, isInternetReachable: false });
  await clock.flush();
  assert(passes === 0);
  onNetwork({ isConnected: true, isInternetReachable: true });
  await clock.flush();
  assert(passes === 1);
});

Deno.test('repeated events within the debounce window coalesce', async () => {
  const clock = fakeClock();
  let passes = 0;
  const sync = createDraftAutoSync({ syncDueDrafts: async () => { passes += 1; }, ...clock });
  sync.trigger(); sync.trigger(); sync.trigger();
  assert(clock.pending() === 1);
  await clock.flush();
  assert(passes === 1);
});

Deno.test('a trigger during an in-flight pass does not start another', async () => {
  const clock = fakeClock();
  let passes = 0;
  let release;
  const sync = createDraftAutoSync({
    syncDueDrafts: () => { passes += 1; return new Promise((r) => { release = r; }); },
    ...clock,
  });
  sync.trigger();
  await clock.flush();
  sync.trigger();
  await clock.flush();
  assert(passes === 1, 'single-flight');
  release();
  await new Promise((r) => setTimeout(r, 0));
  sync.trigger();
  await clock.flush();
  assert(passes === 2, 'next trigger after completion runs');
});

Deno.test('a manual sync in flight blocks the auto pass', async () => {
  const clock = fakeClock();
  let passes = 0;
  let busy = true;
  const sync = createDraftAutoSync({ syncDueDrafts: async () => { passes += 1; }, isBusy: () => busy, ...clock });
  sync.trigger();
  await clock.flush();
  assert(passes === 0);
  busy = false;
  sync.trigger();
  await clock.flush();
  assert(passes === 1);
});

Deno.test('failures are swallowed and the next trigger retries', async () => {
  const clock = fakeClock();
  let passes = 0;
  const errors = [];
  const sync = createDraftAutoSync({
    syncDueDrafts: async () => { passes += 1; if (passes === 1) throw new Error('offline again'); },
    onError: (e) => { errors.push(e.message); throw new Error('onError must not escape'); },
    ...clock,
  });
  sync.trigger();
  await clock.flush();
  assert(passes === 1 && errors.length === 1);
  sync.trigger();
  await clock.flush();
  assert(passes === 2);
});

Deno.test('dispose cancels a pending pass', async () => {
  const clock = fakeClock();
  let passes = 0;
  const sync = createDraftAutoSync({ syncDueDrafts: async () => { passes += 1; }, ...clock });
  sync.trigger();
  sync.dispose();
  sync.trigger();
  await clock.flush();
  assert(passes === 0);
});

Deno.test('eligibility: drafts awaiting the user or permanently rejected are not due; backoff is respected', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const due = (local_state, next_retry_at = null) => draftSyncIsDue({ local_state, next_retry_at }, now);
  assert(due(REPORT_DRAFT_STATE.QUEUED));
  assert(due(REPORT_DRAFT_STATE.RETRY_WAIT, '2026-10-02T11:59:00Z'));
  assert(due(REPORT_DRAFT_STATE.AWAITING_PROCESSING));
  assert(!due(REPORT_DRAFT_STATE.RETRY_WAIT, '2026-10-02T12:05:00Z'), 'backoff / Retry-After');
  assert(!due(REPORT_DRAFT_STATE.DRAFT), 'waiting on the user');
  assert(!due(REPORT_DRAFT_STATE.TERMINAL_ERROR), 'permanently rejected');
  assert(!due(REPORT_DRAFT_STATE.SYNCED));
});
