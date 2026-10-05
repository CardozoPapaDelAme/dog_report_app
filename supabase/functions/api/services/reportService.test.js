import {
  clientCreatedAtIsInBounds,
  createReport,
  reportSubmissionHash,
  reportSubmissionPayload,
  secondsUntilNextHour,
  sha256Hex,
} from "./reportService.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function command(overrides = {}) {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    location: {
      longitude: -107.63,
      latitude: 27.75,
      accuracyMeters: 12.5,
      mockSuspected: false,
    },
    incidentType: "ataque_mascota",
    sightingType: "solitario",
    details: {
      descripcion: "Patio del hotel",
      resulto_herido: true,
      tipo_animal: "gato",
    },
    dog: { predominantColor: "cafe", size: "mediano", hasCollar: null },
    photo: { expected: false, clientCheckPassed: null },
    antiAbuse: { honeypotFilled: false },
    clientCreatedAt: "2026-09-07T20:00:00.000Z",
    ...overrides,
  };
}

function fakeTransaction(calls) {
  return async function tx(strings, ...values) {
    calls.push({
      type: "sql",
      text: strings.join("?"),
      values,
    });
    return [];
  };
}

function replayDependencies({ existing, calls }) {
  const dependencies = {
    getSql: () => ({
      begin: (operation) => operation(fakeTransaction(calls)),
    }),
    lockReportIdentity: () => calls.push({ type: "lock" }),
    findReportById: () => {
      calls.push({ type: "findReportById" });
      return existing;
    },
    getActiveReportConfig: () => {
      calls.push({ type: "getActiveReportConfig" });
      throw new Error("replay should not load active config");
    },
    checkActiveCreelGeofence: () => {
      calls.push({ type: "checkActiveCreelGeofence" });
      throw new Error("replay should not check geofence");
    },
    consumeReportRateLimit: () => {
      calls.push({ type: "consumeReportRateLimit" });
      throw new Error("replay should not consume rate limit");
    },
    getCurrentReportRateBucket: () => {
      calls.push({ type: "getCurrentReportRateBucket" });
      throw new Error("replay should not read rate bucket");
    },
    assessReportTrust: () => {
      calls.push({ type: "assessReportTrust" });
      throw new Error("replay should not assess trust");
    },
    insertReport: () => {
      calls.push({ type: "insertReport" });
      throw new Error("replay should not insert a report");
    },
  };
  return dependencies;
}

function newReportDependencies({ calls, geofence, allowMissingGeofence = false }) {
  return {
    getConfig: () => ({
      allowReportsWithoutActiveGeofence: allowMissingGeofence,
    }),
    getSql: () => ({
      begin: (operation) => operation(fakeTransaction(calls)),
    }),
    lockReportIdentity: () => calls.push({ type: "lock" }),
    findReportById: () => {
      calls.push({ type: "findReportById" });
      return null;
    },
    getActiveReportConfig: () => {
      calls.push({ type: "getActiveReportConfig" });
      return {
        id: "22222222-3333-4444-8555-666666666666",
        trust_high_threshold: "0.800",
        trust_medium_threshold: "0.500",
        gps_accuracy_max_meters: 50,
        report_rate_limit_per_hour: 10,
        fingerprint_retention_days: 30,
        public_retention_days: 90,
        server_now: "2026-09-07T20:00:00.000Z",
      };
    },
    checkActiveCreelGeofence: () => {
      calls.push({ type: "checkActiveCreelGeofence" });
      return geofence;
    },
    consumeReportRateLimit: () => {
      calls.push({ type: "consumeReportRateLimit" });
      return true;
    },
    getCurrentReportRateBucket: () => {
      calls.push({ type: "getCurrentReportRateBucket" });
      return { request_count: 1 };
    },
    assessReportTrust: () => {
      calls.push({ type: "assessReportTrust" });
      return {
        status: "pending_review",
        statusReason: "medium_or_low_trust",
        trustTier: "medium",
        trustScore: 0.75,
        gpsTrustScore: 1,
        fingerprintTrustScore: 1,
      };
    },
    insertReport: (_tx, { command }) => {
      calls.push({ type: "insertReport" });
      return {
        id: command.id,
        status: "pending_review",
        photo_expected: command.photo.expected,
      };
    },
  };
}

Deno.test("sha256 helper produces lowercase hex", async () => {
  const hash = await sha256Hex("abc");
  assert(
    hash === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "sha256 should match the known digest",
  );
});

Deno.test("submission hash is stable for equivalent payload key order", async () => {
  const left = command();
  const right = command({
    details: {
      tipo_animal: "gato",
      resulto_herido: true,
      descripcion: "Patio del hotel",
    },
  });
  assert(
    (await reportSubmissionHash(left)) === (await reportSubmissionHash(right)),
    "canonical submission hash should not depend on object key order",
  );
});

