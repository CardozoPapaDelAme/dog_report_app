/**
 * @module repositories/duplicateRepository
 * SQL access for duplicate groups, memberships, and candidate edges. Every function runs on a
 * caller-provided transaction; the duplicate Service owns authorization (ADR-019), locking order,
 * and domain validation.
 */
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} id - Profile id of the caller.
 * @returns {Promise<{id: string, role: string, active: boolean} | null>}
 */
export async function readDuplicateActor(tx, id) {
  const rows =
    await tx`SELECT id, role, active FROM public.profiles WHERE id = ${id}`;
  return rows[0] ?? null;
}
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<string | null>} The deployment environment, or null when missing.
 */
export async function readDuplicateEnvironment(tx) {
  const rows =
    await tx`SELECT environment FROM public.deployment_metadata WHERE singleton = TRUE`;
  return rows[0]?.environment ?? null;
}

/**
 * Takes the database-wide advisory lock shared by duplicate resolution and reversal.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<void>}
 */
export async function lockDuplicateResolution(tx) {
  // Reports have no environment column: one database-wide command lock, shared
  // by resolution and reversal. Row locks additionally coordinate moderation and retention.
  await tx`SELECT pg_catalog.pg_advisory_xact_lock(103003, 1)`;
}

/**
 * Locks the given reports `FOR UPDATE` in id order.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string[]} ids - Report ids.
 * @returns {Promise<Array<{id: string, status: string}>>} Rows found (missing ids are absent).
 */
export async function lockDuplicateReports(tx, ids) {
  return tx`SELECT id, status FROM public.reports WHERE id IN ${
    tx(ids)
  } ORDER BY id FOR UPDATE`;
}
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string[]} ids - Report ids.
 * @returns {Promise<Array<{group_id: string, report_id: string, member_role: string}>>} Active memberships of those reports.
 */
export async function readActiveMemberships(tx, ids) {
  return tx`SELECT group_id, report_id, member_role FROM public.duplicate_memberships
    WHERE report_id IN ${tx(ids)} AND active ORDER BY report_id`;
}
/**
 * Locks candidate edges whose both endpoints are in `ids` and that have the given status.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string[]} ids - Report ids.
 * @param {string} status - Candidate status (for example `pending` or `confirmed`).
 * @returns {Promise<Array<{id: string, report_a: string, report_b: string, status: string, reviewed_by: string | null, reviewed_at: Date | null}>>}
 */
export async function lockInternalCandidates(tx, ids, status) {
  return tx`SELECT id, report_a, report_b, status, reviewed_by, reviewed_at
    FROM public.duplicate_candidates
    WHERE report_a IN ${tx(ids)} AND report_b IN ${
    tx(ids)
  } AND status = ${status}
    ORDER BY id FOR UPDATE`;
}
/**
 * Inserts a resolved duplicate group and one membership per report (`canonical` or `duplicate`).
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.actorId - Administrator profile id.
 * @param {{canonical_report_id: string, report_ids: string[], note?: string}} options.values - Validated resolution.
 * @returns {Promise<string>} New group id.
 */
export async function insertDuplicateGroup(tx, { actorId, values }) {
  const rows =
    await tx`INSERT INTO public.duplicate_groups (canonical_report_id, resolved_by, note, resolved_at)
    VALUES (${values.canonical_report_id}, ${actorId}, ${
      values.note ?? null
    }, pg_catalog.clock_timestamp()) RETURNING id`;
  const id = rows[0].id;
  const memberships = values.report_ids.map((report_id) => ({
    group_id: id,
    report_id,
    member_role: report_id === values.canonical_report_id
      ? "canonical"
      : "duplicate",
  }));
  await tx`INSERT INTO public.duplicate_memberships ${
    tx(memberships, "group_id", "report_id", "member_role")
  }`;
  return id;
}
/**
 * Marks pending candidate edges as `confirmed` by the actor.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string[]} options.ids - Candidate ids.
 * @param {string} options.actorId - Administrator profile id.
 * @returns {Promise<Array<{id: string}>>} Updated candidate ids.
 */
export async function confirmDuplicateCandidates(tx, { ids, actorId }) {
  return tx`UPDATE public.duplicate_candidates
    SET status = 'confirmed', reviewed_by = ${actorId}, reviewed_at = pg_catalog.clock_timestamp()
    WHERE id IN ${tx(ids)} AND status = 'pending' RETURNING id`;
}
/**
 * @typedef {object} DuplicateGroupRow
 * @property {string} id
 * @property {string} canonical_report_id
 * @property {string} status - `active` or `reversed`.
 * @property {number} resolution_version
 * @property {string} resolved_by
 * @property {Date} resolved_at
 * @property {string | null} reversed_by
 * @property {Date | null} reversed_at
 * @property {string | null} note
 * @property {string[]} report_ids - All member report ids (active or not), sorted.
 */
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} id - Group id.
 * @returns {Promise<DuplicateGroupRow | null>}
 */
