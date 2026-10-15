-- Removes the demo data created by scripts/demo-seed.sql (see docs/DEMO_DATA.md).
--
-- Run as the database owner (Supabase SQL editor or psql as `postgres`). It only
-- touches reports whose id starts with the demo marker `de300000-0000-4000-8000-`
-- and their dependent rows; every other report stays untouched.
--
-- Photo objects live in the private Storage bucket and Supabase rejects direct
-- DELETEs on storage.objects, so this script never deletes them itself. Instead:
--   * demo reports without a stored photo object are deleted right away
--     (photo_assets, report_flags, duplicate rows go with them through
--     ON DELETE CASCADE);
--   * demo photos that still have a stored object are marked `purge_pending`,
--     and their reports are logically deleted so they leave the public map, the
--     association dashboard and the moderation queue immediately;
--   * the existing retention job (POST /api/internal/retention/run) deletes
--     every `purge_pending` object from Storage and acknowledges it as `purged`;
--   * running this script again afterwards deletes the remaining demo reports.
-- The final SELECT reports how many demo rows are still waiting for that purge.
--
-- Audit log rows are append-only evidence and are never deleted here; moderation
-- actions taken on demo reports during the demo stay in public.audit_log.
BEGIN;

-- 1. Demo photos with a stored object wait for the retention job.
UPDATE public.photo_assets
SET state = 'purge_pending'
WHERE report_id::text LIKE 'de300000-0000-4000-8000-%'
  AND approved_object_path IS NOT NULL
  AND state IN ('processing', 'approved', 'rejected');

-- 2. Hide their reports everywhere right now (reversible logical deletion).
UPDATE public.reports r
SET status = 'deleted',
    status_reason = 'logical_deletion',
    previous_status = r.status,
    deleted_at = now()
WHERE r.id::text LIKE 'de300000-0000-4000-8000-%'
  AND r.status <> 'deleted'
  AND EXISTS (
    SELECT 1 FROM public.photo_assets pa
    WHERE pa.report_id = r.id
      AND pa.state = 'purge_pending'
      AND pa.approved_object_path IS NOT NULL
  );

-- 3. Clear flags and duplicate rows of those waiting reports as well.
DELETE FROM public.report_flags
WHERE report_id::text LIKE 'de300000-0000-4000-8000-%';
DELETE FROM public.duplicate_candidates
WHERE report_a::text LIKE 'de300000-0000-4000-8000-%'
   OR report_b::text LIKE 'de300000-0000-4000-8000-%';
DELETE FROM public.duplicate_memberships
WHERE report_id::text LIKE 'de300000-0000-4000-8000-%';
DELETE FROM public.duplicate_groups
WHERE canonical_report_id::text LIKE 'de300000-0000-4000-8000-%';

-- 4. Delete every demo report that no longer has a stored photo object.
DELETE FROM public.reports r
WHERE r.id::text LIKE 'de300000-0000-4000-8000-%'
  AND NOT EXISTS (
    SELECT 1 FROM public.photo_assets pa
    WHERE pa.report_id = r.id
      AND pa.state = 'purge_pending'
      AND pa.approved_object_path IS NOT NULL
  );

-- Summary: 0 / 0 means the demo data is completely gone.
SELECT
  (SELECT count(*) FROM public.reports
   WHERE id::text LIKE 'de300000-0000-4000-8000-%') AS demo_reports_remaining,
  (SELECT count(*) FROM public.photo_assets
   WHERE report_id::text LIKE 'de300000-0000-4000-8000-%'
     AND state = 'purge_pending') AS demo_photos_awaiting_storage_purge;

COMMIT;
