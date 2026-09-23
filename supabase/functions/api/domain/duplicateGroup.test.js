import {
  assertAvailableReports,
  assertConnectedCandidates,
  validateDuplicateId,
  validateDuplicateResolution,
  validateDuplicateReversal,
} from "./duplicateGroup.js";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [a, b, c, d] = [1, 2, 3, 4].map(id);
const edge = (report_a, report_b, status = "pending") => ({
  report_a,
  report_b,
  status,
});
function assert(value, message = "Assertion failed") {
  if (!value) throw new Error(message);
}
function rejects(fn, code = "invalid_request") {
  try {
    fn();
  } catch (error) {
    assert(error.code === code, `Expected ${code}, got ${error.code}`);
    return;
  }
  throw new Error(`Expected ${code}`);
}
Deno.test("FAB-3 DOMAIN: resolution validates canonical membership, identifiers, limits and notes", () => {
  const input = {
    canonical_report_id: a,
    report_ids: [c, a, b],
    note: " Reviewed ",
  };
  const value = validateDuplicateResolution(input);
  assert(
    value.report_ids.join() === [a, b, c].join() && value.note === "Reviewed",
  );
  assert(input.report_ids[0] === c, "Do not mutate input");
  assert(
    !("note" in
      validateDuplicateResolution({
        canonical_report_id: a,
        report_ids: [a, b],
      })),
  );
  for (
    const patch of [
      { canonical_report_id: d },
      { report_ids: [a, a] },
      { report_ids: [a] },
      { report_ids: [a, "bad"] },
      { report_ids: Array(501).fill(a) },
      { note: null },
      { note: " " },
      { note: "a".repeat(1001) },
      { status: "active" },
      { resolution_version: 2 },
    ]
  ) rejects(() => validateDuplicateResolution({ ...input, ...patch }));
  for (const value of [null, [], "text", {}]) {
    rejects(() => validateDuplicateResolution(value));
  }
  rejects(() => validateDuplicateId("00000000-0000-4000-8000-00000000000A"));
});
Deno.test("FAB-3 DOMAIN: a pending chain is sufficient, external paths and stale edges are not", () => {
  assertConnectedCandidates([a, b, c], [edge(a, b), edge(b, c)]);
  for (
    const edges of [[], [edge(a, b)], [edge(a, b), edge(b, c, "confirmed")], [
      edge(a, b),
      edge(b, c, "dismissed"),
    ], [edge(a, b), edge(b, d), edge(d, c)]]
  ) {
    rejects(
      () => assertConnectedCandidates([a, b, c], edges),
      "duplicate_graph_disconnected",
    );
  }
});
Deno.test("FAB-3 DOMAIN: missing, deleted or already grouped reports cannot resolve", () => {
  const reports = [{ id: a, status: "visible" }, {
    id: b,
    status: "pending_review",
  }];
  assertAvailableReports([a, b], reports, []);
  rejects(
    () => assertAvailableReports([a, b], reports.slice(0, 1), []),
    "not_found",
  );
  rejects(
    () =>
      assertAvailableReports(
        [a, b],
        [reports[0], { id: b, status: "deleted" }],
        [],
      ),
    "duplicate_group_conflict",
  );
  rejects(
    () => assertAvailableReports([a, b], reports, [{ report_id: a }]),
    "duplicate_membership_conflict",
  );
});
Deno.test("FAB-3 DOMAIN: reversal requires a bounded reason and accepts no state overrides", () => {
  assert(
    validateDuplicateReversal({ note: " Review again " }).note ===
      "Review again",
  );
  for (
    const input of [{}, { note: null }, { note: "" }, {
      note: "a".repeat(1001),
    }, { note: "ok", status: "active" }]
  ) rejects(() => validateDuplicateReversal(input));
});
