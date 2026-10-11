/**
 * @module repositories/flag-repository
 * SQL access for anonymous report flags: report locking, active flag configuration, per-origin
 * deduplication and rate limiting, automatic hiding at the flag threshold, and audit entries.
 * Every function runs on a caller-provided transaction.
 */
/**
 * Locks a report `FOR UPDATE` and returns its moderation state.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} reportId - Report id.
 * @returns {Promise<object | null>} Report status fields plus `publicly_available` and `noncanonical`
 *   flags, or null when missing.
 */
export async function lockReportForFlag(tx, reportId) {
  const rows = await tx`
    SELECT
      r.id,
      r.status,
      r.status_reason,
      r.previous_status,
      r.accepted_at,
      r.published_at,
      r.public_until,
      r.hidden_at,
      r.deleted_at,
      r.public_until > now() AS publicly_available,
      app_private.is_noncanonical(r.id) AS noncanonical
    FROM public.reports r
    WHERE r.id = ${reportId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<{id: string, flag_auto_hide_threshold: number, flag_rate_limit_per_hour: number, fingerprint_retention_days: number, server_now: Date} | null>}
 *   Active configuration for the deployment environment, or null when none is active.
 */
export async function getActiveFlagConfig(tx) {
  const rows = await tx`
    SELECT
      c.id,
      c.flag_auto_hide_threshold,
      c.flag_rate_limit_per_hour,
      c.fingerprint_retention_days,
      now() AS server_now
    FROM public.config_versions c
    JOIN public.deployment_metadata d
      ON d.singleton = TRUE
     AND d.environment = c.environment
    WHERE c.is_active = TRUE
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.reportId - Report id.
 * @param {string} options.originHash - Hashed origin fingerprint.
 * @returns {Promise<{id: string} | null>} An existing flag from that origin, or null.
 */
export async function findExistingFlagByOrigin(tx, { reportId, originHash }) {
  const rows = await tx`
    SELECT id
    FROM public.report_flags
    WHERE report_id = ${reportId}
      AND device_fingerprint_hash = ${originHash}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Consumes one unit of the origin's hourly flag budget via `app_private.consume_rate_limit`.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.originHash - Hashed origin fingerprint.
 * @param {number} options.limit - Allowed flags per hour.
 * @returns {Promise<boolean>} True when the flag is allowed.
 */
export async function consumeFlagRateLimit(tx, { originHash, limit }) {
  const rows = await tx`
    SELECT app_private.consume_rate_limit('flag', ${originHash}, ${limit}) AS allowed
  `;
  return rows[0]?.allowed === true;
}

/**
 * Inserts a flag whose fingerprint expires after the configured retention.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.reportId - Report id.
 * @param {string} options.reason - `public.flag_reason` value.
 * @param {string | null} options.detail - Optional reason detail.
 * @param {string} options.originHash - Hashed origin fingerprint.
 * @param {number} options.fingerprintRetentionDays - Days to keep the fingerprint.
 * @returns {Promise<{id: string}>}
 */
export async function insertFlag(
  tx,
  { reportId, reason, detail, originHash, fingerprintRetentionDays },
) {
  const rows = await tx`
    INSERT INTO public.report_flags (
      report_id,
      reason,
      reason_detail,
      device_fingerprint_hash,
      fingerprint_expires_at
    )
    VALUES (
      ${reportId},
      ${reason}::public.flag_reason,
      ${detail},
      ${originHash},
      now() + (${fingerprintRetentionDays} * interval '1 day')
    )
    RETURNING id
  `;
  return rows[0];
}

/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} reportId - Report id.
 * @returns {Promise<number>} Distinct unexpired origin fingerprints that flagged the report.
 */
export async function countDistinctActiveFlagOrigins(tx, reportId) {
  const rows = await tx`
    SELECT count(DISTINCT device_fingerprint_hash)::int AS distinct_origins
    FROM public.report_flags
    WHERE report_id = ${reportId}
      AND device_fingerprint_hash IS NOT NULL
      AND fingerprint_expires_at > now()
  `;
  return rows[0]?.distinct_origins ?? 0;
}

/**
 * Hides a visible report with reason `flag_threshold`.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} reportId - Report id.
 * @returns {Promise<object | null>} Updated status fields, or null when the report was not visible.
 */
export async function autoHideReportByFlags(tx, reportId) {
  const rows = await tx`
    UPDATE public.reports
    SET
      previous_status = status,
      status = 'hidden',
      status_reason = 'flag_threshold',
      hidden_at = now()
    WHERE id = ${reportId}
      AND status = 'visible'
    RETURNING
      id,
      status,
      status_reason,
      previous_status,
      accepted_at,
      published_at,
      public_until,
      hidden_at,
      deleted_at
  `;
  return rows[0] ?? null;
}

/**
 * Records a system (actorless) audit entry for a report.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.action - `public.audit_action` value.
 * @param {string} options.reportId - Report id.
 * @param {*} options.previousValues - Previous snapshot (stored as JSON).
 * @param {*} options.newValues - New snapshot (stored as JSON).
 * @returns {Promise<void>}
 */
export async function insertFlagAudit(
  tx,
  { action, reportId, previousValues, newValues },
) {
  await tx`
    INSERT INTO public.audit_log (
      actor_id,
      action,
      entity_type,
      entity_id,
      previous_values,
      new_values,
      note
    )
    VALUES (
      NULL,
      ${action}::public.audit_action,
      'report',
      ${reportId},
      ${tx.json(previousValues)},
      ${tx.json(newValues)},
      NULL
    )
  `;
}
