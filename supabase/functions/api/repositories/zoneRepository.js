/**
 * @module repositories/zoneRepository
 * SQL access for zone sets (`public.zone_sets`) and their zones (`public.zones`). Every function runs on
 * a caller-provided transaction; the zone Service owns authorization (ADR-019) and validation via
 * `domain/zoneSet.js`.
 */
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} userId - Profile id of the caller.
 * @returns {Promise<{id: string, role: string, active: boolean} | null>}
 */
export async function readZoneActor(tx, userId) {
  const rows =
    await tx`SELECT id, role, active FROM public.profiles WHERE id = ${userId}`;
  return rows[0] ?? null;
}

/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<string | null>} The deployment environment, or null when missing.
 */
export async function readZoneEnvironment(tx) {
  const rows = await tx`
    SELECT environment FROM public.deployment_metadata WHERE singleton = TRUE
  `;
  return rows[0]?.environment ?? null;
}

/**
 * Takes the transaction-scoped advisory lock that serializes zone-set changes per environment.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} environment - Deployment environment.
 * @returns {Promise<void>}
 */
export async function lockZoneEnvironment(tx, environment) {
  // A distinct stable advisory lock serializes both version allocation and
  // active-set replacement, including environments with no current active set.
  await tx`SELECT pg_catalog.pg_advisory_xact_lock(102002, ${
    environment === "staging" ? 1 : 2
  })`;
}

/**
 * Inserts a `draft` zone set with the next version number and one zone built from its canonical geometry.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.environment - Deployment environment.
 * @param {string} options.actorId - Administrator profile id.
 * @param {import('../domain/zoneSet.js').ZoneSetCreation} options.values - Validated creation values.
 * @returns {Promise<string | undefined>} New zone set id.
 */
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

/**
 * @typedef {object} ZoneSetRow
 * @property {string} id
 * @property {string} environment
 * @property {number} version
 * @property {string} name
 * @property {string} source_uri
 * @property {string} source_version
 * @property {string} source_sha256
 * @property {object} source_geojson - Normalized MultiPolygon geometry.
 * @property {string} status - `draft`, `active`, or `retired`.
 * @property {string | null} association_approval_reference
 * @property {Date | null} approved_at
 * @property {Date | null} activated_at
 * @property {Date | null} retired_at
 * @property {string} created_by
 * @property {Date} created_at
 */
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.environment - Deployment environment.
 * @param {string} options.id - Zone set id.
 * @param {boolean} [options.forUpdate] - Lock the row `FOR UPDATE`.
 * @returns {Promise<ZoneSetRow | null>}
 */
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

/**
 * Locks and returns the environment's active zone sets (at most one is expected).
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} environment - Deployment environment.
 * @returns {Promise<ZoneSetRow[]>}
 */
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

/**
 * Retires the environment's active zone set and activates the given draft with the approval reference.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.environment - Deployment environment.
 * @param {string} options.id - Draft zone set id.
 * @param {string} options.associationApprovalReference - Association approval evidence.
 * @returns {Promise<void>}
 * @throws {Error} When the draft row was not updated.
 */
export async function activateZoneSet(
  tx,
  { environment, id, associationApprovalReference },
) {
  await tx`
    UPDATE public.zone_sets
    -- A waiting transaction may have begun before the active row it now
    -- replaces. Use the wall clock rather than transaction-start now() so the
    -- lifecycle evidence can never precede that row's activation.
    SET status = 'retired',
      retired_at = GREATEST(pg_catalog.clock_timestamp(), activated_at)
    WHERE environment = ${environment} AND status = 'active'
  `;
  const rows = await tx`
    WITH activation_time AS (
      SELECT pg_catalog.clock_timestamp() AS value
    )
    UPDATE public.zone_sets AS zone_set
    SET status = 'active', association_approval_reference = ${associationApprovalReference},
      approved_at = activation_time.value, activated_at = activation_time.value
    FROM activation_time
    WHERE zone_set.environment = ${environment} AND zone_set.id = ${id}
      AND zone_set.status = 'draft'
    RETURNING zone_set.id
  `;
  if (rows.length !== 1) {
    throw new Error("Zone set activation did not update one draft row.");
  }
}

/**
 * Records a zone-set audit entry.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.actorId - Administrator profile id.
 * @param {string} options.action - Audit action.
 * @param {*} options.previous - Previous snapshot (stored as JSON).
 * @param {{id: string}} options.current - New snapshot; `id` becomes the audited entity id.
 * @param {string | null} options.note - Optional note.
 * @returns {Promise<void>}
 */
export async function insertZoneAudit(
  tx,
  { actorId, action, previous, current, note },
) {
  await tx`
    INSERT INTO public.audit_log (
      actor_id, action, entity_type, entity_id, previous_values, new_values, note
    ) VALUES (
      ${actorId}, ${action}, 'zone_set', ${current.id},
      ${tx.json(previous)}, ${tx.json(current)}, ${note}
    )
  `;
}
