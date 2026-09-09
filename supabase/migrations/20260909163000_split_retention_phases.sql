BEGIN;

REVOKE EXECUTE ON FUNCTION app_private.run_retention() FROM app_backend;
DROP FUNCTION app_private.run_retention();
DROP FUNCTION app_private.run_retention_at(TIMESTAMPTZ);

CREATE FUNCTION app_private.prepare_retention_at(p_now TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_report_fingerprints INTEGER; v_flag_fingerprints INTEGER;
        v_photos INTEGER; v_buckets INTEGER;
BEGIN
  IF app_private.actor_role() IS DISTINCT FROM 'internal' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'internal_actor_context_required';
  END IF;
  IF p_now IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'retention_timestamp_required';
  END IF;
  UPDATE public.reports SET device_fingerprint_hash = NULL, fingerprint_expires_at = NULL
  WHERE fingerprint_expires_at <= p_now;
  GET DIAGNOSTICS v_report_fingerprints = ROW_COUNT;
  UPDATE public.report_flags SET device_fingerprint_hash = NULL, fingerprint_expires_at = NULL
  WHERE fingerprint_expires_at <= p_now;
  GET DIAGNOSTICS v_flag_fingerprints = ROW_COUNT;
  UPDATE public.photo_assets pa
  SET state = 'purge_pending'
  WHERE pa.state NOT IN ('purge_pending', 'purged')
    AND (
      (pa.state = 'approved' AND pa.purge_after IS NOT NULL AND pa.purge_after <= p_now)
      OR (pa.state IN ('processing', 'rejected')
          AND pa.processing_started_at <= p_now - interval '1 day')
      OR EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.id = pa.report_id
          AND app_private.report_is_purge_eligible(
            r.status, r.deleted_at, r.accepted_at, r.synced_at, p_now
          )
      )
    );
  GET DIAGNOSTICS v_photos = ROW_COUNT;
  DELETE FROM public.rate_limit_buckets WHERE expires_at <= p_now;
  GET DIAGNOSTICS v_buckets = ROW_COUNT;
  RETURN jsonb_build_object(
    'report_fingerprints_cleared', v_report_fingerprints,
    'flag_fingerprints_cleared', v_flag_fingerprints,
    'photos_marked_for_purge', v_photos,
    'rate_buckets_purged', v_buckets
  );
END;
$$;

CREATE FUNCTION app_private.prepare_retention()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT app_private.prepare_retention_at(now()) $$;

CREATE FUNCTION app_private.acknowledge_photo_purge(p_photo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_updated INTEGER;
BEGIN
  IF app_private.actor_role() IS DISTINCT FROM 'internal' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'internal_actor_context_required';
  END IF;
  UPDATE public.photo_assets
  SET state = 'purged', approved_object_path = NULL, purged_at = now()
  WHERE id = p_photo_id AND state = 'purge_pending';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 1 THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.photo_assets
    WHERE id = p_photo_id AND state = 'purged' AND approved_object_path IS NULL
  );
END;
$$;

CREATE FUNCTION app_private.finalize_retention_at(p_now TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_audits INTEGER; v_reports INTEGER;
BEGIN
  IF app_private.actor_role() IS DISTINCT FROM 'internal' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'internal_actor_context_required';
  END IF;
  IF p_now IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'retention_timestamp_required';
  END IF;
  DELETE FROM public.reports r
  WHERE app_private.report_is_purge_eligible(
          r.status, r.deleted_at, r.accepted_at, r.synced_at, p_now
        )
    AND NOT EXISTS (
      SELECT 1 FROM public.photo_assets pa
      WHERE pa.report_id = r.id AND pa.state <> 'purged'
    );
  GET DIAGNOSTICS v_reports = ROW_COUNT;
  DELETE FROM public.audit_log WHERE created_at <= p_now - interval '2 years';
  GET DIAGNOSTICS v_audits = ROW_COUNT;
  RETURN jsonb_build_object(
    'report_rows_purged', v_reports,
    'audit_rows_purged', v_audits
  );
END;
$$;

CREATE FUNCTION app_private.finalize_retention()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT app_private.finalize_retention_at(now()) $$;

REVOKE ALL ON FUNCTION app_private.prepare_retention_at(TIMESTAMPTZ),
  app_private.prepare_retention(),
  app_private.acknowledge_photo_purge(UUID),
  app_private.finalize_retention_at(TIMESTAMPTZ),
  app_private.finalize_retention()
  FROM PUBLIC, anon, authenticated, service_role, app_backend;
GRANT EXECUTE ON FUNCTION app_private.prepare_retention(),
  app_private.acknowledge_photo_purge(UUID),
  app_private.finalize_retention()
  TO app_backend;

COMMIT;