export async function readDuplicateGroup(tx, id) {
  const rows =
    await tx`SELECT g.id, g.canonical_report_id, g.status, g.resolution_version,
      g.resolved_by, g.resolved_at, g.reversed_by, g.reversed_at, g.note,
      ARRAY(SELECT m.report_id FROM public.duplicate_memberships m WHERE m.group_id = g.id ORDER BY m.report_id) AS report_ids
    FROM public.duplicate_groups g WHERE g.id = ${id}`;
  return rows[0] ?? null;
}
/**
 * Lists active groups with their active member ids, most recently resolved first.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<Array<{id: string, canonical_report_id: string, status: string, resolution_version: number, resolved_at: Date, reversed_at: Date | null, report_ids: string[]}>>}
 */
export async function listActiveDuplicateGroups(tx) {
  // One SQL snapshot keeps the group and its memberships consistent during reversal.
  return tx`SELECT g.id, g.canonical_report_id, g.status, g.resolution_version,
      g.resolved_at, g.reversed_at,
      ARRAY(SELECT m.report_id FROM public.duplicate_memberships m WHERE m.group_id = g.id AND m.active ORDER BY m.report_id) AS report_ids
    FROM public.duplicate_groups g WHERE g.status = 'active'
    ORDER BY g.resolved_at DESC, g.id DESC`;
}
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} id - Group id.
 * @returns {Promise<{id: string, status: string} | null>} The locked group, or null when missing.
 */
export async function lockDuplicateGroup(tx, id) {
  const rows =
    await tx`SELECT id, status FROM public.duplicate_groups WHERE id = ${id} FOR UPDATE`;
  return rows[0] ?? null;
}
/**
 * Reverses an active group: bumps its resolution version, deactivates its memberships, and returns
 * the given confirmed candidate edges to `pending`.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.id - Group id.
 * @param {string} options.actorId - Administrator profile id.
 * @param {string[]} options.candidateIds - Candidate ids to reopen.
 * @returns {Promise<void>}
 * @throws {Error} When no active group with that id was updated.
 */
export async function reverseDuplicateGroup(tx, { id, actorId, candidateIds }) {
  const rows = await tx`UPDATE public.duplicate_groups
    SET status = 'reversed', resolution_version = resolution_version + 1,
      reversed_by = ${actorId}, reversed_at = GREATEST(pg_catalog.clock_timestamp(), resolved_at)
    WHERE id = ${id} AND status = 'active' RETURNING id`;
  if (rows.length !== 1) {
    throw new Error("Duplicate reversal did not update one active group.");
  }
  await tx`UPDATE public.duplicate_memberships SET active = FALSE WHERE group_id = ${id} AND active`;
  if (candidateIds.length) {
    await tx`UPDATE public.duplicate_candidates SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
      WHERE id IN ${tx(candidateIds)} AND status = 'confirmed'`;
  }
}
/**
 * Records a duplicate-group audit entry.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.actorId - Administrator profile id.
 * @param {string} options.action - Audit action.
 * @param {*} options.previous - Previous snapshot (stored as JSON).
 * @param {{group: {id: string}}} options.current - New snapshot; `group.id` becomes the audited entity id.
 * @param {string} [options.note] - Optional note.
 * @returns {Promise<void>}
 */
export async function insertDuplicateAudit(
  tx,
  { actorId, action, previous, current, note },
) {
  await tx`INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, previous_values, new_values, note)
    VALUES (${actorId}, ${action}, 'duplicate_group', ${current.group.id},
      ${tx.json(previous)}, ${tx.json(current)}, ${note ?? null})`;
}

/**
 * Returns every pending candidate edge between non-deleted, ungrouped reports, plus those reports.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<{reports: object[], candidates: object[]}>} JSON arrays sorted by id; reports include
 *   `dog` and `location` objects, candidates include distance, time gap, and matched signals.
 */
export async function listPendingDuplicateCandidates(tx) {
  // One snapshot returns complete edges and their reviewable endpoints, including
  // visible reports absent from the moderation queue. Never truncate a graph.
  const rows = await tx`
    WITH eligible AS (
      SELECT c.id, c.report_a, c.report_b, c.status,
        c.distance_meters, c.minutes_apart, c.matched_signals
      FROM public.duplicate_candidates c
      JOIN public.reports a ON a.id = c.report_a
      JOIN public.reports b ON b.id = c.report_b
      WHERE c.status = 'pending' AND a.status <> 'deleted' AND b.status <> 'deleted'
        AND NOT EXISTS (
          SELECT 1 FROM public.duplicate_memberships m
          WHERE m.active AND m.report_id IN (c.report_a, c.report_b)
        )
    ), endpoints AS (
      SELECT report_a AS id FROM eligible UNION SELECT report_b AS id FROM eligible
    )
    SELECT
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'status', r.status, 'incident_type', r.incident_type,
        'sighting_type', r.sighting_type, 'details', r.details,
        'dog', jsonb_build_object('predominant_color', r.color_predominante,
          'size', r.tamano, 'has_collar', r.tiene_collar),
        'location', jsonb_build_object(
          'longitude', extensions.ST_X(r.location::extensions.geometry),
          'latitude', extensions.ST_Y(r.location::extensions.geometry)),
        'client_created_at', r.client_created_at
      ) ORDER BY r.id) FROM public.reports r JOIN endpoints e ON e.id = r.id), '[]'::jsonb) AS reports,
      COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM eligible e), '[]'::jsonb) AS candidates
  `;
  return rows[0];
}
