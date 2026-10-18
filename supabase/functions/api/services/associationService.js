/**
 * @module services/associationService
 * Association read use case (Hono API on Supabase Edge: routes -> Controllers -> Services ->
 * Repositories). Per ADR-019 this Service owns authorization: the `association` and `administrator` roles may list
 * accepted reports (clarification #27). The projection stays the same for both.
 */
import { getSql } from "../infrastructure/db.js";
import { listAcceptedAssociationReports } from "../repositories/associationReportRepository.js";

/**
 * Asserts that the actor is an authenticated association or administrator user.
 * @param {import('../middleware/auth.js').AuthenticatedAuth | null | undefined} actor - Request actor.
 * @returns {void}
 * @throws {Error} With `code` `forbidden` for anonymous or any other actor.
 */
export function assertAssociationActor(actor) {
  if (
    !actor || actor.type !== "authenticated" ||
    (actor.role !== "association" && actor.role !== "administrator")
  ) {
    const error = new Error("association_role_required");
    error.code = "forbidden";
    throw error;
  }
}

/**
 * Splits a `limit + 1` result into the page rows and a `hasMore` flag.
 * @param {Array<*>} rows - Rows fetched with one extra row.
 * @param {number} limit - Page size.
 * @returns {{rows: Array<*>, hasMore: boolean}}
 */
export function paginateAssociationRows(rows, limit) {
  const hasMore = rows.length > limit;
  return {
    rows: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
}

/**
 * Lists accepted reports for an association inside a transaction scoped to the actor.
 * @param {object} options
 * @param {import('../middleware/auth.js').AuthenticatedAuth} options.actor - Authenticated association or administrator actor.
 * @param {string | null} options.from - Inclusive lower bound (ISO timestamp), or null.
 * @param {string | null} options.to - Inclusive upper bound (ISO timestamp), or null.
 * @param {number} options.limit - Page size.
 * @param {{acceptedAt: string, id: string} | null} options.cursor - Keyset cursor, or null for the first page.
 * @returns {Promise<{rows: import('../repositories/associationReportRepository.js').AssociationReportRow[], hasMore: boolean}>}
 * @throws {Error} `forbidden` when the actor is neither association nor administrator; database errors propagate unchanged.
 */
export async function listAssociationReports(
  { actor, from, to, limit, cursor },
) {
  assertAssociationActor(actor);
  const sql = getSql();
  const rows = await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.user_id', ${actor.userId}, true)`;
    await tx`SELECT set_config('app.role', ${actor.role}, true)`;
    return listAcceptedAssociationReports(tx, { from, to, limit, cursor });
  });
  return paginateAssociationRows(rows, limit);
}
