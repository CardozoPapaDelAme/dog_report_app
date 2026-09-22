import { createDuplicateService } from "../../services/duplicate-service.js";
export const uuid = (n) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const actor = {
  type: "authenticated",
  userId: uuid(100),
  role: "administrator",
  profile: { id: uuid(100), role: "administrator", active: true },
};
export const input = {
  canonical_report_id: uuid(1),
  report_ids: [uuid(1), uuid(2), uuid(3)],
  note: "Same dog, reviewed manually.",
};
export function assert(value, message = "Assertion failed") {
  if (!value) throw new Error(message);
}
export async function rejects(operation, code) {
  try {
    await operation();
  } catch (error) {
    if (code) {
      assert(error.code === code, `Expected ${code}, got ${error.code}`);
    }
    return;
  }
  throw new Error(`Expected rejection: ${code}`);
}

export function duplicateFixture(overrides = {}) {
  const events = [];
  let state = {
    reports: input.report_ids.map((id) => ({ id, status: "visible" })),
    candidates: [{
      id: uuid(11),
      report_a: uuid(1),
      report_b: uuid(2),
      status: "pending",
    }, {
      id: uuid(12),
      report_a: uuid(2),
      report_b: uuid(3),
      status: "pending",
    }],
    groups: [],
    memberships: [],
    audits: [],
    profile: { ...actor.profile },
  };
  const repository = {
    readDuplicateActor: () => {
      events.push("profile");
      return state.profile;
    },
    readDuplicateEnvironment: () => "staging",
    lockDuplicateResolution: () => events.push("lock"),
    lockDuplicateReports: (_tx, ids) =>
      state.reports.filter((r) => ids.includes(r.id)),
    readActiveMemberships: (_tx, ids) =>
      state.memberships.filter((m) => m.active && ids.includes(m.report_id)),
    lockInternalCandidates: (_tx, ids, status) =>
      structuredClone(
        state.candidates.filter((c) =>
          c.status === status && ids.includes(c.report_a) &&
          ids.includes(c.report_b)
        ),
      ),
    insertDuplicateGroup: (_tx, { actorId, values }) => {
      const id = uuid(200 + state.groups.length);
      state.groups.push({
        id,
        canonical_report_id: values.canonical_report_id,
        report_ids: values.report_ids,
        status: "active",
        resolution_version: 1,
        resolved_at: "2026-09-22T00:00:00Z",
        resolved_by: actorId,
        reversed_at: null,
        note: values.note ?? null,
      });
      state.memberships.push(
        ...values.report_ids.map((report_id) => ({
          group_id: id,
          report_id,
          active: true,
        })),
      );
      return id;
    },
    confirmDuplicateCandidates: (_tx, { ids }) => {
      const rows = state.candidates.filter((c) => ids.includes(c.id));
      rows.forEach((c) => c.status = "confirmed");
      return rows;
    },
    readDuplicateGroup: (_tx, id) =>
      structuredClone(state.groups.find((g) => g.id === id) ?? null),
    lockDuplicateGroup: (_tx, id) =>
      state.groups.find((g) => g.id === id) ?? null,
    listActiveDuplicateGroups: () =>
      structuredClone(state.groups.filter((g) => g.status === "active")),
    reverseDuplicateGroup: (_tx, { id, candidateIds, actorId }) => {
      Object.assign(state.groups.find((g) => g.id === id), {
        status: "reversed",
        resolution_version: 2,
        reversed_by: actorId,
        reversed_at: "2026-09-22T01:00:00Z",
      });
      state.memberships.filter((m) => m.group_id === id).forEach((m) =>
        m.active = false
      );
      state.candidates.filter((c) => candidateIds.includes(c.id)).forEach(
        (c) => {
          c.status = "pending";
          c.reviewed_by = null;
          c.reviewed_at = null;
        },
      );
    },
    insertDuplicateAudit: (_tx, audit) =>
      state.audits.push(structuredClone(audit)),
    ...overrides.repository,
  };
  const service = createDuplicateService({
    getConfig: () => ({ expectedEnvironment: "staging" }),
    getSql: () => ({
      begin: async (operation) => {
        events.push("begin");
        const before = structuredClone(state);
        try {
          const value = await operation((strings, ...values) =>
            events.push([strings.join(""), values[0]])
          );
          events.push("commit");
          return value;
        } catch (error) {
          state = before;
          events.push("rollback");
          throw error;
        }
      },
    }),
    ...overrides,
    repository,
  });
  return { service, events, repository, state: () => state };
}
