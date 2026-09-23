import { assessReportTrust } from "./trustService.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const config = {
  trust_high_threshold: "0.800",
  trust_medium_threshold: "0.500",
  gps_accuracy_max_meters: "50.00",
  report_rate_limit_per_hour: 10,
};

function command(overrides = {}) {
  return {
    location: { accuracyMeters: 12, mockSuspected: false },
    antiAbuse: { honeypotFilled: false },
    ...overrides,
  };
}

Deno.test("high trust can auto-publish when GPS and fingerprint signals are clean", () => {
  const trust = assessReportTrust({
    command: command(),
    config,
    rateBucketCount: 1,
  });
  assert(trust.trustTier === "high", "clean signals should produce high tier");
  assert(trust.status === "visible", "high tier should auto-publish");
  assert(
    trust.statusReason === "high_trust_auto_publish",
    "auto-published reports should keep the trust reason",
  );
});

Deno.test("mock and imprecise locations stay pending even with otherwise high scores", () => {
  const mock = assessReportTrust({
    command: command({ location: { accuracyMeters: 12, mockSuspected: true } }),
    config,
    rateBucketCount: 1,
  });
  assert(mock.status === "pending_review", "mock location must stay pending");
  assert(
    mock.statusReason === "mock_location",
    "mock location reason should be explicit",
  );

  const imprecise = assessReportTrust({
    command: command({
      location: { accuracyMeters: 100, mockSuspected: false },
    }),
    config,
    rateBucketCount: 1,
  });
  assert(
    imprecise.status === "pending_review",
    "imprecise GPS must stay pending",
  );
  assert(
    imprecise.statusReason === "imprecise_gps",
    "GPS reason should be explicit",
  );
});
