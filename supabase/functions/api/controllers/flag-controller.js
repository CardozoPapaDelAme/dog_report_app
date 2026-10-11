/**
 * @module controllers/flag-controller
 * HTTP adapter for anonymous report flags: validates the report id and body, then delegates to the
 * flag Service.
 */
import { presentError } from "../presenters/error.js";
import { presentFlagReceipt } from "../presenters/flag.js";
import { submitFlag } from "../services/flag-service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FLAG_REASONS = new Set([
  "foto_falsa",
  "contenido_inapropiado",
  "burla",
  "no_es_callejero",
  "incidental_pii",
  "otro",
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

/** Builds a 400 `invalid_request` parse failure. */
function invalid(message) {
  return { ok: false, status: 400, code: "invalid_request", message };
}

/**
 * Parses and validates a flag request body.
 * @param {string} raw - Raw request body.
 * @returns {{ok: true, command: {reason: string, detail: string | null}, deviceFingerprint: string}
 *   | {ok: false, status: 400, code: 'invalid_request', message: string}}
 */
export function parseFlagBody(raw) {
  if (!raw) {
    return invalid("Request body must be a JSON object.");
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return invalid("Request body must be valid JSON.");
  }

  if (
    !isPlainObject(body) ||
    !hasOnlyKeys(body, ["reason", "detail", "device_fingerprint"])
  ) {
    return invalid("Request body contains unsupported fields.");
  }
  if (!FLAG_REASONS.has(body.reason)) {
    return invalid("reason is not supported.");
  }
  if (
    Object.hasOwn(body, "detail") &&
    (typeof body.detail !== "string" || body.detail.length > 1000)
  ) {
    return invalid("detail must be a string of at most 1000 characters.");
  }
  if (
    typeof body.device_fingerprint !== "string" ||
    body.device_fingerprint.length < 16
  ) {
    return invalid(
      "device_fingerprint must be an opaque string of at least 16 characters.",
    );
  }

  return {
    ok: true,
    command: {
      reason: body.reason,
      detail: Object.hasOwn(body, "detail") ? body.detail : null,
    },
    deviceFingerprint: body.device_fingerprint,
  };
}

/**
 * Maps flag Service errors: 404 `report_not_flaggable`, 409 `flag_already_submitted`, 429
 * `flag_rate_limit_exceeded` (with `Retry-After`), 503 `configuration_unavailable` /
 * `dependency_unavailable`. Other errors are rethrown.
 */
function handleFlagError(c, error) {
  if (error?.code === "report_not_flaggable") {
    return presentError(
      c,
      404,
      "report_not_flaggable",
      "Report is not public, has expired, was not found, or is not canonical.",
    );
  }
  if (error?.code === "flag_already_submitted") {
    return presentError(
      c,
      409,
      "flag_already_submitted",
      "This device has already flagged this report.",
    );
  }
  if (error?.code === "flag_rate_limit_exceeded") {
    c.header("Retry-After", String(error.retryAfterSeconds ?? 3600));
    return presentError(
      c,
      429,
      "flag_rate_limit_exceeded",
      "Hourly flag limit exceeded.",
    );
  }
  if (error?.code === "configuration_unavailable") {
    return presentError(
      c,
      503,
      "configuration_unavailable",
      "Active flag configuration is missing.",
    );
  }
  if (error?.code === "dependency_unavailable") {
    return presentError(
      c,
      503,
      "dependency_unavailable",
      "Flag storage is unavailable.",
    );
  }
  throw error;
}

/**
 * Creates the `POST /reports/:report_id/flags` handler. Responds 201 with the flag receipt, 400
 * `invalid_request`, or the statuses from the flag Service error mapping.
 * @param {typeof import('../services/flag-service.js').submitFlag} [service] - Flag submission function.
 * @returns {(c: import('hono').Context) => Promise<Response>}
 */
export function createFlagController(service = submitFlag) {
  return async function flagController(c) {
    const reportId = c.req.param("report_id");
    if (!UUID_PATTERN.test(reportId)) {
      return presentError(
        c,
        400,
        "invalid_request",
        "report_id must be a lowercase canonical UUID.",
      );
    }

    const parsed = parseFlagBody(await c.req.text());
    if (!parsed.ok) {
      return presentError(c, parsed.status, parsed.code, parsed.message);
    }

    try {
      const receipt = await service({
        reportId,
        command: parsed.command,
        deviceFingerprint: parsed.deviceFingerprint,
      });
      return presentFlagReceipt(c, receipt);
    } catch (error) {
      return handleFlagError(c, error);
    }
  };
}

/** Production flag handler. */
export const flagController = createFlagController();
