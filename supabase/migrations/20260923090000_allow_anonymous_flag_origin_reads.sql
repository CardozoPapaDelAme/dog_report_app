BEGIN;

DROP POLICY IF EXISTS flags_backend_select ON public.report_flags;

CREATE POLICY flags_backend_select ON public.report_flags FOR SELECT TO app_backend
USING (
  app_private.actor_role() = 'internal'
  OR app_private.is_active_actor('administrator')
  OR (
    app_private.actor_role() = 'anonymous'
    AND report_id = app_private.requested_report_id()
    AND EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id
        AND r.status = 'visible'
        AND r.public_until > now()
        AND NOT app_private.is_noncanonical(r.id)
    )
  )
);

COMMIT;
