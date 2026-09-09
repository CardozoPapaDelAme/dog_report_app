BEGIN;

CREATE FUNCTION app_private.reset_approved_photo_public_window(p_report_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_active_actor('administrator'::public.user_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'active_administrator_context_required';
  END IF;

  UPDATE public.photo_assets pa
  SET purge_after = r.public_until
  FROM public.reports r
  WHERE r.id = p_report_id
    AND r.id = pa.report_id
    AND r.status = 'visible'
    AND r.public_until IS NOT NULL
    AND pa.state = 'approved';
END;
$$;

REVOKE ALL ON FUNCTION app_private.reset_approved_photo_public_window(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.reset_approved_photo_public_window(UUID)
  TO app_backend;

COMMIT;
