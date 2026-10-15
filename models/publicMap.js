/**
 * @module models/publicMap
 * Client-side model for the public map: zoom bands, viewport helpers, severity styling, response readers
 * and zone detail filtering.
 */
// Public map model: zoom bands, viewport helpers, severity styling and wire-format readers.
// Clustering is server-authoritative; the client never re-clusters or invents coordinates.

export const PIN_ZOOM_THRESHOLD = 17;
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 22;
/** Deepest zoom in heatmap mode: beyond it single reports read as isolated blurred dots; use cluster mode for detail. */
export const HEATMAP_MAX_ZOOM = 15;

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

/** Builds an Error with `code: 'invalid_response'` and `status: null`. */
function invalidResponse(message) {
  return Object.assign(new Error(message), { code: 'invalid_response', status: null });
}

/**
 * @param {unknown} zoom
 * @returns {number | null} Floored and clamped to `[MIN_ZOOM, MAX_ZOOM]`, or `null` when not finite.
 */
export function normalizeZoom(zoom) {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return null;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
}

/**
 * @param {number} zoom
 * @returns {'pins' | 'clusters'} `pins` from {@link PIN_ZOOM_THRESHOLD} upwards.
 */
export function queryModeForZoom(zoom) {
  const level = normalizeZoom(zoom);
  return level !== null && level >= PIN_ZOOM_THRESHOLD ? 'pins' : 'clusters';
}

/**
 * @param {number} zoom
 * @returns {number | null} Cluster radius of the zoom band, or `null` for an invalid zoom.
 */
export function clusterRadiusMetersForZoom(zoom) {
  const level = normalizeZoom(zoom);
  if (level === null) return null;
  const band = ZOOM_RADIUS_BANDS.find((candidate) => level >= candidate.min && level <= candidate.max);
  return band ? band.radiusMeters : null;
}

function finiteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

// Accepts {minLongitude,...} or a MapLibre-style [west, south, east, north] array.
/**
 * @typedef {object} Viewport
 * @property {number} minLongitude
 * @property {number} minLatitude
 * @property {number} maxLongitude
 * @property {number} maxLatitude
 */
/**
 * @param {Viewport | [number, number, number, number] | null | undefined} bounds - Object or
 *   `[west, south, east, north]`.
 * @returns {Viewport | null} Clamped viewport, or `null` when invalid or empty.
 */
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

/**
 * @param {Viewport | null | undefined} viewport
 * @returns {Record<string, string>} `min_longitude`... query parameters; empty without a viewport.
 * @throws {RangeError} `invalid_viewport` when the viewport is invalid or out of range.
 */
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

/**
 * @param {{longitude: number, latitude: number}} location
 * @param {Viewport | null | undefined} viewport
 * @returns {boolean} `true` without a viewport.
 */
export function isInViewport(location, viewport) {
  if (!viewport) return true;
  return location.longitude >= viewport.minLongitude && location.longitude <= viewport.maxLongitude
    && location.latitude >= viewport.minLatitude && location.latitude <= viewport.maxLatitude;
}

/**
 * @param {string} incidentType
 * @returns {'high' | 'medium' | 'low'}
 */
export function severityLevel(incidentType) {
  if (incidentType === 'ataque_humano' || incidentType === 'ataque_ganado') return 'high';
  if (incidentType === 'ataque_mascota' || incidentType === 'perro_lastimado') return 'medium';
  return 'low';
}

/**
 * @param {string} incidentType
 * @returns {string} Hex colour from {@link SEVERITY_COLORS}.
 */
export function severityColor(incidentType) {
  return SEVERITY_COLORS[severityLevel(incidentType)];
}

// Size grows with report_count (logarithmic, saturating) within fixed pixel bounds (RF12).
/**
 * @param {number} reportCount
 * @returns {number} Marker radius between the min and max pixel bounds.
 */
export function clusterRadiusPx(reportCount) {
  if (!Number.isFinite(reportCount) || reportCount <= 1) return CLUSTER_RADIUS_MIN_PX;
  const ratio = Math.min(1, Math.log(reportCount) / Math.log(CLUSTER_RADIUS_SATURATION_COUNT));
  return CLUSTER_RADIUS_MIN_PX + (CLUSTER_RADIUS_MAX_PX - CLUSTER_RADIUS_MIN_PX) * ratio;
}

