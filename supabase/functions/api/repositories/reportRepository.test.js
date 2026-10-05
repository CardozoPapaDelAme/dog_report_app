import { insertReport } from "./reportRepository.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("report insert binds details with the driver's jsonb helper", async () => {
  const details = { descripcion: "Objeto jsonb real" };
  const jsonParameter = { kind: "jsonb-parameter", value: details };
  const captures = { values: [], jsonCalls: [] };
  async function tx(strings, ...values) {
    captures.values = values;
    return [{
      id: "11111111-2222-4333-8444-555555555555",
      status: "pending_review",
      photo_expected: false,
    }];
  }
  tx.json = (value) => {
    captures.jsonCalls.push(value);
    return jsonParameter;
  };

  await insertReport(tx, {
    command: {
      id: "11111111-2222-4333-8444-555555555555",
      location: {
        longitude: -107.63,
        latitude: 27.75,
        accuracyMeters: 1000,
        mockSuspected: false,
      },
      incidentType: "otro",
      sightingType: "solitario",
      details,
      dog: { predominantColor: null, size: null, hasCollar: null },
      photo: { expected: false, clientCheckPassed: null },
      antiAbuse: { honeypotFilled: false },
      clientCreatedAt: "2026-10-01T04:15:00.000Z",
    },
    submissionHash: "b".repeat(64),
    originHash: "c".repeat(64),
    config: {
      id: "22222222-3333-4444-8555-666666666666",
      fingerprint_retention_days: 30,
      public_retention_days: 90,
    },
    trust: {
      status: "pending_review",
      statusReason: "imprecise_gps",
      trustTier: "low",
      trustScore: 0.05,
      gpsTrustScore: 0.05,
      fingerprintTrustScore: 1,
    },
  });

  assert(captures.jsonCalls[0] === details, "details should be passed as an object");
  assert(
    captures.values.includes(jsonParameter),
    "insert should bind the json helper result instead of a JSON string",
  );
});
