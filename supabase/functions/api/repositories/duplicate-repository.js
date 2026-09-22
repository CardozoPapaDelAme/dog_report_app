export async function readDuplicateActor(tx, id) {
  const rows =
    await tx`SELECT id, role, active FROM public.profiles WHERE id = ${id}`;
  return rows[0] ?? null;
}
export async function readDuplicateEnvironment(tx) {
  const rows =
    await tx`SELECT environment FROM public.deployment_metadata WHERE singleton = TRUE`;
  return rows[0]?.environment ?? null;
}

export async function lockDuplicateResolution(tx) {
  // Reports have no environment column: one database-wide command lock, shared
  // by resolution and reversal. Row locks additionally coordinate moderation and retention.
  await tx`SELECT pg_catalog.pg_advisory_xact_lock(103003, 1)`;
}

export async function lockDuplicateReports(tx, ids) {
  return tx`SELECT id, status FROM public.reports WHERE id IN ${
    tx(ids)
  } ORDER BY id FOR UPDATE`;
}
export async function readActiveMemberships(tx, ids) {
  return tx`SELECT group_id, report_id, member_role FROM public.duplicate_memberships
    WHERE report_id IN ${tx(ids)} AND active ORDER BY report_id`;
}
export async function lockInternalCandidates(tx, ids, status) {
  return tx`SELECT id, report_a, report_b, status, reviewed_by, reviewed_at
    FROM public.duplicate_candidates
    WHERE report_a IN ${tx(ids)} AND report_b IN ${
    tx(ids)
  } AND status = ${status}
    ORDER BY id FOR UPDATE`;
}
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
export async function confirmDuplicateCandidates(tx, { ids, actorId }) {
  return tx`UPDATE public.duplicate_candidates
    SET status = 'confirmed', reviewed_by = ${actorId}, reviewed_at = pg_catalog.clock_timestamp()
    WHERE id IN ${tx(ids)} AND status = 'pending' RETURNING id`;
}
export async function readDuplicateGroup(tx, id) {
  const rows =
    await tx`SELECT g.id, g.canonical_report_id, g.status, g.resolution_version,
      g.resolved_by, g.resolved_at, g.reversed_by, g.reversed_at, g.note,
      ARRAY(SELECT m.report_id FROM public.duplicate_memberships m WHERE m.group_id = g.id ORDER BY m.report_id) AS report_ids
    FROM public.duplicate_groups g WHERE g.id = ${id}`;
  return rows[0] ?? null;
}
export async function listActiveDuplicateGroups(tx) {
  // One SQL snapshot keeps the group and its memberships consistent during reversal.
  return tx`SELECT g.id, g.canonical_report_id, g.status, g.resolution_version,
      g.resolved_at, g.reversed_at,
      ARRAY(SELECT m.report_id FROM public.duplicate_memberships m WHERE m.group_id = g.id AND m.active ORDER BY m.report_id) AS report_ids
    FROM public.duplicate_groups g WHERE g.status = 'active'
    ORDER BY g.resolved_at DESC, g.id DESC`;
}
export async function lockDuplicateGroup(tx, id) {
  const rows =
    await tx`SELECT id, status FROM public.duplicate_groups WHERE id = ${id} FOR UPDATE`;
  return rows[0] ?? null;
}
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
export async function insertDuplicateAudit(
  tx,
  { actorId, action, previous, current, note },
) {
  await tx`INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, previous_values, new_values, note)
    VALUES (${actorId}, ${action}, 'duplicate_group', ${current.group.id},
      ${tx.json(previous)}, ${tx.json(current)}, ${note ?? null})`;
}
