import {
  CLUSTER_RADIUS_MAX_PX, CLUSTER_RADIUS_MIN_PX, INCIDENT_SEVERITY_ORDER, INCIDENT_TYPES, PIN_ZOOM_THRESHOLD,
  SEVERITY_COLORS, ZOOM_RADIUS_BANDS, clusterRadiusMetersForZoom, clusterRadiusPx, isInViewport, queryModeForZoom,
  readClusters, readPublicReports, severityColor, severityLevel, viewportFromBounds, viewportToQuery,
} from './publicMap.js';
import {
  INCIDENT_SEVERITY, INCIDENT_TYPES as SERVER_TYPES, ZOOM_RADIUS_BANDS as SERVER_BANDS, clusterRadiusForZoom,
} from '../supabase/functions/api/domain/publicMap.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
function throws(fn, code) {
  try { fn(); } catch (error) { assert(!code || error.code === code, `unexpected ${error.code}`); return; }
  throw new Error('Expected throw');
}
const counts = { avistamiento_simple: 0, ataque_mascota: 1, ataque_ganado: 0, ataque_humano: 0, perro_lastimado: 0, otro: 0 };
const cluster = { cluster_id: 'c1', report_count: 3, approximate_location: { longitude: -107.6, latitude: 27.75 },
  highest_severity: 'ataque_mascota', type_counts: counts };
const report = { report_id: 'r1', approximate_location: { longitude: -107.6, latitude: 27.75 }, incident_type: 'otro',
  sighting_type: 'solitario', details: { cantidad_aprox: 1 }, dog: { predominant_color: null, size: 'mediano', has_collar: false },
  has_sanitized_photo: true, occurred_at: '2026-09-01T08:00:00.000Z', has_flags: false };

Deno.test('ERI9 model: zoom bands and incident types match the server module', () => {
  assert(JSON.stringify(ZOOM_RADIUS_BANDS) === JSON.stringify(SERVER_BANDS));
  assert(JSON.stringify(INCIDENT_TYPES) === JSON.stringify(SERVER_TYPES));
  for (let zoom = 0; zoom <= 22; zoom++) assert(clusterRadiusMetersForZoom(zoom) === clusterRadiusForZoom(zoom));
  const rank = (type) => INCIDENT_SEVERITY[type];
  for (let i = 1; i < INCIDENT_SEVERITY_ORDER.length; i++) {
    assert(rank(INCIDENT_SEVERITY_ORDER[i - 1]) > rank(INCIDENT_SEVERITY_ORDER[i]));
  }
});

Deno.test('ERI9 model: pins start at zoom 17 and zoom is normalized', () => {
  assert(PIN_ZOOM_THRESHOLD === 17);
  assert(queryModeForZoom(16.9) === 'clusters' && queryModeForZoom(17) === 'pins' && queryModeForZoom(22) === 'pins');
  assert(queryModeForZoom(0) === 'clusters' && queryModeForZoom(NaN) === 'clusters');
});

Deno.test('ERI9 model: viewport is validated, clamped and serialized all-or-none', () => {
  const viewport = viewportFromBounds([-107.7, 27.7, -107.5, 27.8]);
  assert(viewport.minLongitude === -107.7 && viewport.maxLatitude === 27.8);
  const clamped = viewportFromBounds({ minLongitude: -200, minLatitude: -95, maxLongitude: 200, maxLatitude: 95 });
  assert(clamped.minLongitude === -180 && clamped.maxLatitude === 90);
  for (const bad of [null, undefined, [1, 2, 3], [NaN, 0, 1, 1], [5, 0, 1, 1], [0, 5, 1, 1], [0, 0, 0, 1], ['a', 0, 1, 1]]) {
    assert(viewportFromBounds(bad) === null);
  }
  const query = viewportToQuery(viewport);
  assert(Object.keys(query).length === 4 && query.min_longitude === '-107.7' && query.max_latitude === '27.8');
  assert(Object.keys(viewportToQuery(undefined)).length === 0);
  throws(() => viewportToQuery({ minLongitude: 1, minLatitude: 0, maxLongitude: 0, maxLatitude: 1 }), 'invalid_viewport');
  throws(() => viewportToQuery({ minLongitude: -200, minLatitude: 0, maxLongitude: 0, maxLatitude: 1 }), 'invalid_viewport');
  assert(isInViewport({ longitude: -107.6, latitude: 27.75 }, viewport) && !isInViewport({ longitude: 0, latitude: 0 }, viewport));
});

