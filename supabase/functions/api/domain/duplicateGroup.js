const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class DuplicateError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "DuplicateError";
    this.code = code;
    this.details = details;
  }
}

function invalid(field, message) {
  throw new DuplicateError("invalid_request", "Duplicate command is invalid.", {
    fields: { [field]: message },
  });
}

export function validateDuplicateId(value, field = "group_id") {
  if (typeof value !== "string" || !UUID.test(value)) {
    invalid(field, "Must be a lowercase canonical UUID.");
  }
  return value;
}

function object(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DuplicateError("invalid_request", "Body must be a JSON object.");
  }
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) invalid(key, "Unknown field.");
  }
}

function note(value) {
  if (
    typeof value !== "string" || !value.trim() ||
    [...value.trim()].length > 1000
  ) {
    invalid("note", "Must contain 1–1000 characters and not be blank.");
  }
  return value.trim();
}

export function validateDuplicateResolution(input) {
  object(input, ["canonical_report_id", "report_ids", "note"]);
  const canonical = validateDuplicateId(
    input.canonical_report_id,
    "canonical_report_id",
  );
  if (
    !Array.isArray(input.report_ids) || input.report_ids.length < 2 ||
    input.report_ids.length > 500
  ) {
    invalid(
      "report_ids",
      "Must contain 2–500 distinct report UUIDs, including the canonical report.",
    );
  }
  const ids = input.report_ids.map((id) =>
    validateDuplicateId(id, "report_ids")
  );
  if (new Set(ids).size !== ids.length || !ids.includes(canonical)) {
    invalid(
      "report_ids",
      "Members must be distinct and include the canonical report.",
    );
  }
  return {
    canonical_report_id: canonical,
    report_ids: [...ids].sort(),
    ...(Object.hasOwn(input, "note") ? { note: note(input.note) } : {}),
  };
}

export function validateDuplicateReversal(input) {
  object(input, ["note"]);
  return { note: note(input.note) };
}

// Connectivity is over the induced pending-candidate graph, not a clique and
// not a path through unselected reports. Detection never makes the decision.
export function assertConnectedCandidates(reportIds, candidates) {
  const adjacency = new Map(reportIds.map((id) => [id, []]));
  for (const edge of candidates) {
    if (
      edge.status !== "pending" || !adjacency.has(edge.report_a) ||
      !adjacency.has(edge.report_b)
    ) continue;
    adjacency.get(edge.report_a).push(edge.report_b);
    adjacency.get(edge.report_b).push(edge.report_a);
  }
  const seen = new Set();
  const queue = [reportIds[0]];
  while (queue.length) {
    const id = queue.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const neighbor of adjacency.get(id) ?? []) {
      if (!seen.has(neighbor)) queue.push(neighbor);
    }
  }
  if (reportIds.length < 2 || seen.size !== reportIds.length) {
    throw new DuplicateError(
      "duplicate_graph_disconnected",
      "Selected reports must form a connected pending-candidate graph.",
    );
  }
}

export function assertAvailableReports(reportIds, reports, activeMemberships) {
  if (
    reports.length !== reportIds.length ||
    reportIds.some((id) => !reports.some((report) => report.id === id))
  ) {
    throw new DuplicateError(
      "not_found",
      "One or more selected reports were not found.",
    );
  }
  if (reports.some((report) => report.status === "deleted")) {
    throw new DuplicateError(
      "duplicate_group_conflict",
      "Deleted reports cannot enter a new duplicate resolution.",
    );
  }
  if (activeMemberships.length) {
    throw new DuplicateError(
      "duplicate_membership_conflict",
      "A selected report already belongs to an active group.",
    );
  }
}
