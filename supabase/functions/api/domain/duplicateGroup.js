/**
 * @module domain/duplicateGroup
 * Domain rules for administrator duplicate resolution: request validation, candidate-graph connectivity,
 * and report availability. Pure logic; Services own authorization (ADR-019) and Repositories persist groups.
 */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Error raised by duplicate-resolution rules.
 * @property {string} code - `invalid_request`, `duplicate_graph_disconnected`, `not_found`,
 *   `duplicate_group_conflict`, or `duplicate_membership_conflict`.
 * @property {{fields: Record<string, string>} | undefined} details - Per-field messages for `invalid_request`.
 */
export class DuplicateError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "DuplicateError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Throws `invalid_request` with a single field message.
 * @throws {DuplicateError}
 */
function invalid(field, message) {
  throw new DuplicateError("invalid_request", "Duplicate command is invalid.", {
    fields: { [field]: message },
  });
}

/**
 * @param {unknown} value - Candidate id.
 * @param {string} [field] - Field name reported on failure.
 * @returns {string} The value, when it is a lowercase canonical UUID.
 * @throws {DuplicateError} `invalid_request`.
 */
export function validateDuplicateId(value, field = "group_id") {
  if (typeof value !== "string" || !UUID.test(value)) {
    invalid(field, "Must be a lowercase canonical UUID.");
  }
  return value;
}

/**
 * Asserts that the input is a plain object containing only allowed keys.
 * @throws {DuplicateError} `invalid_request`.
 */
function object(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DuplicateError("invalid_request", "Body must be a JSON object.");
  }
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) invalid(key, "Unknown field.");
  }
}

/**
 * Validates and trims a 1–1000 character, non-blank note.
 * @throws {DuplicateError} `invalid_request`.
 */
function note(value) {
  if (
    typeof value !== "string" || !value.trim() ||
    [...value.trim()].length > 1000
  ) {
    invalid("note", "Must contain 1–1000 characters and not be blank.");
  }
  return value.trim();
}

/**
 * Validates a duplicate-resolution request body.
 * @param {unknown} input - Parsed body with `canonical_report_id`, `report_ids`, and optional `note`.
 * @returns {{canonical_report_id: string, report_ids: string[], note?: string}} Normalized command; `report_ids` is sorted.
 * @throws {DuplicateError} `invalid_request` when the body, ids, or note are invalid, or the members
 *   are not 2–500 distinct UUIDs that include the canonical report.
 */
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

/**
 * Validates a duplicate-group reversal request body.
 * @param {unknown} input - Parsed body with a required `note`.
 * @returns {{note: string}} Trimmed note.
 * @throws {DuplicateError} `invalid_request`.
 */
export function validateDuplicateReversal(input) {
  object(input, ["note"]);
  return { note: note(input.note) };
}

/**
 * Asserts that the selected reports form one connected graph using only pending candidate edges
 * between selected reports.
 * @param {string[]} reportIds - Selected report ids.
 * @param {Array<{status: string, report_a: string, report_b: string}>} candidates - Duplicate candidate edges.
 * @returns {void}
 * @throws {DuplicateError} `duplicate_graph_disconnected` when fewer than two reports are selected or
 *   the graph is disconnected.
 */
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

/**
 * Asserts that every selected report exists, none is deleted, and none already has an active membership.
 * @param {string[]} reportIds - Selected report ids.
 * @param {Array<{id: string, status: string}>} reports - Reports loaded for those ids.
 * @param {Array<unknown>} activeMemberships - Active duplicate memberships of those reports.
 * @returns {void}
 * @throws {DuplicateError} `not_found`, `duplicate_group_conflict`, or `duplicate_membership_conflict`.
 */
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
