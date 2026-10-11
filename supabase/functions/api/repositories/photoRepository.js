/**
 * @module repositories/photoRepository
 * SQL access for report photos (`public.photo_assets`): origin-scoped status reads, upload locking,
 * the `processing` -> `approved` / `rejected` lifecycle, and role-scoped download lookup.
 * Every function runs on a caller-provided transaction.
 */
/**
 * Reads photo status for a report submitted from the given origin.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.reportId - Report id.
 * @param {string} options.originHash - Hashed origin fingerprint that must match the report.
 * @returns {Promise<{report_id: string, photo_expected: boolean, state: string | null, source_sha256: string | null, rejection_code: string | null} | null>}
 *   Null when the report does not exist for that origin; photo fields are null when no photo exists.
 */
export async function readPhotoStatusForOrigin(tx, { reportId, originHash }) {
  const rows = await tx`
    SELECT
      r.id AS report_id,
      r.photo_expected,
      pa.state,
      pa.source_sha256,
      pa.rejection_code
    FROM public.reports r
    LEFT JOIN public.photo_assets pa ON pa.report_id = r.id
    WHERE r.id = ${reportId}
      AND r.device_fingerprint_hash = ${originHash}
  `;
  return rows[0] ?? null;
}

/**
 * Locks a report `FOR UPDATE` when it belongs to the given origin.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.reportId - Report id.
 * @param {string} options.originHash - Hashed origin fingerprint.
 * @returns {Promise<{id: string, photo_expected: boolean} | null>}
 */
