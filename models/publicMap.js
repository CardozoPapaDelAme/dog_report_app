// Public map model: zoom bands, viewport helpers, severity styling and wire-format readers.
// Clustering is server-authoritative; the client never re-clusters or invents coordinates.

export const PIN_ZOOM_THRESHOLD = 17;
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 22;

// Mirrors supabase/functions/api/domain/publicMap.js (parity asserted in models/publicMap.test.js).
export const ZOOM_RADIUS_BANDS = Object.freeze([
  { min: 0, max: 8, radiusMeters: 1000 },
  { min: 9, max: 11, radiusMeters: 500 },
  { min: 12, max: 14, radiusMeters: 250 },
  { min: 15, max: 16, radiusMeters: 100 },
  { min: 17, max: 22, radiusMeters: 50 },
]);

export const INCIDENT_TYPES = Object.freeze([
  'avistamiento_simple', 'ataque_mascota', 'ataque_ganado',
  'ataque_humano', 'perro_lastimado', 'otro',
]);
// Clarification #12: human attack > livestock attack > pet attack > injured dog > other > simple sighting.
export const INCIDENT_SEVERITY_ORDER = Object.freeze([
  'ataque_humano', 'ataque_ganado', 'ataque_mascota', 'perro_lastimado', 'otro', 'avistamiento_simple',
]);
export const SIGHTING_TYPES = Object.freeze(['solitario', 'manada']);

// DESIGN.md tokens map-cluster-high/med/low.
export const SEVERITY_COLORS = Object.freeze({ high: '#B71C1C', medium: '#F57C00', low: '#43A047' });

export const CLUSTER_RADIUS_MIN_PX = 18;
export const CLUSTER_RADIUS_MAX_PX = 48;
const CLUSTER_RADIUS_SATURATION_COUNT = 1000;

function invalidResponse(message) {
  return Object.assign(new Error(message), { code: 'invalid_response', status: null });
}

export function normalizeZoom(zoom) {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return null;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
}

export function queryModeForZoom(zoom) {
  const level = normalizeZoom(zoom);
  return level !== null && level >= PIN_ZOOM_THRESHOLD ? 'pins' : 'clusters';
}

export function clusterRadiusMetersForZoom(zoom) {
  const level = normalizeZoom(zoom);
  const band = ZOOM_RADIUS_BANDS.find((candidate) => level >= candidate.min && level <= candidate.max);
  return band ? band.radiusMeters : null;
}

function finiteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

// Accepts {minLongitude,...} or a MapLibre-style [west, south, east, north] array.
export function viewportFromBounds(bounds) {
  let values;
  if (Array.isArray(bounds) && bounds.length === 4) values = bounds;
  else if (bounds && typeof bounds === 'object') {
    values = [bounds.minLongitude, bounds.minLatitude, bounds.maxLongitude, bounds.maxLatitude];
  } else return null;
  if (!values.every(finiteNumber)) return null;
  const [west, south, east, north] = values;
  const viewport = {
    minLongitude: clamp(west, -180, 180),
    minLatitude: clamp(south, -90, 90),
    maxLongitude: clamp(east, -180, 180),
    maxLatitude: clamp(north, -90, 90),
  };
  if (viewport.minLongitude >= viewport.maxLongitude || viewport.minLatitude >= viewport.maxLatitude) return null;
  return viewport;
}

export function viewportToQuery(viewport) {
  if (viewport === null || viewport === undefined) return {};
  const valid = viewportFromBounds(viewport);
  if (!valid || valid.minLongitude !== viewport.minLongitude || valid.minLatitude !== viewport.minLatitude
    || valid.maxLongitude !== viewport.maxLongitude || valid.maxLatitude !== viewport.maxLatitude) {
    throw Object.assign(new RangeError('viewport is invalid'), { code: 'invalid_viewport' });
  }
  return {
    min_longitude: String(valid.minLongitude), min_latitude: String(valid.minLatitude),
    max_longitude: String(valid.maxLongitude), max_latitude: String(valid.maxLatitude),
  };
}

export function isInViewport(location, viewport) {
  if (!viewport) return true;
  return location.longitude >= viewport.minLongitude && location.longitude <= viewport.maxLongitude
    && location.latitude >= viewport.minLatitude && location.latitude <= viewport.maxLatitude;
}