Deno.test("canonical submission hash excludes raw fingerprint material", async () => {
  const report = command();
  const withUnexpectedFingerprint = {
    ...report,
    deviceFingerprint: "raw-device-fingerprint",
  };

  assert(
    (await reportSubmissionHash(report)) ===
      (await reportSubmissionHash(withUnexpectedFingerprint)),
    "canonical submission hash should ignore fingerprint material",
  );
  assert(
    !JSON.stringify(reportSubmissionPayload(withUnexpectedFingerprint))
      .includes(
        "raw-device-fingerprint",
      ),
    "canonical payload should not contain the raw fingerprint",
  );
});

Deno.test("identical report replay ignores fingerprint hash and performs no new-report work", async () => {
  const report = command();
  const submissionHash = await reportSubmissionHash(report);
  const calls = [];
  const result = await createReport(
    {
      command: report,
      deviceFingerprint: "different-fingerprint-material",
    },
    replayDependencies({
      calls,
      existing: {
        id: report.id,
        submission_hash: submissionHash,
        status: "pending_review",
        photo_expected: true,
        device_fingerprint_hash: null,
      },
    }),
  );

  assert(result.replayed === true, "matching UUID and payload should replay");
  assert(
    result.reportId === report.id,
    "replay should return the original report id",
  );
  assert(
    result.photoExpected === true,
    "replay should return the original receipt fields",
  );
  assert(
    !calls.some((call) =>
      [
        "getActiveReportConfig",
        "checkActiveCreelGeofence",
        "consumeReportRateLimit",
        "getCurrentReportRateBucket",
        "assessReportTrust",
        "insertReport",
      ].includes(call.type)
    ),
    "replay must not validate geofence, consume quota, assess trust, or insert",
  );
});

Deno.test("same report UUID with changed payload conflicts before new-report work", async () => {
  const report = command();
  const calls = [];
  try {
    await createReport(
      {
        command: report,
        deviceFingerprint: "raw-fingerprint-material",
      },
      replayDependencies({
        calls,
        existing: {
          id: report.id,
          submission_hash: await sha256Hex("different-payload"),
          status: "pending_review",
          photo_expected: false,
          device_fingerprint_hash: null,
        },
      }),
    );
    throw new Error("changed content was accepted as replay");
  } catch (error) {
    assert(
      error.code === "report_id_payload_conflict",
      "changed content should conflict",
    );
  }
  assert(
    !calls.some((call) =>
      [
        "getActiveReportConfig",
        "checkActiveCreelGeofence",
        "consumeReportRateLimit",
        "insertReport",
      ].includes(call.type)
    ),
    "payload conflict must happen before geofence, quota, or insertion",
  );
});

Deno.test("client_created_at uses the configured server window", () => {
  const serverNow = "2026-09-10T12:00:00.000Z";
  assert(
    clientCreatedAtIsInBounds("2026-08-11T12:00:00.000Z", serverNow),
    "exactly 30 days in the past is accepted",
  );
  assert(
    clientCreatedAtIsInBounds("2026-09-10T13:00:00.000Z", serverNow),
    "exactly one hour in the future is accepted",
  );
  assert(
    !clientCreatedAtIsInBounds("2026-08-11T11:59:59.000Z", serverNow),
    "older than 30 days is rejected",
  );
});

Deno.test("missing active geofence still fails closed by default", async () => {
  const calls = [];
  try {
    await createReport(
      {
        command: command(),
        deviceFingerprint: "raw-fingerprint-material",
      },
      newReportDependencies({
        calls,
        geofence: { configured: false, contains: false },
      }),
    );
    throw new Error("missing geofence was accepted");
  } catch (error) {
    assert(
      error.code === "geofence_not_configured",
      "missing active geofence should fail without the temporary flag",
    );
  }
  assert(
    !calls.some((call) =>
      [
        "consumeReportRateLimit",
        "getCurrentReportRateBucket",
        "assessReportTrust",
        "insertReport",
      ].includes(call.type)
    ),
    "missing geofence must stop before quota, trust, or insertion",
  );
});

Deno.test("temporary missing-geofence flag allows report creation without removing geofence checks", async () => {
  const calls = [];
  const result = await createReport(
    {
      command: command({ photo: { expected: true, clientCheckPassed: true } }),
      deviceFingerprint: "raw-fingerprint-material",
    },
    newReportDependencies({
      calls,
      geofence: { configured: false, contains: false },
      allowMissingGeofence: true,
    }),
  );

  assert(result.reportId === "11111111-2222-4333-8444-555555555555");
  assert(result.photoExpected === true, "receipt must preserve photo expectation");
  assert(
    calls.some((call) => call.type === "insertReport"),
    "flagged missing geofence should continue to insertion",
  );
});

