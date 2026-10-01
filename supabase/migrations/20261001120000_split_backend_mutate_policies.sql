BEGIN;

-- Split the FOR ALL backend mutate policies into per-command policies.
-- A FOR ALL policy also applies to SELECT, so it overlapped the *_backend_select
-- policies and triggered the multiple_permissive_policies performance advisor.
-- app_backend has no DELETE grant (revoked) and zones has no UPDATE grant, so no
-- policies are created for those commands. Predicates are unchanged.

DROP POLICY zones_backend_mutate ON public.zone_sets;
DROP POLICY zone_geometry_backend_mutate ON public.zones;
DROP POLICY config_backend_mutate ON public.config_versions;

CREATE POLICY zones_backend_insert ON public.zone_sets FOR INSERT TO app_backend
WITH CHECK (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal');
CREATE POLICY zones_backend_update ON public.zone_sets FOR UPDATE TO app_backend
USING (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal')
WITH CHECK (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal');
CREATE POLICY zone_geometry_backend_insert ON public.zones FOR INSERT TO app_backend
WITH CHECK (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal');
CREATE POLICY config_backend_insert ON public.config_versions FOR INSERT TO app_backend
WITH CHECK (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal');
CREATE POLICY config_backend_update ON public.config_versions FOR UPDATE TO app_backend
USING (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal')
WITH CHECK (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal');

COMMIT;
