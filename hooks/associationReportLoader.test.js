import { loadAssociationReportRange } from './associationReportLoader.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
const range = { from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T23:59:59.999Z' };

Deno.test('RIC-2 loader: follows every cursor and returns the complete range once', async () => {
  const calls = [];
  const rows = await loadAssociationReportRange({ accessToken: 'token', range, getPage: async (options) => {
    calls.push(options);
    return options.cursor === null
      ? { items: [{ id: 'one' }], next_cursor: 'cursor-2' }
      : { items: [{ id: 'two' }], next_cursor: null };
  } });
  assert(rows.map((row) => row.id).join(',') === 'one,two');
  assert(calls.length === 2 && calls[1].cursor === 'cursor-2');
  assert(calls.every((call) => call.accessToken === 'token' && call.from === range.from && call.to === range.to));
});

Deno.test('RIC-2 loader: empty range needs only one request', async () => {
  let calls = 0;
  const rows = await loadAssociationReportRange({ accessToken: 'token', range, getPage: async () => {
    calls += 1; return { items: [], next_cursor: null };
  } });
  assert(rows.length === 0 && calls === 1);
});

Deno.test('RIC-2 loader: repeated cursor or report rejects incomplete results', async () => {
  for (const pages of [
    [{ items: [{ id: 'one' }], next_cursor: 'same' }, { items: [{ id: 'two' }], next_cursor: 'same' }],
    [{ items: [{ id: 'one' }], next_cursor: 'next' }, { items: [{ id: 'one' }], next_cursor: null }],
  ]) {
    let index = 0;
    try {
      await loadAssociationReportRange({ accessToken: 'token', range, getPage: async () => pages[index++] });
      throw new Error('Incomplete range accepted');
    } catch (error) { assert(error.code === 'invalid_response'); }
  }
});

Deno.test('RIC-2 loader: a failed later page never resolves a partial range', async () => {
  try {
    await loadAssociationReportRange({ accessToken: 'token', range, getPage: async ({ cursor }) => {
      if (!cursor) return { items: [{ id: 'one' }], next_cursor: 'next' };
      throw Object.assign(new Error('Network failed'), { status: 503 });
    } });
    throw new Error('Partial range accepted');
  } catch (error) { assert(error.status === 503); }
});
