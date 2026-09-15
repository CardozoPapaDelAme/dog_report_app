import { validateReportDetails } from "../domain/reportDetailsValidator.js";
import { presentError } from "../presenters/error.js";
import { presentReportReceipt } from "../presenters/report.js";
import { createReport } from "../services/reportService.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INCIDENT_TYPES = new Set([
  "avistamiento_simple",
  "ataque_mascota",
  "ataque_ganado",
  "ataque_humano",
  "perro_lastimado",
  "otro",
]);
const SIGHTING_TYPES = new Set(["solitario", "manada"]);
const DOG_SIZES = new Set(["chico", "mediano", "grande"]);
const RFC3339_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function parseLocation(location) {
  if (
    !isPlainObject(location) ||
    !hasOnlyKeys(location, [
      "longitude",
      "latitude",
      "accuracy_meters",
      "mock_suspected",
    ]) ||
    !finiteNumber(location.longitude) ||
    !finiteNumber(location.latitude) ||
    !finiteNumber(location.accuracy_meters) ||
    typeof location.mock_suspected !== "boolean" ||
    location.longitude < -180 ||
    location.longitude > 180 ||
    location.latitude < -90 ||
    location.latitude > 90 ||
    location.accuracy_meters <= 0 ||
    location.accuracy_meters > 99999.99
  ) {
    return invalid(
      "invalid_coordinates",
      "location must contain valid WGS84 coordinates.",
    );
  }

  return {
    ok: true,
    value: {
      longitude: location.longitude,
      latitude: location.latitude,
      accuracyMeters: location.accuracy_meters,
      mockSuspected: location.mock_suspected,
    },
  };
}

function parseDog(dog) {
  if (dog === undefined) {
    return {
      ok: true,
      value: { predominantColor: null, size: null, hasCollar: null },
    };
  }
  if (
    !isPlainObject(dog) ||
    !hasOnlyKeys(dog, ["predominant_color", "size", "has_collar"])
  ) {
    return invalid(
      "invalid_request",
      "dog must contain only supported fields.",
    );
  }

  const predominantColor = dog.predominant_color ?? null;
  const size = dog.size ?? null;
  const hasCollar = dog.has_collar ?? null;
  if (
    (predominantColor !== null &&
      (typeof predominantColor !== "string" ||
        predominantColor.length < 1 ||
        predominantColor.length > 80)) ||
    (size !== null && !DOG_SIZES.has(size)) ||
    (hasCollar !== null && typeof hasCollar !== "boolean")
  ) {
    return invalid("invalid_request", "dog contains invalid field values.");
  }

  return {
    ok: true,
    value: { predominantColor, size, hasCollar },
  };
}

function parsePhoto(photo) {
  if (photo === undefined) {
    return {
      ok: true,
      value: { expected: false, clientCheckPassed: null },
    };
  }
  if (
    !isPlainObject(photo) ||
    !hasOnlyKeys(photo, ["expected", "client_check_passed"]) ||
    typeof photo.expected !== "boolean"
  ) {
    return invalid(
      "invalid_request",
      "photo must include expected as boolean.",
    );
  }
  const clientCheckPassed = photo.client_check_passed ?? null;
  if (clientCheckPassed !== null && typeof clientCheckPassed !== "boolean") {
    return invalid(
      "invalid_request",
      "photo.client_check_passed must be boolean or null.",
    );
  }
  return {
    ok: true,
    value: { expected: photo.expected, clientCheckPassed },
  };
}

function parseAntiAbuse(antiAbuse) {
  if (
    !isPlainObject(antiAbuse) ||
    !hasOnlyKeys(antiAbuse, ["device_fingerprint", "honeypot_filled"]) ||
    typeof antiAbuse.device_fingerprint !== "string" ||
    antiAbuse.device_fingerprint.length < 16 ||
    typeof antiAbuse.honeypot_filled !== "boolean"
  ) {
    return invalid(
      "invalid_request",
      "anti_abuse must include device_fingerprint and honeypot_filled.",
    );
  }
  return {
    ok: true,
    value: {
      deviceFingerprint: antiAbuse.device_fingerprint,
      honeypotFilled: antiAbuse.honeypot_filled,
    },
  };
}

