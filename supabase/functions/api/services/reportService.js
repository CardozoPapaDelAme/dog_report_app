import { getSql } from "../infrastructure/db.js";
import {
  checkActiveCreelGeofence,
  consumeReportRateLimit,
  findReportById,
  getActiveReportConfig,
  getCurrentReportRateBucket,
  insertReport,
  lockReportIdentity,
} from "../repositories/reportRepository.js";
import { assessReportTrust } from "./trustService.js";

const CLIENT_CREATED_AT_PAST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CLIENT_CREATED_AT_FUTURE_WINDOW_MS = 60 * 60 * 1000;

function serviceError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function reportSubmissionPayload(command) {
  return {
    location: command.location,
    incident_type: command.incidentType,
    sighting_type: command.sightingType,
    details: command.details,
    dog: command.dog,
    photo: command.photo,
    anti_abuse: {
      honeypot_filled: command.antiAbuse.honeypotFilled,
    },
    client_created_at: command.clientCreatedAt,
  };
}

export async function reportSubmissionHash(command) {
  return sha256Hex(
    JSON.stringify(canonicalize(reportSubmissionPayload(command))),
  );
}

export function clientCreatedAtIsInBounds(clientCreatedAt, serverNow) {
  const clientMs = new Date(clientCreatedAt).getTime();
  const serverMs = new Date(serverNow).getTime();
  return (
    Number.isFinite(clientMs) &&
    Number.isFinite(serverMs) &&
    clientMs >= serverMs - CLIENT_CREATED_AT_PAST_WINDOW_MS &&
    clientMs <= serverMs + CLIENT_CREATED_AT_FUTURE_WINDOW_MS
  );
}

export function secondsUntilNextHour(serverNow) {
  const now = new Date(serverNow);
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function receiptFromRow(row, replayed) {
  return {
    reportId: row.id,
    moderationStatus: row.status,
    photoExpected: row.photo_expected,
    replayed,
  };
}

function mapPersistenceError(error) {
  if (error?.code === "23505") {
    return serviceError(
      "report_id_payload_conflict",
      "report id already exists with different content.",
    );
  }
  if (
    error?.code === "22023" && String(error.message ?? "").includes("invalid_")
  ) {
    return serviceError(
      "invalid_details",
      "Report details do not match the incident contract.",
    );
  }
  return error;
}

const productionDependencies = {
  getSql,
  lockReportIdentity,
  findReportById,
  getActiveReportConfig,
  checkActiveCreelGeofence,
  consumeReportRateLimit,
  getCurrentReportRateBucket,
  assessReportTrust,
  insertReport,
};

export async function createReport(
  { command, deviceFingerprint },
  dependencies = productionDependencies,
) {
  const originHash = await sha256Hex(deviceFingerprint);
  const submissionHash = await reportSubmissionHash(command);
  const sql = dependencies.getSql();

  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', '', true)`;
      await tx`SELECT set_config('app.role', 'anonymous', true)`;
      await tx`SELECT set_config('app.origin_hash', ${originHash}, true)`;
      await tx`SELECT set_config('app.report_id', ${command.id}, true)`;
      await dependencies.lockReportIdentity(tx, command.id);

      const existing = await dependencies.findReportById(tx, command.id);
      if (existing) {
        if (existing.submission_hash === submissionHash) {
          return receiptFromRow(existing, true);
        }
        throw serviceError(
          "report_id_payload_conflict",
          "report id already exists with different content.",
        );
      }

      const config = await dependencies.getActiveReportConfig(tx);
      if (!config) {
        throw serviceError(
          "configuration_unavailable",
          "Active report configuration is missing.",
        );
      }
      if (
        !clientCreatedAtIsInBounds(command.clientCreatedAt, config.server_now)
      ) {
        throw serviceError(
          "client_created_at_out_of_bounds",
          "client_created_at is outside the allowed submission window.",
        );
      }

      const geofence = await dependencies.checkActiveCreelGeofence(
        tx,
        command.location,
      );
      if (!geofence.configured) {
        throw serviceError(
          "geofence_not_configured",
          "Active Creel geofence is missing.",
        );
      }
      if (!geofence.contains) {
        throw serviceError(
          "outside_geofence",
          "Location is outside the active Creel geofence.",
        );
      }

      const allowed = await dependencies.consumeReportRateLimit(tx, {
        originHash,
        limit: config.report_rate_limit_per_hour,
      });
      if (!allowed) {
        throw serviceError(
          "report_rate_limit_exceeded",
          "Hourly report limit exceeded.",
          {
            retryAfterSeconds: secondsUntilNextHour(config.server_now),
          },
        );
      }

      const bucket = await dependencies.getCurrentReportRateBucket(
        tx,
        originHash,
      );
      const trust = dependencies.assessReportTrust({
        command,
        config,
        rateBucketCount: bucket?.request_count,
      });
      const inserted = await dependencies.insertReport(tx, {
        command,
        submissionHash,
        originHash,
        config,
        trust,
      });
      return receiptFromRow(inserted, false);
    });
  } catch (error) {
    throw mapPersistenceError(error);
  }
}
