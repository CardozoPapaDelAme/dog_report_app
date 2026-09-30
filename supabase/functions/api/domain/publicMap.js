export const INCIDENT_TYPES = Object.freeze([
  "avistamiento_simple",
  "ataque_mascota",
  "ataque_ganado",
  "ataque_humano",
  "perro_lastimado",
  "otro",
]);

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

export const ZOOM_RADIUS_BANDS = Object.freeze([
  { min: 0, max: 8, radiusMeters: 1000 },
  { min: 9, max: 11, radiusMeters: 500 },
  { min: 12, max: 14, radiusMeters: 250 },
  { min: 15, max: 16, radiusMeters: 100 },
  { min: 17, max: 22, radiusMeters: 50 },
]);

export class PublicMapError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "PublicMapError";
    this.code = code;
    this.details = details;
  }
}

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

export function normalizeTypeCounts(counts = {}) {
  return INCIDENT_TYPES.reduce((result, type) => {
    const value = Number(counts[type] ?? 0);
    result[type] = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
    return result;
  }, {});
}

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
