import {
  createReportErrorResponse,
  parseCreateReportBody,
} from "./reportController.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function body(overrides = {}) {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    location: {
      longitude: -107.63,
      latitude: 27.75,
      accuracy_meters: 12.5,
      mock_suspected: false,
    },
    incident_type: "avistamiento_simple",
    sighting_type: "solitario",
    details: { cantidad_aprox: 1, descripcion: "Cerca de la plaza" },
    dog: { predominant_color: "cafe", size: "mediano", has_collar: null },
    photo: { expected: false, client_check_passed: null },
    anti_abuse: {
      device_fingerprint: "  raw-device-fingerprint-001  ",
      honeypot_filled: false,
    },
    client_created_at: "2026-09-07T20:00:00Z",
    ...overrides,
  };
}

Deno.test("report parser passes the raw device fingerprint separately without trimming it", () => {
  const parsed = parseCreateReportBody(JSON.stringify(body()));
  assert(parsed.ok, "valid body should parse");
  assert(
    parsed.deviceFingerprint === "  raw-device-fingerprint-001  ",
    "device fingerprint must remain byte-for-byte as submitted",
  );
  assert(
    parsed.command.antiAbuse.deviceFingerprint === undefined,
    "raw fingerprint must not be mixed into the report command payload",
  );
});

Deno.test("report parser rejects unsupported fields before service work", () => {
  const parsed = parseCreateReportBody(
    JSON.stringify(body({ moderation_status: "visible" })),
  );
  assert(!parsed.ok, "unknown top-level fields should be rejected");
  assert(
    parsed.code === "invalid_request",
    "unknown fields map to invalid_request",
  );
});

Deno.test("report parser rejects dynamic details that do not match the incident contract", () => {
  const parsed = parseCreateReportBody(
    JSON.stringify(
      body({ sighting_type: "manada", details: { cantidad_aprox: 1 } }),
    ),
  );
  assert(!parsed.ok, "invalid dynamic details should be rejected");
  assert(
    parsed.code === "invalid_details",
    "dynamic detail failures map to invalid_details",
  );
});

Deno.test("report parser rejects non-UTC client timestamps", () => {
  const parsed = parseCreateReportBody(
    JSON.stringify(body({ client_created_at: "2026-09-07" })),
  );
  assert(!parsed.ok, "date-only timestamps should be rejected");
  assert(
    parsed.code === "invalid_request",
    "timestamp syntax failures map to invalid_request",
  );
});

Deno.test("report controller maps operational report failures before generic 500", () => {
  const database = createReportErrorResponse({ code: "database_unavailable" });
  assert(database.status === 503, "database failures should be retryable 503s");
  assert(database.code === "database_unavailable");

  const preflight = createReportErrorResponse({
    code: "preflight_mismatch",
    details: { category: "schema_or_privilege_mismatch", sql_code: "42883" },
  });
  assert(preflight.status === 503, "deploy mismatches should be retryable 503s");
  assert(preflight.code === "preflight_mismatch");
  assert(preflight.details.sql_code === "42883");

  const rateLimit = createReportErrorResponse({
    code: "report_rate_limit_exceeded",
    retryAfterSeconds: 42,
  });
  assert(rateLimit.status === 429);
  assert(rateLimit.retryAfterSeconds === 42);

  const invalidDetails = createReportErrorResponse({
    code: "invalid_details",
    details: {
      category: "report_details_trigger",
      reason: "unexpected_details_key",
    },
  });
  assert(invalidDetails.status === 400);
  assert(invalidDetails.details.reason === "unexpected_details_key");

  assert(
    createReportErrorResponse({ code: "unexpected_failure" }) === null,
    "unknown programming errors must still reach the generic handler",
  );
});
