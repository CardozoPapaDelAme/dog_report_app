import { loadZoneReports } from './zoneReports.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
const cluster = { approximate_location: { longitude: -107.64, latitude: 27.75 } };
const near = (id, at) => ({ report_id: id, approximate_location: { longitude: -107.64, latitude: 27.7501 }, occurred_at: at });
const far = { report_id: 'far', approximate_location: { longitude: -100, latitude: 20 }, occurred_at: '2026-09-01T00:00:00Z' };

Deno.test('keeps only reports inside the cluster area, newest first, requesting limit 1000', async () => {
  let args;
  const result = await loadZoneReports({ cluster, zoom: 13 }, {
    fetchReports: async (value) => { args = value; return [near('a', '2026-09-01T00:00:00Z'), far, near('b', '2026-09-02T00:00:00Z')]; },
  });
  assert(args.limit === 1000);
  assert(result.phase === 'ready');
  assert(result.reports.map((item) => item.report_id).join() === 'b,a');
});

Deno.test('empty when nothing is in the area', async () => {
  const result = await loadZoneReports({ cluster, zoom: 13 }, { fetchReports: async () => [far] });
  assert(result.phase === 'empty' && result.reports.length === 0);
});

Deno.test('maps transport failures to offline and the rest to error', async () => {
  for (const [code, phase] of [['network_unavailable', 'offline'], ['request_timeout', 'offline'], ['internal_error', 'error']]) {
    const result = await loadZoneReports({ cluster, zoom: 13 }, { fetchReports: async () => { throw Object.assign(new Error('x'), { code }); } });
    assert(result.phase === phase, code);
  }
});

Deno.test('recent reports: newest first with limit 100, empty and failure phases', async () => {
  const { loadRecentReports } = await import('./zoneReports.js');
  let args;
  const ready = await loadRecentReports(undefined, {
    fetchReports: async (value) => { args = value; return [near('a', '2026-09-01T00:00:00Z'), near('b', '2026-09-02T00:00:00Z')]; },
  });
  assert(args.limit === 100 && ready.phase === 'ready' && ready.reports.map((item) => item.report_id).join() === 'b,a');
  assert((await loadRecentReports({}, { fetchReports: async () => [] })).phase === 'empty');
  const offline = await loadRecentReports({}, { fetchReports: async () => { throw Object.assign(new Error('x'), { code: 'network_unavailable' }); } });
  assert(offline.phase === 'offline');
  const failed = await loadRecentReports({}, { fetchReports: async () => { throw new Error('x'); } });
  assert(failed.phase === 'error');
});
