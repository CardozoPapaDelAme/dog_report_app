BEGIN;

CREATE FUNCTION app_private.requested_report_id()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(pg_catalog.current_setting('app.report_id', true), '')::UUID
$$;

REVOKE EXECUTE ON FUNCTION app_private.requested_report_id() FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY reports_backend_select ON public.reports;
CREATE POLICY reports_backend_select ON public.reports FOR SELECT TO app_backend USING (
  app_private.actor_role() = 'internal'
  OR app_private.is_active_actor('administrator')
  OR (app_private.is_active_actor('association') AND status = 'visible'
      AND accepted_at >= now() - interval '5 years' AND NOT app_private.is_noncanonical(id))
  OR (app_private.actor_role() = 'anonymous' AND (
      (status = 'visible' AND public_until > now() AND NOT app_private.is_noncanonical(id))
      OR device_fingerprint_hash = app_private.origin_hash()
      OR id = app_private.requested_report_id()
  ))
);

GRANT EXECUTE ON FUNCTION app_private.requested_report_id() TO app_backend;

COMMIT;