export function severityLevel(incidentType) {
  if (incidentType === 'ataque_humano' || incidentType === 'ataque_ganado') return 'high';
  if (incidentType === 'ataque_mascota' || incidentType === 'perro_lastimado') return 'medium';
  return 'low';
}

export function severityColor(incidentType) {
  return SEVERITY_COLORS[severityLevel(incidentType)];
}

// Size grows with report_count (logarithmic, saturating) within fixed pixel bounds (RF12).
export function clusterRadiusPx(reportCount) {
  if (!Number.isFinite(reportCount) || reportCount <= 1) return CLUSTER_RADIUS_MIN_PX;
  const ratio = Math.min(1, Math.log(reportCount) / Math.log(CLUSTER_RADIUS_SATURATION_COUNT));
  return CLUSTER_RADIUS_MIN_PX + (CLUSTER_RADIUS_MAX_PX - CLUSTER_RADIUS_MIN_PX) * ratio;
}

function readLocation(value) {
  if (!value || typeof value !== 'object') return null;
  const { longitude, latitude } = value;
  if (!finiteNumber(longitude) || !finiteNumber(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return { longitude, latitude };
}

function readTypeCounts(value) {
  if (!value || typeof value !== 'object') return null;
  const counts = {};
  for (const type of INCIDENT_TYPES) {
    const count = value[type];
    if (!Number.isInteger(count) || count < 0) return null;
    counts[type] = count;
  }
  return counts;
}

function readCluster(item) {
  if (!item || typeof item !== 'object') return null;
  const location = readLocation(item.approximate_location);
  const counts = readTypeCounts(item.type_counts);
  if (typeof item.cluster_id !== 'string' || !item.cluster_id || !location || !counts) return null;
  if (!Number.isInteger(item.report_count) || item.report_count < 1) return null;
  if (!INCIDENT_TYPES.includes(item.highest_severity)) return null;
  return {
    cluster_id: item.cluster_id, report_count: item.report_count,
    approximate_location: location, highest_severity: item.highest_severity, type_counts: counts,
  };
}

function readList(data, readItem, idKey) {
  if (!Array.isArray(data)) throw invalidResponse('Public map response must be an array');
  const seen = new Set();
  const items = [];
  for (const raw of data) {
    const item = readItem(raw);
    if (!item || seen.has(item[idKey])) continue;
    seen.add(item[idKey]);
    items.push(item);
  }
  return items;
}

export function readClusters(data) { return readList(data, readCluster, 'cluster_id'); }

function nullableString(value) { return value === null || value === undefined ? null : typeof value === 'string' ? value : false; }

function readDog(value) {
  if (!value || typeof value !== 'object') return null;
  const color = nullableString(value.predominant_color);
  const size = nullableString(value.size);
  const collar = value.has_collar ?? null;
  if (color === false || size === false || (collar !== null && typeof collar !== 'boolean')) return null;
  return { predominant_color: color, size, has_collar: collar };
}

function readPublicReport(item) {
  if (!item || typeof item !== 'object') return null;
  const location = readLocation(item.approximate_location);
  const dog = readDog(item.dog);
  const details = item.details ?? {};
  if (typeof item.report_id !== 'string' || !item.report_id || !location || !dog) return null;
  if (!INCIDENT_TYPES.includes(item.incident_type) || !SIGHTING_TYPES.includes(item.sighting_type)) return null;
  if (typeof details !== 'object' || Array.isArray(details)) return null;
  if (typeof item.has_sanitized_photo !== 'boolean' || typeof item.has_flags !== 'boolean') return null;
  if (typeof item.occurred_at !== 'string' || Number.isNaN(Date.parse(item.occurred_at))) return null;
  return {
    report_id: item.report_id, approximate_location: location, incident_type: item.incident_type,
    sighting_type: item.sighting_type, details: { ...details }, dog,
    has_sanitized_photo: item.has_sanitized_photo, occurred_at: item.occurred_at, has_flags: item.has_flags,
  };
}

export function readPublicReports(data) { return readList(data, readPublicReport, 'report_id'); }
