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

export async function consumeFlagRateLimit(tx, { originHash, limit }) {
  const rows = await tx`
    SELECT app_private.consume_rate_limit('flag', ${originHash}, ${limit}) AS allowed
  `;
  return rows[0]?.allowed === true;
}

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