Deno.test("temporary missing-geofence flag does not bypass an active geofence miss", async () => {
  const calls = [];
  try {
    await createReport(
      {
        command: command(),
        deviceFingerprint: "raw-fingerprint-material",
      },
      newReportDependencies({
        calls,
        geofence: { configured: true, contains: false },
        allowMissingGeofence: true,
      }),
    );
    throw new Error("outside geofence was accepted");
  } catch (error) {
    assert(
      error.code === "outside_geofence",
      "an active geofence must still reject outside points",
    );
  }
  assert(
    !calls.some((call) => call.type === "insertReport"),
    "outside geofence must not insert a report",
  );
});

Deno.test("report SQL connection failures surface as database_unavailable", async () => {
  try {
    await createReport(
      {
        command: command(),
        deviceFingerprint: "raw-fingerprint-material",
      },
      {
        getSql: () => ({
          begin: () => {
            throw Object.assign(new Error("connection timeout"), {
              code: "CONNECT_TIMEOUT",
            });
          },
        }),
      },
    );
    throw new Error("connection failure was accepted");
  } catch (error) {
    assert(
      error.code === "database_unavailable",
      "connection errors should not become generic 500s",
    );
    assert(error.details.category === "database_connection");
    assert(error.details.sql_code === "CONNECT_TIMEOUT");
  }
});

Deno.test("report schema or privilege mismatches surface as preflight_mismatch", async () => {
  const calls = [];
  try {
    await createReport(
      {
        command: command(),
        deviceFingerprint: "raw-fingerprint-material",
      },
      {
        ...newReportDependencies({
          calls,
          geofence: { configured: false, contains: false },
          allowMissingGeofence: true,
        }),
        consumeReportRateLimit: () => {
          calls.push({ type: "consumeReportRateLimit" });
          throw Object.assign(
            new Error("function app_private.consume_rate_limit does not exist"),
            { code: "42883" },
          );
        },
      },
    );
    throw new Error("schema mismatch was accepted");
  } catch (error) {
    assert(
      error.code === "preflight_mismatch",
      "schema and privilege mismatches should be explicit preflight errors",
    );
    assert(error.details.category === "schema_or_privilege_mismatch");
    assert(error.details.sql_code === "42883");
  }
});

Deno.test("report rate-limit context mismatches are not reported as invalid_details", async () => {
  const calls = [];
  try {
    await createReport(
      {
        command: command(),
        deviceFingerprint: "raw-fingerprint-material",
      },
      {
        ...newReportDependencies({
          calls,
          geofence: { configured: false, contains: false },
          allowMissingGeofence: true,
        }),
        consumeReportRateLimit: () => {
          calls.push({ type: "consumeReportRateLimit" });
          throw Object.assign(new Error("invalid_rate_limit_context"), {
            code: "22023",
          });
        },
      },
    );
    throw new Error("rate-limit context mismatch was accepted");
  } catch (error) {
    assert(
      error.code === "preflight_mismatch",
      "rate-limit context failures should be operational preflight errors",
    );
    assert(error.details.category === "rate_limit_context");
    assert(error.details.sql_code === "22023");
  }
});

Deno.test("report detail trigger failures remain invalid_details", async () => {
  const calls = [];
  try {
    await createReport(
      {
        command: command(),
        deviceFingerprint: "raw-fingerprint-material",
      },
      {
        ...newReportDependencies({
          calls,
          geofence: { configured: false, contains: false },
          allowMissingGeofence: true,
        }),
        insertReport: () => {
          calls.push({ type: "insertReport" });
          throw Object.assign(new Error("invalid_description"), {
            code: "22023",
          });
        },
      },
    );
    throw new Error("detail trigger failure was accepted");
  } catch (error) {
    assert(
      error.code === "invalid_details",
      "report details trigger failures should remain client-facing detail errors",
    );
    assert(error.details.category === "report_details_trigger");
    assert(error.details.reason === "invalid_description");
  }
});

Deno.test("report storage constraint mismatches surface as preflight_mismatch", async () => {
  const calls = [];
  try {
    await createReport(
      {
        command: command(),
        deviceFingerprint: "raw-fingerprint-material",
      },
      {
        ...newReportDependencies({
          calls,
          geofence: { configured: false, contains: false },
          allowMissingGeofence: true,
        }),
        insertReport: () => {
          calls.push({ type: "insertReport" });
          throw Object.assign(
            new Error("new row for relation reports violates check constraint"),
            { code: "23514" },
          );
        },
      },
    );
    throw new Error("constraint mismatch was accepted");
  } catch (error) {
    assert(
      error.code === "preflight_mismatch",
      "storage constraint mismatches should not become generic 500s",
    );
    assert(error.details.category === "schema_or_privilege_mismatch");
    assert(error.details.sql_code === "23514");
  }
});

Deno.test("rate limit retry seconds point to the next UTC hour", () => {
  assert(
    secondsUntilNextHour("2026-09-10T12:45:30.000Z") === 870,
    "retry delay should be exact",
  );
});
