import { getAssociationReportsPage } from './associationReportApi.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
const range = { from: '2026-09-01T06:00:00.000Z', to: '2026-09-03T05:59:59.999Z' };

Deno.test('RIC-2 API: sends authorized date range, limit and opaque cursor', async () => {
  let captured;
  const page = await getAssociationReportsPage({ accessToken: 'token', ...range, cursor: 'a+/=' }, async (path, options) => {
    captured = { path, options };
    return Response.json({ data: { items: [], next_cursor: null } });
  });
  const [path, search] = captured.path.split('?');
  const params = new URLSearchParams(search);
  assert(path === '/association/reports');
  assert(params.get('from') === range.from && params.get('to') === range.to);
  assert(params.get('limit') === '500' && params.get('cursor') === 'a+/=');
  assert(captured.options.headers.Authorization === 'Bearer token');
  assert(page.items.length === 0 && page.next_cursor === null);
});

Deno.test('RIC-2 API: preserves authorization failures and refuses missing token', async () => {
  let called = false;
  try {
    await getAssociationReportsPage({ accessToken: '', ...range }, () => { called = true; });
    throw new Error('Missing token accepted');
  } catch (error) { assert(error.status === 401 && !called); }
  try {
    await getAssociationReportsPage({ accessToken: 'expired', ...range }, async () =>
      Response.json({ error: { code: 'invalid_token', message: 'Expired', request_id: 'request-1' } }, { status: 401 }));
    throw new Error('Server failure accepted');
  } catch (error) { assert(error.status === 401 && error.code === 'invalid_token' && error.requestId === 'request-1'); }
});

Deno.test('RIC-2 API: fails closed on an incomplete success response', async () => {
  try {
    await getAssociationReportsPage({ accessToken: 'token', ...range }, async () => Response.json({ data: { items: [] } }));
    throw new Error('Incomplete page accepted');
  } catch (error) { assert(error.code === 'invalid_response'); }
});
