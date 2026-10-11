/**
 * @module services/reportService
 * Anonymous report submission. Submissions are idempotent by report id and content hash, bounded in
 * time, checked against the active geofence and hourly rate limit, scored by the trust Service, and
 * stored in a transaction scoped to the device origin hash.
 */
import { getSql } from "../infrastructure/db.js";
import { getConfig } from "../infrastructure/config.js";
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

/**
 * @typedef {object} ReportCommand
 * @property {string} id - Client-generated lowercase UUID.
 * @property {{longitude: number, latitude: number, accuracyMeters: number, mockSuspected: boolean}} location
 * @property {string} incidentType
 * @property {string} sightingType
 * @property {*} details - Incident-specific details, validated by `domain/reportDetailsValidator.js`.
 * @property {{predominantColor: string | null, size: string | null, hasCollar: boolean | null}} dog
 * @property {{expected: boolean, clientCheckPassed: boolean | null}} photo
 * @property {{honeypotFilled: boolean}} antiAbuse
 * @property {string} clientCreatedAt - ISO 8601 UTC timestamp.
 */
/** Maximum age of `client_created_at` relative to the database time (30 days). */
const CLIENT_CREATED_AT_PAST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Maximum `client_created_at` lead over the database time (1 hour). */
const CLIENT_CREATED_AT_FUTURE_WINDOW_MS = 60 * 60 * 1000;

/** Creates an `Error` carrying `code` and any extra `details` properties. */
function serviceError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

/** Builds client-safe `details` and log-only `logDetails` (with a truncated SQL message). */
function sqlDiagnostics(error, category) {
  const sqlCode = typeof error?.code === "string" && error.code
    ? error.code
    : "unknown";
  return {
    details: {
      category,
      sql_code: sqlCode,
    },
    logDetails: {
      category,
      sql_code: sqlCode,
      sql_message: String(error?.message ?? "").slice(0, 500),
    },
  };
}

/** Recursively sorts object keys so equal payloads serialize identically. */
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

/**
 * Hashes a string with SHA-256.
 * @param {string} value - UTF-8 input.
 * @returns {Promise<string>} Lowercase hexadecimal digest.
 */
export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Builds the snake_case payload whose hash identifies a submission (excludes the device fingerprint).
 * @param {ReportCommand} command - Validated report command.
 * @returns {object}
 */
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

/**
 * Hashes the canonicalized submission payload, used to detect idempotent replays.
 * @param {ReportCommand} command - Validated report command.
 * @returns {Promise<string>} Lowercase hexadecimal SHA-256.
 */
export async function reportSubmissionHash(command) {
  return sha256Hex(
    JSON.stringify(canonicalize(reportSubmissionPayload(command))),
  );
}

/**
 * Checks that the client timestamp is at most 30 days in the past and 1 hour in the future.
 * @param {string} clientCreatedAt - Client timestamp.
 * @param {Date | string} serverNow - Database time.
 * @returns {boolean}
 */
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

/**
 * Seconds until the next UTC hour boundary, used for `Retry-After`.
 * @param {Date | string} serverNow - Database time.
 * @returns {number} At least 1.
 */
export function secondsUntilNextHour(serverNow) {
  const now = new Date(serverNow);
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

/** Maps a stored report row to the submission receipt. */
function receiptFromRow(row, replayed) {
  return {
    reportId: row.id,
    moderationStatus: row.status,
    photoExpected: row.photo_expected,
    replayed,
  };
}

/**
 * Maps storage errors: unique violations to `report_id_payload_conflict`, details trigger rejections to
 * `invalid_details`, connection failures to `database_unavailable`, and rate-limit context, missing
 * secret, schema, or privilege errors to `preflight_mismatch`. Other errors pass through.
 */
function mapPersistenceError(error) {
  if (error?.code === "23505") {
    return serviceError(
      "report_id_payload_conflict",
      "report id already exists with different content.",
    );
  }
  const message = String(error?.message ?? "");
  if (error?.code === "22023" && message.startsWith("invalid_rate_limit_")) {
    return serviceError(
      "preflight_mismatch",
      "Report rate-limit context does not match the API.",
      sqlDiagnostics(error, "rate_limit_context"),
    );
  }
  if (
    error?.code === "22023" &&
    [
      "invalid_details_object",
      "invalid_sighting_count",
      "invalid_solitary_count",
      "invalid_pack_count",
      "invalid_resulto_herido",
      "invalid_livestock_count",
      "invalid_injury_situation",
      "invalid_description",
      "unexpected_details_key",
      "missing_hubo_mordida",
      "missing_pet_type",
      "missing_livestock_type",
    ].includes(message)
  ) {
    return serviceError(
      "invalid_details",
      "Report details do not match the incident contract.",
      {
        details: {
          category: "report_details_trigger",
          reason: message,
        },
        logDetails: {
          category: "report_details_trigger",
          sql_code: error.code,
          sql_message: message,
        },
      },
    );
  }
  if (String(error?.message ?? "").includes("APP_BACKEND_DATABASE_URL")) {
    return serviceError(
      "preflight_mismatch",
      "Report database connection is not configured.",
      {
        details: { category: "database_secret_missing" },
        logDetails: { category: "database_secret_missing" },
      },
    );
  }
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
    return serviceError(
      "database_unavailable",
      "Report database is unavailable.",
      sqlDiagnostics(error, "database_connection"),
    );
  }
  if (
    [
      "22003",
      "22P02",
      "23502",
      "23503",
      "23514",
      "42501",
      "42704",
      "42804",
      "42P01",
      "42703",
      "42883",
      "3F000",
    ].includes(error?.code)
  ) {
    return serviceError(
      "preflight_mismatch",
      "Report storage permissions or migrations do not match the API.",
      sqlDiagnostics(error, "schema_or_privilege_mismatch"),
    );
  }
  return error;
}

const productionDependencies = {
  getConfig,
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

/** True when configuration explicitly allows reports while no geofence is active. */
function allowsMissingActiveGeofence(dependencies) {
  return dependencies.getConfig?.().allowReportsWithoutActiveGeofence === true;
}

/**
 * Creates a report, or returns the existing receipt when the same id is replayed with identical content.
 * @param {object} options
 * @param {ReportCommand} options.command - Validated report command.
 * @param {string} options.deviceFingerprint - Opaque device fingerprint; only its SHA-256 is stored.
 * @param {object} [dependencies] - Repository, configuration, and trust overrides (tests).
 * @returns {Promise<{reportId: string, moderationStatus: string, photoExpected: boolean, replayed: boolean}>}
 * @throws {Error} With `code` `report_id_payload_conflict`, `configuration_unavailable`,
 *   `client_created_at_out_of_bounds`, `geofence_not_configured`, `outside_geofence`,
 *   `report_rate_limit_exceeded` (with `retryAfterSeconds`), `invalid_details`, `database_unavailable`,
 *   or `preflight_mismatch`. Unknown errors propagate unchanged.
 */
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
        if (!allowsMissingActiveGeofence(dependencies)) {
          throw serviceError(
            "geofence_not_configured",
            "Active Creel geofence is missing.",
          );
        }
      } else if (!geofence.contains) {
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
