import {
  clusterRadiusForZoom,
  highestSeverityFromTypeCounts,
  normalizeTypeCounts,
  PublicMapError,
  PUBLIC_CLUSTER_DEFAULT_LIMIT,
  PUBLIC_CLUSTER_MAX_LIMIT,
  PUBLIC_REPORT_DEFAULT_LIMIT,
  PUBLIC_REPORT_MAX_LIMIT,
} from "../domain/publicMap.js";
import { getSql } from "../infrastructure/db.js";
import * as repository from "../repositories/publicMapRepository.js";

function serviceError(code, message, details) {
  return new PublicMapError(code, message, details);
}

function boundedLimit(value, defaultLimit, maxLimit) {
  const candidate = value ?? defaultLimit;
  if (!Number.isSafeInteger(candidate) || candidate < 1) {
    throw serviceError("invalid_request", "limit must be a positive integer.");
  }
  return Math.min(candidate, maxLimit);
}

function mapPersistenceError(error) {
  if (
    [
      "CONNECTION_CLOSED",
      "CONNECTION_ENDED",
      "CONNECT_TIMEOUT",
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
      "57P01",
      "57P02",
      "57P03",
    ].includes(error?.code) || error?.code?.startsWith("08")
  ) {
    return serviceError("database_unavailable", "Postgres is not reachable.");
  }
  return error;
}

function mapReport(row) {
  return {
    reportId: row.report_id,
    approximateLocation: {
      longitude: Number(row.approximate_longitude),
      latitude: Number(row.approximate_latitude),
    },
    incidentType: row.incident_type,
    sightingType: row.sighting_type,
    details: row.details,
    dog: {
      predominantColor: row.color_predominante,
      size: row.tamano,
      hasCollar: row.tiene_collar,
    },
    hasSanitizedPhoto: row.has_sanitized_photo === true,
    occurredAt: row.occurred_at,
    hasFlags: row.has_flags === true,
  };
}

function mapCluster(row) {
  const typeCounts = normalizeTypeCounts({
    avistamiento_simple: row.count_avistamiento_simple,
    ataque_mascota: row.count_ataque_mascota,
    ataque_ganado: row.count_ataque_ganado,
    ataque_humano: row.count_ataque_humano,
    perro_lastimado: row.count_perro_lastimado,
    otro: row.count_otro,
  });

  return {
    clusterId: row.cluster_id,
    reportCount: Number(row.report_count),
    approximateLocation: {
      longitude: Number(row.approximate_longitude),
      latitude: Number(row.approximate_latitude),
    },
    highestSeverity: highestSeverityFromTypeCounts(typeCounts),
    typeCounts,
  };
}

export function createPublicMapService(dependencies = {}) {
  const deps = { getSql, repository, ...dependencies };

  async function inAnonymousTransaction(operation) {
    try {
      return await deps.getSql().begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', '', true)`;
        await tx`SELECT set_config('app.role', 'anonymous', true)`;
        return operation(tx);
      });
    } catch (error) {
      throw mapPersistenceError(error);
    }
  }

  return {
    listReports({ since = null, limit } = {}) {
      const safeLimit = boundedLimit(
        limit,
        PUBLIC_REPORT_DEFAULT_LIMIT,
        PUBLIC_REPORT_MAX_LIMIT,
      );
      return inAnonymousTransaction(async (tx) => {
        const rows = await deps.repository.listPublicReports(tx, {
          since,
          limit: safeLimit,
        });
        return rows.map(mapReport);
      });
    },
    listClusters({ zoom, viewport = null, limit } = {}) {
      const radiusMeters = clusterRadiusForZoom(zoom);
      const safeLimit = boundedLimit(
        limit,
        PUBLIC_CLUSTER_DEFAULT_LIMIT,
        PUBLIC_CLUSTER_MAX_LIMIT,
      );
      return inAnonymousTransaction(async (tx) => {
        const rows = await deps.repository.listPublicClusters(tx, {
          zoom,
          radiusMeters,
          viewport,
          limit: safeLimit,
        });
        return rows.map(mapCluster);
      });
    },
  };
}

export const publicMapService = createPublicMapService();
