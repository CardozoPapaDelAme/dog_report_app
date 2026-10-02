import { submitReportFlag } from './flagApi.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
async function rejects(promise, check) {
  try { await promise; } catch (error) { assert(check(error), `unexpected error ${error.code}`); return; }
  throw new Error('Expected rejection');
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const reportId = '123e4567-e89b-42d3-a456-426614174000';
const fingerprint = 'fp-0123456789abcdef';
const ok = { data: { flag_id: 'f-1', report_status: 'visible' } };

Deno.test('ERI10 API: flag is anonymous, posts the body with the fingerprint and returns the receipt', async () => {
  const calls = [];
  const request = (path, options) => { calls.push({ path, options }); return json(ok, 201); };
  const result = await submitReportFlag({ reportId, reason: 'foto_falsa', detail: '  not a stray dog  ', deviceFingerprint: fingerprint }, request);
  assert(result.flagId === 'f-1' && result.reportStatus === 'visible');
  assert(calls[0].path === `/reports/${reportId}/flags` && calls[0].options.method === 'POST');
  assert(!calls[0].options.headers?.Authorization && !calls[0].options.headers?.['X-Device-Fingerprint']);
  assert(JSON.stringify(JSON.parse(calls[0].options.body)) === JSON.stringify({ reason: 'foto_falsa', device_fingerprint: fingerprint, detail: 'not a stray dog' }));
});

Deno.test('ERI10 API: blank or missing detail is omitted from the body', async () => {
  const bodies = [];
  const request = (path, options) => { bodies.push(JSON.parse(options.body)); return json({ data: { flag_id: 'f', report_status: 'hidden' } }, 201); };
  for (const detail of [undefined, null, '', '   \n']) {
    await submitReportFlag({ reportId, reason: 'otro', detail, deviceFingerprint: fingerprint }, request);
  }
  assert(bodies.length === 4 && bodies.every((body) => !('detail' in body) && body.reason === 'otro'));
  const hidden = await submitReportFlag({ reportId, reason: 'otro', deviceFingerprint: fingerprint }, request);
  assert(hidden.reportStatus === 'hidden');
});

Deno.test('ERI10 API: inputs are validated before any request', async () => {
  let count = 0;
  const request = () => { count++; return json(ok, 201); };
  const base = { reportId, reason: 'otro', deviceFingerprint: fingerprint };
  for (const input of [{}, { ...base, reportId: 'nope' }, { ...base, reportId: reportId.toUpperCase() }, { ...base, reportId: undefined },
    { ...base, reason: 'spam' }, { ...base, reason: undefined }, { ...base, detail: 'a'.repeat(1001) }, { ...base, detail: 5 }]) {
    await rejects(submitReportFlag(input, request), (e) => e instanceof RangeError && e.code === 'invalid_request' && e.status === 400);
  }
  for (const deviceFingerprint of [undefined, '', 'short', 'x'.repeat(15), 12345678901234567]) {
    await rejects(submitReportFlag({ ...base, deviceFingerprint }, request), (e) => e.code === 'invalid_device_fingerprint' && e.status === 400);
  }
  await submitReportFlag({ ...base, detail: 'a'.repeat(1000) }, request);
  assert(count === 1);
});

Deno.test('ERI10 API: maps 404, 409 and 429 (Retry-After) with code, status and request id', async () => {
  const input = { reportId, reason: 'burla', deviceFingerprint: fingerprint };
  const err = (status, code, headers) => () => json({ error: { code, message: code, request_id: 'req-9' } }, status, headers);
  await rejects(submitReportFlag(input, err(404, 'report_not_flaggable')), (e) => e.code === 'report_not_flaggable' && e.status === 404 && e.requestId === 'req-9');
  await rejects(submitReportFlag(input, err(409, 'flag_already_submitted')), (e) => e.code === 'flag_already_submitted' && e.status === 409 && e.retryAfterSeconds === undefined);
  await rejects(submitReportFlag(input, err(429, 'flag_rate_limit_exceeded', { 'Retry-After': '1234' })), (e) => e.code === 'flag_rate_limit_exceeded' && e.status === 429 && e.retryAfterSeconds === 1234);
  await rejects(submitReportFlag(input, err(429, 'flag_rate_limit_exceeded', { 'Retry-After': 'soon' })), (e) => e.retryAfterSeconds === undefined);
  await rejects(submitReportFlag(input, err(503, 'dependency_unavailable')), (e) => e.code === 'dependency_unavailable' && e.status === 503);
  const noBody = () => new Response('oops', { status: 500, headers: { 'X-Request-Id': 'hdr' } });
  await rejects(submitReportFlag(input, noBody), (e) => e.code === 'request_failed' && e.status === 500 && e.requestId === 'hdr');
});

Deno.test('ERI10 API: transport errors pass through and malformed success payloads are invalid_response', async () => {
  const input = { reportId, reason: 'burla', deviceFingerprint: fingerprint };
  const down = Object.assign(new Error('offline'), { code: 'network_unavailable', status: null });
  await rejects(submitReportFlag(input, () => { throw down; }), (e) => e === down);
  const timeout = Object.assign(new Error('t'), { code: 'request_timeout', status: null });
  await rejects(submitReportFlag(input, () => Promise.reject(timeout)), (e) => e === timeout);
  await rejects(submitReportFlag(input, () => json({ data: {} }, 201)), (e) => e.code === 'invalid_response');
  await rejects(submitReportFlag(input, () => new Response('', { status: 201 })), (e) => e.code === 'invalid_response');
});
