/**
 * @module repositories/associationReportRepository
 * Read model for associations: accepted, visible, non-duplicate reports within the last five years.
 */
/**
 * @typedef {object} AssociationReportRow
 * @property {string} id
 * @property {number} longitude
 * @property {number} latitude
 * @property {string} incident_type
 * @property {*} sighting_type
 * @property {*} details
 * @property {*} color_predominante
 * @property {*} tamano
 * @property {*} tiene_collar
 * @property {boolean} has_sanitized_photo - True when an approved photo asset exists.
 * @property {Date} client_created_at
 * @property {Date} accepted_at
 */
/**
 * Lists visible reports ordered by `accepted_at` then `id`, newest first, using keyset pagination.
 * The window is clamped to the last five years and to now.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string | null} options.from - Inclusive lower bound for `accepted_at` (ISO timestamp), or null.
 * @param {string | null} options.to - Inclusive upper bound for `accepted_at` (ISO timestamp), or null.
 * @param {number} options.limit - Page size; one extra row is fetched to detect a next page.
 * @param {{acceptedAt: string, id: string} | null | undefined} options.cursor - Keyset cursor from the previous page.
 * @returns {Promise<AssociationReportRow[]>} Up to `limit + 1` rows.
 */
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