/** Returns `{longitude, latitude}` when finite and in range, otherwise `null`. */
function readLocation(value) {
  if (!value || typeof value !== 'object') return null;
  const { longitude, latitude } = value;
  if (!finiteNumber(longitude) || !finiteNumber(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return { longitude, latitude };
}

/** Returns counts for every incident type, or `null` when any is not a non-negative integer. */
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

/** Validates one cluster item; `null` when invalid. */
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

/** Reads an array with `readItem`, dropping invalid and repeated items; throws `invalid_response` for non-arrays. */
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

/**
 * @typedef {object} MapCluster
 * @property {string} cluster_id
 * @property {number} report_count
 * @property {{longitude: number, latitude: number}} approximate_location
 * @property {string} highest_severity - Incident type.
 * @property {Record<string, number>} type_counts - Count per incident type.
 */
/**
 * @param {unknown} data
 * @returns {MapCluster[]} Valid, unique clusters; invalid items are dropped.
 * @throws {Error} `invalid_response` when `data` is not an array.
 */
export function readClusters(data) { return readList(data, readCluster, 'cluster_id'); }

/** Returns the string, `null` for null/undefined, or `false` for any other type. */
function nullableString(value) { return value === null || value === undefined ? null : typeof value === 'string' ? value : false; }

/** Validates public dog fields; `null` when invalid. */
function readDog(value) {
  if (!value || typeof value !== 'object') return null;
  const color = nullableString(value.predominant_color);
  const size = nullableString(value.size);
  const collar = value.has_collar ?? null;
  if (color === false || size === false || (collar !== null && typeof collar !== 'boolean')) return null;
  return { predominant_color: color, size, has_collar: collar };
}

/** Validates one public report item; `null` when invalid. */
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

/**
 * @typedef {object} PublicReport
 * @property {string} report_id
 * @property {{longitude: number, latitude: number}} approximate_location
 * @property {string} incident_type
 * @property {string} sighting_type
 * @property {object} details
 * @property {{predominant_color: string | null, size: string | null, has_collar: boolean | null}} dog
 * @property {boolean} has_sanitized_photo
 * @property {string} occurred_at
 * @property {boolean} has_flags
 */
/**
 * @param {unknown} data
 * @returns {PublicReport[]} Valid, unique reports; invalid items are dropped.
 * @throws {Error} `invalid_response` when `data` is not an array.
 */
export function readPublicReports(data) { return readList(data, readPublicReport, 'report_id'); }

const EARTH_RADIUS_METERS = 6371008.8;

/** Great-circle distance in metres between two locations. */
function haversineMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Zone detail (ERI-10): no server endpoint lists cluster members, so filter the public reports locally by
// distance from the cluster centroid (approximate locations only) within the zoom band radius. Newest first.
/**
 * @param {PublicReport[]} reports
 * @param {MapCluster} cluster
 * @param {number} zoom - Determines the radius band.
 * @returns {PublicReport[]} Reports within the band radius of the cluster centroid, newest first.
 */
export function reportsInCluster(reports, cluster, zoom) {
  const radius = clusterRadiusMetersForZoom(zoom);
  const center = readLocation(cluster?.approximate_location);
  if (!Array.isArray(reports) || radius === null || !center) return [];
  return reports
    .filter((item) => {
      const location = readLocation(item?.approximate_location);
      return location !== null && haversineMeters(center, location) <= radius;
    })
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
}

/** Heat contribution per severity level: a serious incident warms the map more than a sighting. */
export const HEATMAP_SEVERITY_WEIGHT = Object.freeze({ low: 1, medium: 2, high: 3 });

/**
 * Builds the heatmap source from individual public reports (already the stable 50 m approximation,
 * so nothing finer than that is exposed). Density comes from overlapping points, not from clusters.
 * @param {PublicReport[]} reports
 * @returns {{type: 'FeatureCollection', features: object[]}} Point features weighted by incident severity.
 */
export function reportsToHeatmapGeoJSON(reports) {
  const features = [];
  for (const item of Array.isArray(reports) ? reports : []) {
    const location = readLocation(item?.approximate_location);
    if (!location) continue;
    features.push({
      type: 'Feature',
      properties: { weight: HEATMAP_SEVERITY_WEIGHT[severityLevel(item.incident_type)] },
      geometry: { type: 'Point', coordinates: [location.longitude, location.latitude] },
    });
  }
  return { type: 'FeatureCollection', features };
}
