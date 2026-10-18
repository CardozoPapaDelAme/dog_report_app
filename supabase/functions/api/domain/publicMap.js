/**
 * @module domain/publicMap
 * Domain constants and helpers for the public map: incident types, severity ranking, list and cluster
 * limits, and the zoom-to-cluster-radius bands. Pure logic with no I/O.
 */
/**
 * Incident type identifiers (stored values, Spanish by design).
 * @type {ReadonlyArray<string>}
 */
export const INCIDENT_TYPES = Object.freeze([
  "avistamiento_simple",
  "ataque_mascota",
  "ataque_ganado",
  "ataque_humano",
  "perro_lastimado",
  "otro",
]);

/**
 * Severity rank per incident type; higher is more severe.
 * @type {Readonly<Record<string, number>>}
 */
export const INCIDENT_SEVERITY = Object.freeze({
  avistamiento_simple: 1,
  otro: 2,
  perro_lastimado: 3,
  ataque_mascota: 4,
  ataque_ganado: 5,
  ataque_humano: 6,
});

export const PUBLIC_REPORT_DEFAULT_LIMIT = 100;
export const PUBLIC_REPORT_MAX_LIMIT = 1000;
export const PUBLIC_CLUSTER_DEFAULT_LIMIT = 2000;
export const PUBLIC_CLUSTER_MAX_LIMIT = 5000;
export const PUBLIC_CLUSTER_MIN_ZOOM = 0;
export const PUBLIC_CLUSTER_MAX_ZOOM = 22;

/**
 * Cluster radius in meters for each inclusive map zoom range. Radii follow the on-screen scale (roughly
 * 20-45 px at Chihuahua's latitude) so low zooms merge nearby clusters instead of drawing them stacked.
 * @type {ReadonlyArray<{min: number, max: number, radiusMeters: number}>}
 */
export const ZOOM_RADIUS_BANDS = Object.freeze([
  { min: 0, max: 2, radiusMeters: 1000000 },
  { min: 3, max: 4, radiusMeters: 200000 },
  { min: 5, max: 6, radiusMeters: 50000 },
  { min: 7, max: 8, radiusMeters: 20000 },
  { min: 9, max: 10, radiusMeters: 5000 },
  { min: 11, max: 12, radiusMeters: 1500 },
  { min: 13, max: 14, radiusMeters: 400 },
  { min: 15, max: 16, radiusMeters: 100 },
  { min: 17, max: 22, radiusMeters: 50 },
]);

/**
 * Validation error raised by public map rules.
 * @property {string} code - Machine-readable error code (for example `invalid_request`).
 * @property {*} details - Optional extra details.
 */
export class PublicMapError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "PublicMapError";
    this.code = code;
    this.details = details;
  }
}

/**
 * @param {number} zoom - Map zoom level.
 * @returns {number} Cluster radius in meters for that zoom.
 * @throws {PublicMapError} `invalid_request` when the zoom falls outside every band.
 */
export function clusterRadiusForZoom(zoom) {
  const band = ZOOM_RADIUS_BANDS.find((candidate) =>
    zoom >= candidate.min && zoom <= candidate.max
  );
  if (!band) {
    throw new PublicMapError(
      "invalid_request",
      "zoom must be an integer from 0 to 22.",
    );
  }
  return band.radiusMeters;
}

/**
 * Produces a count for every known incident type, coercing values to non-negative integers.
 * @param {Record<string, unknown>} [counts] - Raw counts keyed by incident type.
 * @returns {Record<string, number>}
 */
export function normalizeTypeCounts(counts = {}) {
  return INCIDENT_TYPES.reduce((result, type) => {
    const value = Number(counts[type] ?? 0);
    result[type] = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
    return result;
  }, {});
}

/**
 * @param {Record<string, number>} counts - Counts keyed by incident type.
 * @returns {string | null} The most severe incident type with a positive count, or null when none.
 */
export function highestSeverityFromTypeCounts(counts) {
  let selected = null;
  let selectedRank = -Infinity;
  for (const type of INCIDENT_TYPES) {
    if ((counts[type] ?? 0) <= 0) continue;
    const rank = INCIDENT_SEVERITY[type] ?? 0;
    if (rank > selectedRank) {
      selected = type;
      selectedRank = rank;
    }
  }
  return selected;
}
