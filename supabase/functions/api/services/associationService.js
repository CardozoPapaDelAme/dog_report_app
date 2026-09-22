import { getSql } from "../infrastructure/db.js";
import { listAcceptedAssociationReports } from "../repositories/associationReportRepository.js";

export function assertAssociationActor(actor) {
  if (
    !actor || actor.type !== "authenticated" || actor.role !== "association"
  ) {
    const error = new Error("association_role_required");
    error.code = "forbidden";
    throw error;
  }
}

export function paginateAssociationRows(rows, limit) {
  const hasMore = rows.length > limit;
  return {
    rows: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
}

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