export async function lockReportForPhotoUpload(tx, { reportId, originHash }) {
  const rows = await tx`
    SELECT
      id,
      photo_expected
    FROM public.reports
    WHERE id = ${reportId}
      AND device_fingerprint_hash = ${originHash}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/**
 * @typedef {object} PhotoAssetState
 * @property {string} report_id
 * @property {string} state - Photo lifecycle state (for example `processing`, `approved`, `rejected`).
 * @property {string} source_sha256 - SHA-256 of the uploaded source bytes.
 * @property {string | null} rejection_code
 */
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} reportId - Report id.
 * @returns {Promise<PhotoAssetState | null>} The locked photo asset, or null when none exists.
 */
export async function lockPhotoForReport(tx, reportId) {
  const rows = await tx`
    SELECT
      report_id,
      state,
      source_sha256,
      rejection_code
    FROM public.photo_assets
    WHERE report_id = ${reportId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/**
 * Inserts a photo asset in its initial state.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.reportId - Report id.
 * @param {string} options.sourceSha256 - SHA-256 of the uploaded source bytes.
 * @returns {Promise<PhotoAssetState>}
 */
export async function insertProcessingPhoto(tx, { reportId, sourceSha256 }) {
  const rows = await tx`
    INSERT INTO public.photo_assets (report_id, source_sha256)
    VALUES (${reportId}, ${sourceSha256})
    RETURNING report_id, state, source_sha256, rejection_code
  `;
  return rows[0];
}

/**
 * Moves a `processing` photo with the same source hash to `approved`, storing sanitized metadata and a
 * purge deadline aligned with the report's public window (or 90 days when it has none).
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.reportId - Report id.
 * @param {string} options.sourceSha256 - Source hash that must match the processing row.
 * @param {string} options.objectPath - Storage path of the sanitized object.
 * @param {string} options.detectedMimeType - Sniffed MIME type.
 * @param {number} options.byteSize - Sanitized size in bytes.
 * @param {number} options.widthPixels
 * @param {number} options.heightPixels
 * @param {string} options.sanitizedSha256 - SHA-256 of the sanitized bytes.
 * @returns {Promise<{report_id: string, photo_expected: boolean, state: string, rejection_code: string | null} | null>}
 *   Null when no matching `processing` row exists.
 */
export async function approvePhoto(
  tx,
  {
    reportId,
    sourceSha256,
    objectPath,
    detectedMimeType,
    byteSize,
    widthPixels,
    heightPixels,
    sanitizedSha256,
  },
) {
  const rows = await tx`
    UPDATE public.photo_assets pa
    SET
      state = 'approved',
      approved_object_path = ${objectPath},
      detected_mime_type = ${detectedMimeType},
      byte_size = ${byteSize},
      width_pixels = ${widthPixels},
      height_pixels = ${heightPixels},
      sanitized_sha256 = ${sanitizedSha256},
      rejection_code = NULL,
      approved_at = now(),
      purge_after = COALESCE(r.public_until, now() + interval '90 days')
    FROM public.reports r
    WHERE r.id = pa.report_id
      AND pa.report_id = ${reportId}
      AND pa.source_sha256 = ${sourceSha256}
      AND pa.state = 'processing'
    RETURNING
      pa.report_id,
      r.photo_expected,
      pa.state,
      pa.rejection_code
  `;
  return rows[0] ?? null;
}

/**
 * Moves a `processing` photo with the same source hash to `rejected`.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.reportId - Report id.
 * @param {string} options.sourceSha256 - Source hash that must match the processing row.
 * @param {string} options.rejectionCode - Rejection reason (see `PhotoImageError.rejectionCode`).
 * @returns {Promise<PhotoAssetState | null>} Null when no matching `processing` row exists.
 */
export async function rejectPhoto(
  tx,
  { reportId, sourceSha256, rejectionCode },
) {
  const rows = await tx`
    UPDATE public.photo_assets
    SET
      state = 'rejected',
      rejection_code = ${rejectionCode}
    WHERE report_id = ${reportId}
      AND source_sha256 = ${sourceSha256}
      AND state = 'processing'
    RETURNING report_id, state, source_sha256, rejection_code
  `;
  return rows[0] ?? null;
}

/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} userId - Profile id.
 * @returns {Promise<{id: string, role: string, active: boolean} | null>}
 */
export async function readAuthenticatedProfile(tx, userId) {
  const rows = await tx`
    SELECT id, role, active
    FROM public.profiles
    WHERE id = ${userId}
  `;
  return rows[0] ?? null;
}

/**
 * Finds an approved, unpurged photo the given role may download: anonymous callers only for publicly
 * visible non-duplicate reports, associations for visible non-duplicate reports accepted in the last
 * five years, administrators for any report.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.reportId - Report id.
 * @param {'anonymous' | 'association' | 'administrator'} options.actorRole - Caller role.
 * @returns {Promise<{approved_object_path: string, detected_mime_type: string, byte_size: number} | null>}
 */
export async function findAuthorizedPhotoForDownload(
  tx,
  { reportId, actorRole },
) {
  const rows = await tx`
    SELECT
      pa.approved_object_path,
      pa.detected_mime_type,
      pa.byte_size
    FROM public.reports r
    JOIN public.photo_assets pa ON pa.report_id = r.id
    WHERE r.id = ${reportId}
      AND pa.state = 'approved'
      AND pa.approved_object_path IS NOT NULL
      AND (pa.purge_after IS NULL OR pa.purge_after > now())
      AND (
        (
          ${actorRole} = 'anonymous'
          AND r.status = 'visible'
          AND r.public_until > now()
          AND NOT EXISTS (
            SELECT 1
            FROM public.duplicate_memberships dm
            WHERE dm.report_id = r.id
              AND dm.active = TRUE
              AND dm.member_role = 'duplicate'
          )
        )
        OR (
          ${actorRole} = 'association'
          AND r.status = 'visible'
          AND r.accepted_at >= now() - interval '5 years'
          AND NOT EXISTS (
            SELECT 1
            FROM public.duplicate_memberships dm
            WHERE dm.report_id = r.id
              AND dm.active = TRUE
              AND dm.member_role = 'duplicate'
          )
        )
        OR ${actorRole} = 'administrator'
      )
  `;
  return rows[0] ?? null;
}
