/**
 * @module repositories/configurationRepository
 * SQL access for operational configuration versions (`public.config_versions`). Every function runs on a
 * caller-provided transaction; the configuration Service owns authorization (ADR-019) and orchestration.
 */
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} userId - Profile id of the caller.
 * @returns {Promise<{id: string, role: string, active: boolean} | null>} The actor's profile, or null.
 */
export async function readConfigurationActor(tx, userId) {
  const rows = await tx`
    SELECT id, role, active FROM public.profiles WHERE id = ${userId}
  `;
  return rows[0] ?? null;
}

/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<string | null>} The deployment environment, or null when missing.
 */
export async function readConfigurationEnvironment(tx) {
  const rows = await tx`
    SELECT environment FROM public.deployment_metadata WHERE singleton = TRUE
  `;
  return rows[0]?.environment ?? null;
}

/**
 * Takes a transaction-scoped advisory lock that serializes configuration publishing per environment
 * (`staging` and every other value map to different keys).
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} environment - Deployment environment.
 * @returns {Promise<void>}
 */
export async function lockConfigurationEnvironment(tx, environment) {
  // A stable lock per environment also covers an environment with no versions.
  // Unlike locking the active row, this lock survives replacement of that row.
  await tx`SELECT pg_catalog.pg_advisory_xact_lock(102001, ${environment === 'staging' ? 1 : 2})`;
}

/**
 * Reads the active configuration version and the active zone set for an environment in one query.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} environment - Deployment environment.
 * @returns {Promise<{configuration: object | null, zone_set: object | null}>} Each value is a JSON
 *   object of the respective row, or null when none is active.
 */
export async function readActiveConfiguration(tx, environment) {
  const rows = await tx`
    SELECT
      (SELECT to_jsonb(c) FROM public.config_versions c
       WHERE c.environment = ${environment} AND c.is_active) AS configuration,
      (SELECT jsonb_build_object(
        'id', z.id, 'environment', z.environment, 'version', z.version,
        'name', z.name, 'source_uri', z.source_uri, 'source_version', z.source_version,
        'source_sha256', z.source_sha256, 'status', z.status,
        'association_approval_reference', z.association_approval_reference,
        'approved_at', z.approved_at, 'activated_at', z.activated_at, 'retired_at', z.retired_at
      ) FROM public.zone_sets z
       WHERE z.environment = ${environment} AND z.status = 'active') AS zone_set
  `;
  return rows[0];
}

/**
 * Inserts an inactive configuration version numbered after the environment's latest version.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.environment - Deployment environment.
 * @param {string} options.actorId - Administrator profile id stored as `created_by`.
 * @param {import('../domain/configuration.js').ConfigurationValues} options.values - Validated values.
 * @returns {Promise<string>} New version id.
 */
export async function insertConfigurationVersion(tx, { environment, actorId, values }) {
  const rows = await tx`
    INSERT INTO public.config_versions (
      environment, version, is_active, flag_auto_hide_threshold,
      duplicate_radius_meters, duplicate_time_window_minutes,
      trust_high_threshold, trust_medium_threshold, gps_accuracy_max_meters,
      report_rate_limit_per_hour, flag_rate_limit_per_hour,
      photo_dog_probability_min, change_note, created_by
    ) VALUES (
      ${environment},
      (SELECT COALESCE(MAX(version), 0) + 1 FROM public.config_versions WHERE environment = ${environment}),
      FALSE, ${values.flag_auto_hide_threshold}, ${values.duplicate_radius_meters},
      ${values.duplicate_time_window_minutes}, ${values.trust_high_threshold},
      ${values.trust_medium_threshold}, ${values.gps_accuracy_max_meters},
      ${values.report_rate_limit_per_hour}, ${values.flag_rate_limit_per_hour},
      ${values.photo_dog_probability_min},
      ${values.change_note}, ${actorId}
    ) RETURNING id
  `;
  return rows[0].id;
}

/**
 * Makes one version the environment's only active version.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.environment - Deployment environment.
 * @param {string} options.id - Version id to activate.
 * @returns {Promise<void>}
 * @throws {Error} When the activation does not update exactly one row.
 */
export async function activateConfigurationVersion(tx, { environment, id }) {
  // Deactivate before activating to respect the immediate partial unique index.
  await tx`
    UPDATE public.config_versions SET is_active = FALSE
    WHERE environment = ${environment} AND is_active
  `;
  const rows = await tx`
    UPDATE public.config_versions SET is_active = TRUE
    WHERE environment = ${environment} AND id = ${id}
    RETURNING id
  `;
  if (rows.length !== 1) throw new Error('Configuration activation did not update one row.');
}

/**
 * Records a `configuration_published` audit entry.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.actorId - Administrator profile id.
 * @param {*} options.previous - Previous active configuration snapshot (stored as JSON).
 * @param {{id: string}} options.current - New configuration snapshot; `id` becomes the audited entity id.
 * @param {string} options.note - Change note.
 * @returns {Promise<void>}
 */
export async function insertConfigurationAudit(tx, { actorId, previous, current, note }) {
  await tx`
    INSERT INTO public.audit_log (
      actor_id, action, entity_type, entity_id, previous_values, new_values, note
    ) VALUES (
      ${actorId}, 'configuration_published', 'configuration', ${current.id},
      ${tx.json(previous)}, ${tx.json(current)}, ${note}
    )
  `;
}
