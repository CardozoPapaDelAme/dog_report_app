import { sendReportFlag } from './reportFlagSubmit.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
const reportId = '123e4567-e89b-42d3-a456-426614174000';
const getFingerprint = async () => 'fp-0123456789abcdef';

Deno.test('submits with the fingerprint and reports a neutral success', async () => {
  let args;
  const outcome = await sendReportFlag({ reportId, reason: 'burla', detail: 'x' }, {
    getFingerprint, submit: async (value) => { args = value; return { flagId: 'f', reportStatus: 'hidden' }; },
  });
  assert(outcome.key === 'submitted' && !('reportStatus' in outcome));
  assert(args.deviceFingerprint === 'fp-0123456789abcdef' && args.reportId === reportId && args.reason === 'burla');
});

Deno.test('rejects an invalid draft without calling the server', async () => {
  let called = false;
  const submit = async () => { called = true; };
  assert((await sendReportFlag({ reportId, reason: undefined }, { getFingerprint, submit })).key === 'invalid');
  assert((await sendReportFlag({ reportId, reason: 'otro', detail: 'a'.repeat(1001) }, { getFingerprint, submit })).key === 'invalid');
  assert(!called);
});

Deno.test('maps server and transport errors', async () => {
  const fail = (props) => async () => { throw Object.assign(new Error('x'), props); };
  const run = (props) => sendReportFlag({ reportId, reason: 'otro' }, { getFingerprint, submit: fail(props) });
  assert((await run({ status: 409, code: 'flag_already_submitted' })).key === 'already_flagged');
  assert((await run({ status: 404, code: 'report_not_flaggable' })).key === 'not_flaggable');
  const limited = await run({ status: 429, retryAfterSeconds: 120 });
  assert(limited.key === 'rate_limited' && limited.retryAfterMinutes === 2);
  assert((await run({ code: 'network_unavailable' })).key === 'offline');
  assert((await run({ status: 503 })).key === 'unavailable');
});

Deno.test('a failing fingerprint lookup is a generic failure', async () => {
  const outcome = await sendReportFlag({ reportId, reason: 'otro' }, { getFingerprint: async () => { throw new Error('db'); } });
  assert(outcome.key === 'unavailable');
});
