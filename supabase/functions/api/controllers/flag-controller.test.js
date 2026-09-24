import { Hono } from "hono";
import { app as actualApp } from "../app.js";
import { requestId } from "../middleware/requestId.js";
import { createFlagController, parseFlagBody } from "./flag-controller.js";

const reportId = "11111111-2222-4333-8444-555555555555";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function body(overrides = {}) {
  return {
    reason: "contenido_inapropiado",
    detail: "Contains private details",
    device_fingerprint: "  raw-device-fingerprint-001  ",
    ...overrides,
  };
}

Deno.test("flag parser preserves the raw device fingerprint", () => {
  const parsed = parseFlagBody(JSON.stringify(body()));
  assert(parsed.ok, "valid flag body should parse");
  assert(
    parsed.deviceFingerprint === "  raw-device-fingerprint-001  ",
    "raw fingerprint must remain byte-for-byte as submitted",
  );
  assert(parsed.command.detail === "Contains private details");
});

Deno.test("flag parser rejects unknown fields and unsupported values", () => {
  for (
    const candidate of [
      { ...body(), status: "hidden" },
      { ...body(), reason: "spam" },
      { ...body(), detail: "x".repeat(1001) },
      { ...body(), device_fingerprint: "too-short" },
      [],
      null,
    ]
  ) {
    const parsed = parseFlagBody(JSON.stringify(candidate));
    assert(
      !parsed.ok && parsed.code === "invalid_request",
      "invalid body should fail",
    );
  }
});

Deno.test("flag controller returns the flag receipt and passes validated values", async () => {
  const calls = [];
  const app = new Hono();
  app.use("*", requestId);
  app.post(
    "/reports/:report_id/flags",
    createFlagController(async (input) => {
      calls.push(input);
      return {
        flagId: "00000000-0000-4000-8000-000000000123",
        reportStatus: "visible",
      };
    }),
  );

  const response = await app.request(`/reports/${reportId}/flags`, {
    method: "POST",
    body: JSON.stringify(body()),
  });
  const payload = await response.json();

  assert(response.status === 201, JSON.stringify(payload));
  assert(payload.data.flag_id.endsWith("123"), "Flag id should be presented.");
  assert(
    payload.data.report_status === "visible",
    "Report status should be presented.",
  );
  assert(
    calls.length === 1 && calls[0].reportId === reportId,
    "Controller should call service once.",
  );
  assert(
    calls[0].deviceFingerprint === body().device_fingerprint,
    "Controller must pass the raw fingerprint.",
  );
  assert(response.headers.has("X-Request-Id"), "Request id header required.");
});

Deno.test("flag controller maps service errors without leaking internals", async () => {
  for (
    const [code, status] of [
      ["report_not_flaggable", 404],
      ["flag_already_submitted", 409],
      ["flag_rate_limit_exceeded", 429],
      ["configuration_unavailable", 503],
      ["dependency_unavailable", 503],
    ]
  ) {
    const app = new Hono();
    app.post(
      "/reports/:report_id/flags",
      createFlagController(() => {
        const error = new Error("private SQL text");
        error.code = code;
        error.retryAfterSeconds = 123;
        throw error;
      }),
    );
    const response = await app.request(`/reports/${reportId}/flags`, {
      method: "POST",
      body: JSON.stringify(body()),
    });
    const payload = await response.json();
    assert(response.status === status, `${code} should map to ${status}`);
    assert(payload.error.code === code, `Expected ${code}`);
    assert(
      !JSON.stringify(payload).includes("private SQL"),
      "Private error text must not leak.",
    );
    if (code === "flag_rate_limit_exceeded") {
      assert(
        response.headers.get("Retry-After") === "123",
        "Retry-After required.",
      );
    }
  }
});

Deno.test("flag route is mounted at the canonical application /api path", async () => {
  const response = await actualApp.request(`/api/reports/${reportId}/flags`, {
    method: "POST",
    body: "{",
  });
  const body = await response.json();

  assert(
    response.status === 400,
    "Mounted route should parse and reject malformed JSON.",
  );
  assert(
    body.error.code === "invalid_request",
    "Malformed body should be invalid_request.",
  );
  assert(
    response.headers.has("X-Request-Id"),
    "Request id must survive app mounting.",
  );
  assert(
    (await actualApp.request(`/reports/${reportId}/flags`, { method: "POST" }))
      .status === 404,
    "Unprefixed app path should remain outside the /api base path.",
  );
});
