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

export async function insertProcessingPhoto(tx, { reportId, sourceSha256 }) {
  const rows = await tx`
    INSERT INTO public.photo_assets (report_id, source_sha256)
    VALUES (${reportId}, ${sourceSha256})
    RETURNING report_id, state, source_sha256, rejection_code
  `;
  return rows[0];
}

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

export async function readAuthenticatedProfile(tx, userId) {
  const rows = await tx`
    SELECT id, role, active
    FROM public.profiles
    WHERE id = ${userId}
  `;
  return rows[0] ?? null;
}

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
