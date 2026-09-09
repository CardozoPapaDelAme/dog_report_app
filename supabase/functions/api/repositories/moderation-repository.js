const QUEUE_STATUSES = ['pending_review', 'hidden'];

export async function lockReportForModeration(tx, reportId) {
  const rows = await tx`
    SELECT
      id,
      status,
      status_reason,
      previous_status,
      accepted_at,
      published_at,
      public_until,
      hidden_at,
      deleted_at
    FROM public.reports
    WHERE id = ${reportId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function approveReport(tx, reportId) {
  const rows = await tx`
    UPDATE public.reports
    SET
      previous_status = status,
      status = 'visible',
      status_reason = 'administrator_approved',
      accepted_at = COALESCE(accepted_at, now()),
      published_at = now(),
      public_until = now() + interval '90 days',
      hidden_at = NULL
    WHERE id = ${reportId}
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
  const report = rows[0];
  await tx`SELECT app_private.reset_approved_photo_public_window(${reportId})`;
  return report;
}

export async function deleteReport(tx, reportId) {
  const rows = await tx`
    UPDATE public.reports
    SET
      previous_status = status,
      status = 'deleted',
      status_reason = 'logical_deletion',
      deleted_at = now()
    WHERE id = ${reportId}
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
  return rows[0];
}

export async function insertModerationAudit(
  tx,
  { actorId, action, reportId, previousValues, newValues, note },
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
      ${actorId},
      ${action},
      'report',
      ${reportId},
      ${JSON.stringify(previousValues)}::jsonb,
      ${JSON.stringify(newValues)}::jsonb,
      ${note}
    )
  `;
}

export async function listModerationQueue(tx, { limit, cursor }) {
  const rows = cursor
    ? await tx`
        SELECT
          r.id,
          r.incident_type,
          r.sighting_type,
          r.details,
          r.color_predominante,
          r.tamano,
          r.tiene_collar,
          r.gps_accuracy_meters,
          r.mock_location_suspected,
          r.honeypot_suspected,
          r.status,
          r.status_reason,
          r.previous_status,
          r.trust_tier,
          r.trust_score,
          r.photo_validation_score,
          r.exif_consistency_score,
          r.gps_trust_score,
          r.fingerprint_trust_score,
          r.photo_expected,
          r.client_created_at,
          r.synced_at,
          r.accepted_at,
          r.published_at,
          r.public_until,
          r.hidden_at,
          r.deleted_at,
          r.flag_reviewed_at,
          extensions.ST_X(r.location::extensions.geometry) AS longitude,
          extensions.ST_Y(r.location::extensions.geometry) AS latitude,
          p.state AS photo_state,
          COALESCE(
            (
              SELECT json_agg(json_build_object(
                'id', f.id,
                'reason', f.reason,
                'reason_detail', f.reason_detail,
                'created_at', f.created_at
              ) ORDER BY f.created_at DESC)
              FROM public.report_flags f
              WHERE f.report_id = r.id
            ),
            '[]'::json
          ) AS flags,
          COALESCE(
            (
              SELECT json_agg(json_build_object(
                'id', c.id,
                'other_report_id', CASE WHEN c.report_a = r.id THEN c.report_b ELSE c.report_a END,
                'distance_meters', c.distance_meters,
                'minutes_apart', c.minutes_apart,
                'matched_signals', c.matched_signals
              ))
              FROM public.duplicate_candidates c
              WHERE c.status = 'pending'
                AND (c.report_a = r.id OR c.report_b = r.id)
            ),
            '[]'::json
          ) AS pending_duplicate_candidates,
          m.group_id AS active_group_id,
          m.member_role AS active_member_role
        FROM public.reports r
        LEFT JOIN public.photo_assets p ON p.report_id = r.id
        LEFT JOIN public.duplicate_memberships m
          ON m.report_id = r.id AND m.active = TRUE
        WHERE r.status IN ${tx(QUEUE_STATUSES)}
          AND (r.synced_at, r.id) < (${cursor.syncedAt}::timestamptz, ${cursor.id}::uuid)
        ORDER BY r.synced_at DESC, r.id DESC
        LIMIT ${limit + 1}
      `
    : await tx`
        SELECT
          r.id,
          r.incident_type,
          r.sighting_type,
          r.details,
          r.color_predominante,
          r.tamano,
          r.tiene_collar,
          r.gps_accuracy_meters,
          r.mock_location_suspected,
          r.honeypot_suspected,
          r.status,
          r.status_reason,
          r.previous_status,
          r.trust_tier,
          r.trust_score,
          r.photo_validation_score,
          r.exif_consistency_score,
          r.gps_trust_score,
          r.fingerprint_trust_score,
          r.photo_expected,
          r.client_created_at,
          r.synced_at,
          r.accepted_at,
          r.published_at,
          r.public_until,
          r.hidden_at,
          r.deleted_at,
          r.flag_reviewed_at,
          extensions.ST_X(r.location::extensions.geometry) AS longitude,
          extensions.ST_Y(r.location::extensions.geometry) AS latitude,
          p.state AS photo_state,
          COALESCE(
            (
              SELECT json_agg(json_build_object(
                'id', f.id,
                'reason', f.reason,
                'reason_detail', f.reason_detail,
                'created_at', f.created_at
              ) ORDER BY f.created_at DESC)
              FROM public.report_flags f
              WHERE f.report_id = r.id
            ),
            '[]'::json
          ) AS flags,
          COALESCE(
            (
              SELECT json_agg(json_build_object(
                'id', c.id,
                'other_report_id', CASE WHEN c.report_a = r.id THEN c.report_b ELSE c.report_a END,
                'distance_meters', c.distance_meters,
                'minutes_apart', c.minutes_apart,
                'matched_signals', c.matched_signals
              ))
              FROM public.duplicate_candidates c
              WHERE c.status = 'pending'
                AND (c.report_a = r.id OR c.report_b = r.id)
            ),
            '[]'::json
          ) AS pending_duplicate_candidates,
          m.group_id AS active_group_id,
          m.member_role AS active_member_role
        FROM public.reports r
        LEFT JOIN public.photo_assets p ON p.report_id = r.id
        LEFT JOIN public.duplicate_memberships m
          ON m.report_id = r.id AND m.active = TRUE
        WHERE r.status IN ${tx(QUEUE_STATUSES)}
        ORDER BY r.synced_at DESC, r.id DESC
        LIMIT ${limit + 1}
      `;

  return rows;
}
