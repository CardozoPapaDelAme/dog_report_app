export async function readZoneActor(tx, userId) {
  const rows = await tx`SELECT id, role, active FROM public.profiles WHERE id = ${userId}`;
  return rows[0] ?? null;
}

export async function readZoneEnvironment(tx) {
  const rows = await tx`
    SELECT environment FROM public.deployment_metadata WHERE singleton = TRUE
  `;
  return rows[0]?.environment ?? null;
}

export async function lockZoneEnvironment(tx, environment) {
  // A distinct stable advisory lock serializes both version allocation and
  // active-set replacement, including environments with no current active set.
  await tx`SELECT pg_catalog.pg_advisory_xact_lock(102002, ${environment === 'staging' ? 1 : 2})`;
}

export async function insertZoneSet(tx, { environment, actorId, values }) {
  const rows = await tx`
    WITH created AS (
      INSERT INTO public.zone_sets (
        environment, version, name, source_uri, source_version, source_sha256,
        source_geojson, status, created_by
      ) VALUES (
        ${environment},
        (SELECT COALESCE(MAX(version), 0) + 1 FROM public.zone_sets WHERE environment = ${environment}),
        ${values.name}, ${values.source_uri}, ${values.source_version}, ${values.source_sha256},
        ${tx.json(values.geometry)}, 'draft', ${actorId}
      ) RETURNING id
    ), inserted_zone AS (
      INSERT INTO public.zones (zone_set_id, name, boundary)
      SELECT id, ${values.name},
        extensions.ST_Multi(extensions.ST_SetSRID(
          extensions.ST_GeomFromGeoJSON(${values.canonical_geometry}), 4326
        ))::extensions.geography
      FROM created
    )
    SELECT id FROM created
  `;
  return rows[0]?.id;
}

export async function readZoneSet(tx, { environment, id, forUpdate = false }) {
  if (forUpdate) {
    const rows = await tx`
      SELECT id, environment, version, name, source_uri, source_version, source_sha256,
        source_geojson, status, association_approval_reference, approved_at, activated_at,
        retired_at, created_by, created_at
      FROM public.zone_sets
      WHERE environment = ${environment} AND id = ${id}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }
  const rows = await tx`
    SELECT id, environment, version, name, source_uri, source_version, source_sha256,
      source_geojson, status, association_approval_reference, approved_at, activated_at,
      retired_at, created_by, created_at
    FROM public.zone_sets
    WHERE environment = ${environment} AND id = ${id}
  `;
  return rows[0] ?? null;
}

export async function readActiveZoneSets(tx, environment) {
  return tx`
    SELECT id, environment, version, name, source_uri, source_version, source_sha256,
      source_geojson, status, association_approval_reference, approved_at, activated_at,
      retired_at, created_by, created_at
    FROM public.zone_sets
    WHERE environment = ${environment} AND status = 'active'
    FOR UPDATE
  `;
}

export async function activateZoneSet(tx, { environment, id, associationApprovalReference }) {
  await tx`
    UPDATE public.zone_sets
    SET status = 'retired', retired_at = now()
    WHERE environment = ${environment} AND status = 'active'
  `;
  const rows = await tx`
    UPDATE public.zone_sets
    SET status = 'active', association_approval_reference = ${associationApprovalReference},
      approved_at = now(), activated_at = now()
    WHERE environment = ${environment} AND id = ${id} AND status = 'draft'
    RETURNING id
  `;
  if (rows.length !== 1) throw new Error('Zone set activation did not update one draft row.');
}

export async function insertZoneAudit(tx, { actorId, action, previous, current, note }) {
  await tx`
    INSERT INTO public.audit_log (
      actor_id, action, entity_type, entity_id, previous_values, new_values, note
    ) VALUES (
      ${actorId}, ${action}, 'zone_set', ${current.id},
      ${tx.json(previous)}, ${tx.json(current)}, ${note}
    )
  `;
}