function parseClientCreatedAt(value) {
  if (typeof value !== "string" || !RFC3339_UTC_PATTERN.test(value)) {
    return invalid(
      "invalid_request",
      "client_created_at must be an RFC 3339 timestamp.",
    );
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return invalid(
      "invalid_request",
      "client_created_at must be an RFC 3339 timestamp.",
    );
  }
  return { ok: true, value: parsed.toISOString() };
}

export function parseCreateReportBody(raw) {
  if (!raw) {
    return invalid("invalid_request", "Request body must be a JSON object.");
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return invalid("invalid_request", "Request body must be valid JSON.");
  }

  if (
    !isPlainObject(body) ||
    !hasOnlyKeys(body, [
      "id",
      "location",
      "incident_type",
      "sighting_type",
      "details",
      "dog",
      "photo",
      "anti_abuse",
      "client_created_at",
    ])
  ) {
    return invalid(
      "invalid_request",
      "Request body contains unsupported fields.",
    );
  }

  if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) {
    return invalid("invalid_request", "id must be a lowercase canonical UUID.");
  }
  if (!INCIDENT_TYPES.has(body.incident_type)) {
    return invalid("invalid_request", "incident_type is not supported.");
  }
  if (!SIGHTING_TYPES.has(body.sighting_type)) {
    return invalid("invalid_request", "sighting_type is not supported.");
  }
  const location = parseLocation(body.location);
  if (!location.ok) {
    return location;
  }
  const details = validateReportDetails({
    incidentType: body.incident_type,
    sightingType: body.sighting_type,
    details: body.details,
  });
  if (!details.ok) {
    return invalid(details.code, details.message);
  }
  const dog = parseDog(body.dog);
  if (!dog.ok) {
    return dog;
  }
  const photo = parsePhoto(body.photo);
  if (!photo.ok) {
    return photo;
  }
  const antiAbuse = parseAntiAbuse(body.anti_abuse);
  if (!antiAbuse.ok) {
    return antiAbuse;
  }
  const clientCreatedAt = parseClientCreatedAt(body.client_created_at);
  if (!clientCreatedAt.ok) {
    return clientCreatedAt;
  }

  return {
    ok: true,
    command: {
      id: body.id,
      location: location.value,
      incidentType: body.incident_type,
      sightingType: body.sighting_type,
      details: body.details,
      dog: dog.value,
      photo: photo.value,
      antiAbuse: { honeypotFilled: antiAbuse.value.honeypotFilled },
      clientCreatedAt: clientCreatedAt.value,
    },
    deviceFingerprint: antiAbuse.value.deviceFingerprint,
  };
}

export async function createReportController(c) {
  const parsed = parseCreateReportBody(await c.req.text());
  if (!parsed.ok) {
    return presentError(c, parsed.status, parsed.code, parsed.message);
  }

  try {
    const receipt = await createReport({
      command: parsed.command,
      deviceFingerprint: parsed.deviceFingerprint,
    });
    return presentReportReceipt(c, receipt);
  } catch (error) {
    if (error?.code === "report_id_payload_conflict") {
      return presentError(
        c,
        409,
        "report_id_payload_conflict",
        "Report id already exists with different content.",
      );
    }
    if (error?.code === "client_created_at_out_of_bounds") {
      return presentError(
        c,
        400,
        "client_created_at_out_of_bounds",
        "client_created_at is outside the allowed submission window.",
      );
    }
    if (error?.code === "outside_geofence") {
      return presentError(
        c,
        400,
        "invalid_coordinates",
        "Location is outside the active Creel geofence.",
      );
    }
    if (error?.code === "invalid_details") {
      return presentError(
        c,
        400,
        "invalid_details",
        "details does not match the incident contract.",
      );
    }
    if (error?.code === "report_rate_limit_exceeded") {
      c.header("Retry-After", String(error.retryAfterSeconds ?? 3600));
      return presentError(
        c,
        429,
        "report_rate_limit_exceeded",
        "Hourly report limit exceeded.",
      );
    }
    if (error?.code === "geofence_not_configured") {
      return presentError(
        c,
        503,
        "geofence_not_configured",
        "Active Creel geofence is missing.",
      );
    }
    if (error?.code === "configuration_unavailable") {
      return presentError(
        c,
        503,
        "configuration_unavailable",
        "Active report configuration is missing.",
      );
    }
    throw error;
  }
}