Deno.test('ERI9 model: severity levels and colours follow clarification 12 and DESIGN tokens', () => {
  assert(severityLevel('ataque_humano') === 'high' && severityLevel('ataque_ganado') === 'high');
  assert(severityLevel('ataque_mascota') === 'medium' && severityLevel('perro_lastimado') === 'medium');
  assert(severityLevel('otro') === 'low' && severityLevel('avistamiento_simple') === 'low');
  assert(severityColor('ataque_humano') === '#B71C1C' && SEVERITY_COLORS.medium === '#F57C00' && SEVERITY_COLORS.low === '#43A047');
});

Deno.test('ERI9 model: cluster radius grows with count inside fixed bounds', () => {
  assert(clusterRadiusPx(1) === CLUSTER_RADIUS_MIN_PX && clusterRadiusPx(0) === CLUSTER_RADIUS_MIN_PX && clusterRadiusPx(NaN) === CLUSTER_RADIUS_MIN_PX);
  assert(clusterRadiusPx(10) > clusterRadiusPx(2) && clusterRadiusPx(100) > clusterRadiusPx(10));
  assert(clusterRadiusPx(1000) === CLUSTER_RADIUS_MAX_PX && clusterRadiusPx(1e6) === CLUSTER_RADIUS_MAX_PX);
});

Deno.test('ERI9 model: readClusters keeps valid items and drops malformed or duplicate ones', () => {
  const items = readClusters([cluster, cluster, { ...cluster, cluster_id: 'c2', extra: 'x' },
    { ...cluster, cluster_id: 'c3', report_count: 0 },
    { ...cluster, cluster_id: 'c4', approximate_location: { longitude: 999, latitude: 0 } },
    { ...cluster, cluster_id: 'c5', approximate_location: null },
    { ...cluster, cluster_id: 'c6', highest_severity: 'bogus' },
    { ...cluster, cluster_id: 'c7', type_counts: { otro: 1 } },
    { ...cluster, cluster_id: 'c8', type_counts: { ...counts, otro: -1 } }, null, 'x']);
  assert(items.length === 2 && items[0].cluster_id === 'c1' && items[1].cluster_id === 'c2');
  assert(!Object.hasOwn(items[1], 'extra'));
  assert(readClusters([]).length === 0);
  for (const bad of [null, {}, 'x']) throws(() => readClusters(bad), 'invalid_response');
});

Deno.test('ERI9 model: readPublicReports validates the public view and never invents coordinates', () => {
  const items = readPublicReports([report, report, { ...report, report_id: 'r2', details: null },
    { ...report, report_id: 'r3', approximate_location: { longitude: -107.6 } },
    { ...report, report_id: 'r4', incident_type: 'x' }, { ...report, report_id: 'r5', sighting_type: 'x' },
    { ...report, report_id: 'r6', dog: null }, { ...report, report_id: 'r7', has_flags: 'no' },
    { ...report, report_id: 'r8', occurred_at: 'nope' }, { ...report, report_id: 'r9', dog: { size: 3 } }]);
  assert(items.length === 2 && items[1].report_id === 'r2' && Object.keys(items[1].details).length === 0);
  assert(items[0].dog.has_collar === false && items[0].dog.predominant_color === null);
  throws(() => readPublicReports({}), 'invalid_response');
});
