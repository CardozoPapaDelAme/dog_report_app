export async function listAcceptedAssociationReports(
  tx,
  { from, to, limit, cursor },
) {
  const rows = await tx`
    SELECT
      r.id,
      extensions.ST_X(r.location::extensions.geometry) AS longitude,
      extensions.ST_Y(r.location::extensions.geometry) AS latitude,
      r.incident_type,
      r.sighting_type,
      r.details,
      r.color_predominante,
      r.tamano,
      r.tiene_collar,
      EXISTS (
        SELECT 1
        FROM public.photo_assets pa
        WHERE pa.report_id = r.id AND pa.state = 'approved'
      ) AS has_sanitized_photo,
      r.client_created_at,
      r.accepted_at
    FROM public.reports r
    WHERE r.status = 'visible'
      AND r.accepted_at >= GREATEST(
        now() - interval '5 years',
        COALESCE(${from}::timestamptz, '-infinity'::timestamptz)
      )
      AND r.accepted_at <= LEAST(
        now(),
        COALESCE(${to}::timestamptz, 'infinity'::timestamptz)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.duplicate_memberships dm
        WHERE dm.report_id = r.id
          AND dm.active = TRUE
          AND dm.member_role = 'duplicate'
      )
      AND (
        ${cursor?.acceptedAt ?? null}::timestamptz IS NULL
        OR (r.accepted_at, r.id) < (
          ${cursor?.acceptedAt ?? null}::timestamptz,
          ${cursor?.id ?? null}::uuid
        )
      )
    ORDER BY r.accepted_at DESC, r.id DESC
    LIMIT ${limit + 1}
  `;
  return rows;
}
