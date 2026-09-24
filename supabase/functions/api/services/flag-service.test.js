import { sha256Hex } from "./reportService.js";
import { submitFlag } from "./flag-service.js";

const reportId = "11111111-2222-4333-8444-555555555555";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function rejects(operation, code) {
  try {
    await operation();
  } catch (error) {
    if (code) {
      assert(error.code === code, `Expected ${code}, got ${error.code}`);
    }
    return error;
  }
  throw new Error(`Expected rejection: ${code}`);
}

function visibleReport(overrides = {}) {
  return {
    id: reportId,
    status: "visible",
    status_reason: "administrator_approved",
    previous_status: "pending_review",
    accepted_at: "2026-09-23T12:00:00.000Z",
    published_at: "2026-09-23T12:00:00.000Z",
    public_until: "2026-12-22T12:00:00.000Z",
    hidden_at: null,
    deleted_at: null,
    publicly_available: true,
    noncanonical: false,
    ...overrides,
  };
}

function flagFixture(options = {}) {
  const events = [];
  let state = {
    reports: options.reports ?? [visibleReport()],
    flags: [],
    audits: [],
  };
  const config = options.config === null ? null : {
    flag_auto_hide_threshold: options.threshold ?? 2,
    flag_rate_limit_per_hour: 30,
    fingerprint_retention_days: 30,
    server_now: "2026-09-23T12:45:30.000Z",
    ...options.config,
  };
  const dependencies = {
    getSql: () => ({
      begin: async (operation) => {
        events.push("begin");
        const before = structuredClone(state);
        const tx = async (strings, ...values) => {
          events.push({ type: "sql", text: strings.join("?"), values });
          return [];
        };
        try {
          const value = await operation(tx);
          events.push("commit");
          return value;
        } catch (error) {
          state = before;
          events.push("rollback");
          throw error;
        }
      },
    }),
    lockReportForFlag: (_tx, id) => {
      events.push("lock");
      const report = state.reports.find((row) => row.id === id);
      return report ? structuredClone(report) : null;
    },
    getActiveFlagConfig: () => {
      events.push("config");
      return config;
    },
    findExistingFlagByOrigin: (_tx, { reportId, originHash }) => {
      events.push("duplicate");
      return state.flags.find((flag) =>
        flag.report_id === reportId &&
        flag.device_fingerprint_hash === originHash
      ) ?? null;
    },
    consumeFlagRateLimit: () => {
      events.push("consume");
      return options.rateAllowed ?? true;
    },
    insertFlag: (_tx, values) => {
      events.push("insert");
      const flag = {
        id: `00000000-0000-4000-8000-${
          String(100 + state.flags.length).padStart(12, "0")
        }`,
        report_id: values.reportId,
        reason: values.reason,
        reason_detail: values.detail,
        device_fingerprint_hash: values.originHash,
      };
      state.flags.push(flag);
      return flag;
    },
    countDistinctActiveFlagOrigins: (_tx, id) => {
      events.push("count");
      return new Set(
        state.flags
          .filter((flag) =>
            flag.report_id === id && flag.device_fingerprint_hash
          )
          .map((flag) => flag.device_fingerprint_hash),
      ).size;
    },
    autoHideReportByFlags: (_tx, id) => {
      events.push("hide");
      const report = state.reports.find((row) => row.id === id);
      if (!report || report.status !== "visible") {
        return null;
      }
      Object.assign(report, {
        previous_status: report.status,
        status: "hidden",
        status_reason: "flag_threshold",
        hidden_at: "2026-09-23T12:46:00.000Z",
      });
      return structuredClone(report);
    },
    insertFlagAudit: (_tx, audit) => {
      events.push("audit");
      state.audits.push(structuredClone(audit));
    },
  };
  const service = (deviceFingerprint, id = reportId) =>
    submitFlag(
      {
        reportId: id,
        command: { reason: "otro", detail: "Needs review" },
        deviceFingerprint,
      },
      dependencies,
    );
  return { service, events, state: () => state };
}

Deno.test("flag service hashes the raw fingerprint exactly as submitted", async () => {
  const raw = "  raw-device-fingerprint-001  ";
  const f = flagFixture();
  await f.service(raw);

  assert(
    f.state().flags[0].device_fingerprint_hash === await sha256Hex(raw),
    "Hash must include spaces and all submitted fingerprint bytes.",
  );
  assert(
    f.state().flags[0].reason_detail === "Needs review",
    "Reason detail should persist as submitted by the command.",
  );
});

Deno.test("same device cannot accumulate flags or consume duplicate quota", async () => {
  const f = flagFixture({ threshold: 2 });
  await f.service("device-fingerprint-aaaa");
  await rejects(
    () => f.service("device-fingerprint-aaaa"),
    "flag_already_submitted",
  );

  assert(
    f.state().flags.length === 1,
    "Duplicate device must not insert again.",
  );
  assert(
    f.state().reports[0].status === "visible",
    "One origin must not hide.",
  );
  assert(
    f.state().audits.length === 0,
    "No auto-hide audit should be written.",
  );
  assert(
    f.events.filter((event) => event === "consume").length === 1,
    "Duplicate detection must happen before rate-limit consumption.",
  );
});

Deno.test("distinct devices accumulate to the threshold and auto-hide once", async () => {
  const f = flagFixture({ threshold: 2 });
  const first = await f.service("device-fingerprint-aaaa");
  const second = await f.service("device-fingerprint-bbbb");

  assert(
    first.reportStatus === "visible",
    "First distinct origin stays visible.",
  );
  assert(
    second.reportStatus === "hidden",
    "Second distinct origin reaches threshold.",
  );
  assert(f.state().flags.length === 2, "Both distinct flags persist.");
  assert(f.state().reports[0].status === "hidden", "Report should be hidden.");
  assert(
    f.state().audits.length === 1 &&
      f.state().audits[0].action === "report_auto_hidden",
    "Auto-hide must be audited once.",
  );
});

Deno.test("non-public, expired, missing and noncanonical reports are not flaggable", async () => {
  const cases = [
    [visibleReport({ status: "pending_review" }), reportId],
    [visibleReport({ status: "hidden" }), reportId],
    [
      visibleReport({
        status: "deleted",
        deleted_at: "2026-09-23T12:00:00.000Z",
      }),
      reportId,
    ],
    [visibleReport({ publicly_available: false }), reportId],
    [visibleReport({ noncanonical: true }), reportId],
    [null, reportId],
  ];

  for (const [report, id] of cases) {
    const f = flagFixture({ reports: report ? [report] : [] });
    await rejects(
      () => f.service("device-fingerprint-aaaa", id),
      "report_not_flaggable",
    );
    assert(
      f.state().flags.length === 0,
      "Rejected report must not insert flags.",
    );
    assert(f.state().audits.length === 0, "Rejected report must not audit.");
    assert(
      !f.events.includes("consume"),
      "Rejected report must not consume quota.",
    );
  }
});

Deno.test("rate-limit failure happens before insert or hide", async () => {
  const f = flagFixture({ rateAllowed: false });
  const error = await rejects(
    () => f.service("device-fingerprint-aaaa"),
    "flag_rate_limit_exceeded",
  );

  assert(
    error.retryAfterSeconds === 870,
    "Retry-After seconds should target next UTC hour.",
  );
  assert(f.state().flags.length === 0, "Rate-limited request must not insert.");
  assert(
    f.state().reports[0].status === "visible",
    "Rate limit must not hide.",
  );
  assert(!f.events.includes("hide"), "Rate limit must stop before auto-hide.");
});
