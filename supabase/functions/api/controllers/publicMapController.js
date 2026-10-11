/**
 * @module controllers/publicMapController
 * HTTP adapter for the anonymous public map: strict query parsing for reports and clusters.
 */
import {
  PUBLIC_CLUSTER_DEFAULT_LIMIT,
  PUBLIC_CLUSTER_MAX_LIMIT,
  PUBLIC_CLUSTER_MAX_ZOOM,
  PUBLIC_CLUSTER_MIN_ZOOM,
  PUBLIC_REPORT_DEFAULT_LIMIT,
  PUBLIC_REPORT_MAX_LIMIT,
  PublicMapError,
} from "../domain/publicMap.js";
import { presentError } from "../presenters/error.js";
import {
  presentPublicClusters,
  presentPublicReports,
} from "../presenters/publicMap.js";
import { publicMapService } from "../services/publicMapService.js";

const REPORT_QUERY_KEYS = new Set(["since", "limit"]);
const CLUSTER_QUERY_KEYS = new Set([
  "zoom",
  "min_longitude",
  "min_latitude",
  "max_longitude",
  "max_latitude",
  "limit",
]);

function invalid(message) {
  return { ok: false, message };
}

/** Returns an `invalid_request` failure for the first unsupported query key, otherwise null. */
function rejectUnknownQuery(query, allowed) {
  const unknown = Object.keys(query).find((key) => !allowed.has(key));
  return unknown ? invalid(`${unknown} is not a supported query parameter.`) : null;
}

/** Parses a decimal limit within `1..maxLimit`; default when absent, null when invalid. */
function parseLimit(value, defaultLimit, maxLimit) {
  if (value === undefined || value === "") return defaultLimit;
  if (!/^\d+$/.test(value)) return null;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= maxLimit
    ? limit
    : null;
}

/** Parses an RFC 3339 timestamp with a timezone; null when absent, undefined when invalid. */
function parseTimestamp(value) {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Parses an integer zoom within the supported range; null when absent or invalid. */
function parseZoom(value) {
  if (value === undefined || value === "" || !/^\d+$/.test(value)) return null;
  const zoom = Number(value);
  return Number.isSafeInteger(zoom) &&
      zoom >= PUBLIC_CLUSTER_MIN_ZOOM &&
      zoom <= PUBLIC_CLUSTER_MAX_ZOOM
    ? zoom
    : null;
}

function parseCoordinate(value) {
  if (value === undefined || value === "") return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function inRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * Parses the optional viewport. All four bounds must be given together and form valid WGS84 bounds
 * with min strictly below max.
 * @returns {{ok: true, viewport: {minLongitude: number, minLatitude: number, maxLongitude: number, maxLatitude: number} | null}
 *   | {ok: false, message: string}}
 */
function parseViewport(query) {
  const keys = ["min_longitude", "min_latitude", "max_longitude", "max_latitude"];
  const present = keys.filter((key) => query[key] !== undefined && query[key] !== "");
  if (present.length === 0) return { ok: true, viewport: null };
  if (present.length !== keys.length) {
    return invalid("viewport parameters must be supplied together or omitted.");
  }

  const minLongitude = parseCoordinate(query.min_longitude);
  const minLatitude = parseCoordinate(query.min_latitude);
  const maxLongitude = parseCoordinate(query.max_longitude);
  const maxLatitude = parseCoordinate(query.max_latitude);
  if (
    minLongitude === null ||
    minLatitude === null ||
    maxLongitude === null ||
    maxLatitude === null ||
    !inRange(minLongitude, -180, 180) ||
    !inRange(maxLongitude, -180, 180) ||
    !inRange(minLatitude, -90, 90) ||
    !inRange(maxLatitude, -90, 90) ||
    minLongitude >= maxLongitude ||
    minLatitude >= maxLatitude
  ) {
    return invalid("viewport must contain valid WGS84 bounds.");
  }

  return {
    ok: true,
    viewport: { minLongitude, minLatitude, maxLongitude, maxLatitude },
  };
}

/**
 * Validates the `GET /public/reports` query (`since`, `limit`).
 * @param {Record<string, string>} query - Query parameters.
 * @returns {{ok: true, value: {since: string | null, limit: number}} | {ok: false, message: string}}
 */
export function parsePublicReportsQuery(query) {
  const unknown = rejectUnknownQuery(query, REPORT_QUERY_KEYS);
  if (unknown) return unknown;

  const limit = parseLimit(
    query.limit,
    PUBLIC_REPORT_DEFAULT_LIMIT,
    PUBLIC_REPORT_MAX_LIMIT,
  );
  const since = parseTimestamp(query.since);
  if (limit === null) {
    return invalid("limit must be an integer from 1 to 1000.");
  }
  if (since === undefined) {
    return invalid("since must be an RFC 3339 timestamp with a timezone.");
  }
  return { ok: true, value: { since, limit } };
}

/**
 * Validates the `GET /public/clusters` query (`zoom`, optional viewport bounds, `limit`).
 * @param {Record<string, string>} query - Query parameters.
 * @returns {{ok: true, value: {zoom: number, limit: number, viewport: object | null}} | {ok: false, message: string}}
 */
export function parsePublicClustersQuery(query) {
  const unknown = rejectUnknownQuery(query, CLUSTER_QUERY_KEYS);
  if (unknown) return unknown;

  const zoom = parseZoom(query.zoom);
  const limit = parseLimit(
    query.limit,
    PUBLIC_CLUSTER_DEFAULT_LIMIT,
    PUBLIC_CLUSTER_MAX_LIMIT,
  );
  const parsedViewport = parseViewport(query);
  if (zoom === null) {
    return invalid("zoom must be an integer from 0 to 22.");
  }
  if (limit === null) {
    return invalid("limit must be an integer from 1 to 5000.");
  }
  if (!parsedViewport.ok) return parsedViewport;

  return { ok: true, value: { zoom, limit, viewport: parsedViewport.viewport } };
}

function queryObject(c) {
  return Object.fromEntries(new URL(c.req.url).searchParams);
}

/** Maps `PublicMapError` `invalid_request` to 400 and `database_unavailable` to 503; rethrows others. */
function handlePublicMapError(c, error) {
  if (error instanceof PublicMapError && error.code === "invalid_request") {
    return presentError(c, 400, error.code, error.message, error.details);
  }
  if (error instanceof PublicMapError && error.code === "database_unavailable") {
    return presentError(c, 503, error.code, error.message, error.details);
  }
  throw error;
}

/**
 * Creates the public map Controller. `reports` and `clusters` respond 200, 400 `invalid_request`, or
 * 503 `database_unavailable`. Unmapped errors are rethrown.
 * @param {ReturnType<typeof import('../services/publicMapService.js').createPublicMapService>} [service]
 *   Public map Service.
 * @returns {{reports: (c: import('hono').Context) => Promise<Response>, clusters: (c: import('hono').Context) => Promise<Response>}}
 */
export function createPublicMapController(service = publicMapService) {
  return {
    async reports(c) {
      const parsed = parsePublicReportsQuery(queryObject(c));
      if (!parsed.ok) {
        return presentError(c, 400, "invalid_request", parsed.message);
      }
      try {
        return presentPublicReports(c, await service.listReports(parsed.value));
      } catch (error) {
        return handlePublicMapError(c, error);
      }
    },
    async clusters(c) {
      const parsed = parsePublicClustersQuery(queryObject(c));
      if (!parsed.ok) {
        return presentError(c, 400, "invalid_request", parsed.message);
      }
      try {
        return presentPublicClusters(c, await service.listClusters(parsed.value));
      } catch (error) {
        return handlePublicMapError(c, error);
      }
    },
  };
}

/** Production public map Controller. */
export const publicMapController = createPublicMapController();
