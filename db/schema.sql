-- Creel stray-dog reporting application: authoritative target schema.
-- PostgreSQL + PostGIS, intended for Supabase managed projects.
-- Implements RF01-RF24 and RNF01-RNF36 as amended by
-- docs/product/APPROVED-CLARIFICATIONS.md.
--
-- MANAGED PROTOTYPE TARGET:
-- * Supabase Cloud owns physical hosts, TLS, gateway/runtime operation, Auth,
--   Data API/PostgREST, Edge Functions, Storage, and PostgreSQL operation.
-- * The project owns migrations, application schemas, RLS, grants, RPCs, Edge
--   Function code, Storage policies, secrets/configuration, and data lifecycle.
-- * PostGIS and pgcrypto live in schema extensions. Confirm the managed project
--   catalogs before migrations; do not assume provider-owned physical columns.
-- * The local Supabase Docker stack is optional. Remote projects are updated with
--   a version-checked Supabase CLI from versioned migrations only, using a
--   linked-project dry run before db push. Functions deploy with explicit
--   --use-api when Docker-free bundling is required.
--
-- DEPLOYMENT READINESS:
-- * auth.users, auth.uid(), anon, authenticated, and service_role are owned by
--   the managed Supabase project and must exist before this migration is applied.
-- * Apply migrations with a dedicated NOLOGIN owner (for example app_owner).
--   SECURITY DEFINER functions execute as that owner; the owner must not be a
--   client login and must own only application objects required by the function.
-- * Every SECURITY DEFINER function fixes search_path to an empty string and
--   schema-qualifies object references, including extensions.* for PostGIS and
--   pgcrypto. Revoke PUBLIC before narrow grants.
-- * Storage buckets/policies and Auth schema details are external
--   Supabase-owned objects. Confirm the installed Supabase/Storage/Auth
--   versions before writing those migrations. Do not invent columns.
-- * The migration owner must have USAGE on schema extensions.
-- * Set deployment_metadata.environment to production only in an approved live
--   project. The default is staging so a demo/test project cannot be mistaken for
--   live; live report intake fails closed until an Association-approved geofence
--   is active.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO CURRENT_USER;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;

CREATE TYPE public.user_role AS ENUM ('association', 'administrator');
CREATE TYPE public.deployment_environment AS ENUM ('staging', 'production');
CREATE TYPE public.incident_type AS ENUM (
  'avistamiento_simple',
  'ataque_mascota',
  'ataque_ganado',
  'ataque_humano',
  'perro_lastimado',
  'otro'
);
CREATE TYPE public.sighting_type AS ENUM ('solitario', 'manada');
CREATE TYPE public.dog_size AS ENUM ('chico', 'mediano', 'grande');
CREATE TYPE public.report_status AS ENUM ('pending_review', 'visible', 'hidden', 'deleted');
CREATE TYPE public.report_status_reason AS ENUM (
  'awaiting_trust_assessment',
  'medium_or_low_trust',
  'imprecise_gps',
  'mock_location',
  'honeypot_signal',
  'high_trust_auto_publish',
  'administrator_approved',
  'administrator_hidden',
  'flag_threshold',
  'restored_for_review',
  'logical_deletion'
);
CREATE TYPE public.trust_tier AS ENUM ('unassessed', 'low', 'medium', 'high');
CREATE TYPE public.flag_reason AS ENUM (
  'foto_falsa',
  'contenido_inapropiado',
  'burla',
  'no_es_callejero',
  'incidental_pii',
  'otro'
);
CREATE TYPE public.photo_state AS ENUM (
  'processing',
  'approved',
  'rejected',
  'purge_pending',
  'purged'
);
CREATE TYPE public.duplicate_candidate_status AS ENUM ('pending', 'confirmed', 'dismissed');
CREATE TYPE public.duplicate_group_status AS ENUM ('active', 'reversed');
CREATE TYPE public.duplicate_member_role AS ENUM ('canonical', 'duplicate');
CREATE TYPE public.zone_set_status AS ENUM ('draft', 'approved', 'active', 'retired');
CREATE TYPE public.audit_action AS ENUM (
  'report_auto_hidden',
  'report_approved',
  'report_hidden',
  'report_restored',
  'report_logically_deleted',
  'duplicate_resolved',
  'duplicate_reversed',
  'configuration_published',
  'zone_set_created',
  'zone_set_activated'
);

-- Each managed project has exactly one environment marker. A live project must
-- update this row in its environment-specific migration.
CREATE TABLE public.deployment_metadata (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  environment public.deployment_environment NOT NULL DEFAULT 'staging',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.deployment_metadata (singleton, environment) VALUES (TRUE, 'staging');

-- Supabase Auth remains authoritative for credentials and sessions. Multiple
-- individually attributable accounts may share either role.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  display_name TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 120)
);

CREATE TABLE public.zone_sets (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  environment public.deployment_environment NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  source_uri TEXT NOT NULL CHECK (length(source_uri) BETWEEN 1 AND 1000),
  source_version TEXT NOT NULL CHECK (length(source_version) BETWEEN 1 AND 120),
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  status public.zone_set_status NOT NULL DEFAULT 'draft',
  association_approval_reference TEXT,
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, version),
  CHECK (status NOT IN ('approved', 'active') OR association_approval_reference IS NOT NULL),
  CHECK ((status = 'active') = (activated_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_zone_sets_one_active_per_environment
  ON public.zone_sets (environment) WHERE status = 'active';

CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  zone_set_id UUID NOT NULL REFERENCES public.zone_sets(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  boundary extensions.geography(MULTIPOLYGON, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (extensions.ST_IsValid(boundary::extensions.geometry)),
  CHECK (NOT extensions.ST_IsEmpty(boundary::extensions.geometry))
);
CREATE INDEX idx_zones_boundary ON public.zones USING GIST (boundary);

-- Typed, immutable configuration versions replace free-form key/value settings.
CREATE TABLE public.config_versions (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  environment public.deployment_environment NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  flag_auto_hide_threshold INTEGER NOT NULL CHECK (flag_auto_hide_threshold BETWEEN 2 AND 100),
  duplicate_radius_meters INTEGER NOT NULL CHECK (duplicate_radius_meters BETWEEN 10 AND 1000),
  duplicate_time_window_minutes INTEGER NOT NULL CHECK (duplicate_time_window_minutes BETWEEN 5 AND 1440),
  trust_high_threshold NUMERIC(4,3) NOT NULL CHECK (trust_high_threshold BETWEEN 0 AND 1),
  trust_medium_threshold NUMERIC(4,3) NOT NULL CHECK (trust_medium_threshold BETWEEN 0 AND 1),
  gps_accuracy_max_meters NUMERIC(7,2) NOT NULL CHECK (gps_accuracy_max_meters BETWEEN 5 AND 500),
  report_rate_limit_per_hour INTEGER NOT NULL CHECK (report_rate_limit_per_hour BETWEEN 1 AND 500),
  flag_rate_limit_per_hour INTEGER NOT NULL CHECK (flag_rate_limit_per_hour BETWEEN 1 AND 1000),
  fingerprint_retention_days INTEGER NOT NULL DEFAULT 30 CHECK (fingerprint_retention_days = 30),
  public_retention_days INTEGER NOT NULL DEFAULT 90 CHECK (public_retention_days = 90),
  business_retention_days INTEGER NOT NULL DEFAULT 1826 CHECK (business_retention_days BETWEEN 1825 AND 1827),
  audit_retention_days INTEGER NOT NULL DEFAULT 730 CHECK (audit_retention_days BETWEEN 730 AND 731),
  deleted_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (deleted_retention_days BETWEEN 365 AND 366),
  change_note TEXT NOT NULL CHECK (length(change_note) BETWEEN 1 AND 1000),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, version),
  CHECK (trust_medium_threshold < trust_high_threshold)
);
CREATE UNIQUE INDEX uq_config_one_active_per_environment
  ON public.config_versions (environment) WHERE is_active;

INSERT INTO public.config_versions (
  environment, version, is_active, flag_auto_hide_threshold,
  duplicate_radius_meters, duplicate_time_window_minutes,
  trust_high_threshold, trust_medium_threshold, gps_accuracy_max_meters,
  report_rate_limit_per_hour, flag_rate_limit_per_hour, change_note
) VALUES
  ('staging', 1, TRUE, 5, 150, 120, 0.800, 0.500, 50, 10, 30, 'Initial validated prototype defaults'),
  ('production', 1, TRUE, 5, 150, 120, 0.800, 0.500, 50, 10, 30, 'Initial validated prototype defaults');

CREATE TABLE public.reports (
  id UUID PRIMARY KEY, -- Client-generated final identity for offline idempotency.
  submission_hash TEXT NOT NULL CHECK (submission_hash ~ '^[0-9a-f]{64}$'),
  location extensions.geography(POINT, 4326) NOT NULL,
  gps_accuracy_meters NUMERIC(7,2) NOT NULL CHECK (gps_accuracy_meters > 0),
  mock_location_suspected BOOLEAN NOT NULL,
  incident_type public.incident_type NOT NULL,
  sighting_type public.sighting_type NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  color_predominante TEXT,
  tamano public.dog_size,
  tiene_collar BOOLEAN,
  photo_expected BOOLEAN NOT NULL DEFAULT FALSE,
  client_photo_check_passed BOOLEAN,
  honeypot_suspected BOOLEAN NOT NULL DEFAULT FALSE,
  status public.report_status NOT NULL DEFAULT 'pending_review',
  status_reason public.report_status_reason NOT NULL DEFAULT 'awaiting_trust_assessment',
  previous_status public.report_status,
  trust_tier public.trust_tier NOT NULL DEFAULT 'unassessed',
  trust_score NUMERIC(4,3) CHECK (trust_score BETWEEN 0 AND 1),
  photo_validation_score NUMERIC(4,3) CHECK (photo_validation_score BETWEEN 0 AND 1),
  exif_consistency_score NUMERIC(4,3) CHECK (exif_consistency_score BETWEEN 0 AND 1),
  gps_trust_score NUMERIC(4,3) CHECK (gps_trust_score BETWEEN 0 AND 1),
  fingerprint_trust_score NUMERIC(4,3) CHECK (fingerprint_trust_score BETWEEN 0 AND 1),
  device_fingerprint_hash TEXT,
  fingerprint_expires_at TIMESTAMPTZ,
  client_created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  public_until TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  flag_reviewed_at TIMESTAMPTZ,
  CHECK (jsonb_typeof(details) = 'object'),
  CHECK (color_predominante IS NULL OR length(color_predominante) BETWEEN 1 AND 80),
  CHECK ((device_fingerprint_hash IS NULL) = (fingerprint_expires_at IS NULL)),
  CHECK (status <> 'visible' OR (accepted_at IS NOT NULL AND published_at IS NOT NULL AND public_until IS NOT NULL)),
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL)),
  CHECK (previous_status IS NULL OR previous_status <> 'deleted')
);
CREATE INDEX idx_reports_location ON public.reports USING GIST (location);
CREATE INDEX idx_reports_status_public ON public.reports (status, public_until);
CREATE INDEX idx_reports_accepted_at ON public.reports (accepted_at);
CREATE INDEX idx_reports_client_created_at ON public.reports (client_created_at);
CREATE INDEX idx_reports_fingerprint ON public.reports (device_fingerprint_hash)
  WHERE device_fingerprint_hash IS NOT NULL;

-- Raw bytes and raw EXIF are never stored. The source hash supports idempotent
-- processing and is removed with this row under the photo/report retention flow.
CREATE TABLE public.photo_assets (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  report_id UUID NOT NULL UNIQUE REFERENCES public.reports(id) ON DELETE CASCADE,
  state public.photo_state NOT NULL DEFAULT 'processing',
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  approved_object_path TEXT,
  detected_mime_type TEXT,
  byte_size INTEGER CHECK (byte_size BETWEEN 1 AND 10485760),
  width_pixels INTEGER CHECK (width_pixels BETWEEN 1 AND 12000),
  height_pixels INTEGER CHECK (height_pixels BETWEEN 1 AND 12000),
  sanitized_sha256 TEXT CHECK (sanitized_sha256 ~ '^[0-9a-f]{64}$'),
  rejection_code TEXT,
  processing_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approved_object_path IS NULL OR length(approved_object_path) BETWEEN 1 AND 1000),
  CHECK (rejection_code IS NULL OR length(rejection_code) BETWEEN 1 AND 120),
  CHECK (state <> 'approved' OR (approved_object_path IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK (state <> 'rejected' OR rejection_code IS NOT NULL),
  CHECK (state <> 'purged' OR approved_object_path IS NULL)
);

CREATE TABLE public.report_flags (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  reason public.flag_reason NOT NULL,
  reason_detail TEXT CHECK (reason_detail IS NULL OR length(reason_detail) <= 1000),
  device_fingerprint_hash TEXT,
  fingerprint_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((device_fingerprint_hash IS NULL) = (fingerprint_expires_at IS NULL))
);
CREATE UNIQUE INDEX uq_flags_effective_origin
  ON public.report_flags (report_id, device_fingerprint_hash)
  WHERE device_fingerprint_hash IS NOT NULL;
CREATE INDEX idx_flags_report ON public.report_flags (report_id, created_at);

CREATE TABLE public.duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  report_a UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  report_b UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  distance_meters NUMERIC(9,2) NOT NULL CHECK (distance_meters >= 0),
  minutes_apart NUMERIC(10,2) NOT NULL CHECK (minutes_apart >= 0),
  matched_signals JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(matched_signals) = 'object'),
  status public.duplicate_candidate_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (report_a < report_b),
  UNIQUE (report_a, report_b)
);
CREATE INDEX idx_duplicate_candidates_status ON public.duplicate_candidates (status, created_at);

CREATE TABLE public.duplicate_groups (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  canonical_report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  status public.duplicate_group_status NOT NULL DEFAULT 'active',
  resolution_version INTEGER NOT NULL DEFAULT 1 CHECK (resolution_version > 0),
  resolved_by UUID NOT NULL REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_by UUID REFERENCES public.profiles(id),
  reversed_at TIMESTAMPTZ,
  note TEXT CHECK (note IS NULL OR length(note) <= 1000),
  CHECK ((status = 'reversed') = (reversed_by IS NOT NULL AND reversed_at IS NOT NULL))
);

CREATE TABLE public.duplicate_memberships (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.duplicate_groups(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  member_role public.duplicate_member_role NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, report_id)
);
CREATE UNIQUE INDEX uq_duplicate_active_membership
  ON public.duplicate_memberships (report_id) WHERE active;
CREATE UNIQUE INDEX uq_duplicate_one_canonical
  ON public.duplicate_memberships (group_id) WHERE active AND member_role = 'canonical';

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  entity_type TEXT NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 80),
  entity_id UUID,
  previous_values JSONB,
  new_values JSONB,
  note TEXT CHECK (note IS NULL OR length(note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created_at ON public.audit_log (created_at);
CREATE INDEX idx_audit_entity ON public.audit_log (entity_type, entity_id);

COMMENT ON TABLE public.reports IS 'Immutable public-submitted content plus server-controlled moderation and derived trust state. Clients insert only through submit_report.';
COMMENT ON COLUMN public.reports.client_created_at IS 'Device timestamp. New submissions must fall in [now()-30 days, now()+1 hour]. Identical replays skip this window.';
COMMENT ON TABLE public.photo_assets IS 'Private sanitized-photo processing, approval, rejection, and purge lifecycle. Raw input and raw EXIF are never persisted.';
COMMENT ON TABLE public.duplicate_groups IS 'Audited, reversible human duplicate resolution with one canonical report.';
COMMENT ON TABLE public.config_versions IS 'Typed, validated, versioned operational thresholds. Direct client mutation is prohibited.';
COMMENT ON TABLE public.zone_sets IS 'Versioned geofence metadata. source_sha256 is required. association_approval_reference cites an external Association decision; Administrator notes are not that approval.';
COMMENT ON TABLE public.audit_log IS 'Append-only audit evidence retained for two years; direct UPDATE and DELETE are prohibited.';

-- ---------------------------------------------------------------------------
-- Private helpers. They are not exposed through PostgREST's public schema.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_private.current_environment()
RETURNS public.deployment_environment
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT environment FROM public.deployment_metadata WHERE singleton = TRUE
$$;

CREATE FUNCTION app_private.has_role(required_role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND active
      AND role = required_role
      AND COALESCE((SELECT auth.jwt()->'app_metadata'->>'app_role'), '') = required_role::TEXT
  )
$$;

CREATE FUNCTION app_private.incident_severity(value public.incident_type)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE value
    WHEN 'ataque_humano' THEN 6
    WHEN 'ataque_ganado' THEN 5
    WHEN 'ataque_mascota' THEN 4
    WHEN 'perro_lastimado' THEN 3
    WHEN 'otro' THEN 2
    WHEN 'avistamiento_simple' THEN 1
  END
$$;

CREATE FUNCTION app_private.approximate_public_location(value extensions.geography)
RETURNS extensions.geography
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT extensions.ST_Transform(
    extensions.ST_SnapToGrid(extensions.ST_Transform(value::extensions.geometry, 32613), 50.0, 50.0),
    4326
  )::extensions.geography
$$;

CREATE FUNCTION app_private.write_audit(
  p_actor_id UUID,
  p_action public.audit_action,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_previous JSONB,
  p_new JSONB,
  p_note TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.audit_log (
    actor_id, action, entity_type, entity_id, previous_values, new_values, note
  ) VALUES (
    p_actor_id, p_action, p_entity_type, p_entity_id, p_previous, p_new, p_note
  )
$$;

CREATE FUNCTION app_private.validate_report_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d JSONB := NEW.details;
  allowed_keys TEXT[];
BEGIN
  IF jsonb_typeof(d) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_details_object';
  END IF;

  CASE NEW.incident_type
    WHEN 'avistamiento_simple' THEN
      allowed_keys := ARRAY['cantidad_aprox', 'descripcion'];
      IF d ? 'cantidad_aprox' AND NOT (
        jsonb_typeof(d->'cantidad_aprox') = 'number'
        AND (d->>'cantidad_aprox') ~ '^[0-9]+$'
        AND (d->>'cantidad_aprox')::INTEGER BETWEEN 1 AND 1000
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_sighting_count';
      END IF;
      IF NEW.sighting_type = 'solitario' AND d ? 'cantidad_aprox'
         AND (d->>'cantidad_aprox')::INTEGER <> 1 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_solitary_count';
      END IF;
      IF NEW.sighting_type = 'manada' AND NOT (
        d ? 'cantidad_aprox' AND jsonb_typeof(d->'cantidad_aprox') = 'number'
        AND (d->>'cantidad_aprox') ~ '^[0-9]+$'
        AND (d->>'cantidad_aprox')::INTEGER BETWEEN 2 AND 1000
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_pack_count';
      END IF;
    WHEN 'ataque_humano' THEN
      allowed_keys := ARRAY['hubo_mordida', 'descripcion'];
      IF NOT (d ? 'hubo_mordida' AND jsonb_typeof(d->'hubo_mordida') = 'boolean') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'missing_hubo_mordida';
      END IF;
    WHEN 'ataque_mascota' THEN
      allowed_keys := ARRAY['tipo_animal', 'resulto_herido', 'descripcion'];
      IF NOT (d ? 'tipo_animal' AND jsonb_typeof(d->'tipo_animal') = 'string') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'missing_pet_type';
      END IF;
      IF d ? 'resulto_herido' AND jsonb_typeof(d->'resulto_herido') <> 'boolean' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_resulto_herido';
      END IF;
    WHEN 'ataque_ganado' THEN
      allowed_keys := ARRAY['tipo_animal', 'cantidad_afectada', 'descripcion'];
      IF NOT (d ? 'tipo_animal' AND jsonb_typeof(d->'tipo_animal') = 'string') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'missing_livestock_type';
      END IF;
      IF NOT (
        d ? 'cantidad_afectada' AND jsonb_typeof(d->'cantidad_afectada') = 'number'
        AND (d->>'cantidad_afectada') ~ '^[0-9]+$'
        AND (d->>'cantidad_afectada')::INTEGER BETWEEN 1 AND 1000
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_livestock_count';
      END IF;
    WHEN 'perro_lastimado' THEN
      allowed_keys := ARRAY['situacion', 'descripcion'];
      IF NOT (
        d ? 'situacion' AND d->>'situacion' IN ('herido', 'atropellado', 'atrapado', 'mal_estado')
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_injury_situation';
      END IF;
    WHEN 'otro' THEN
      allowed_keys := ARRAY['descripcion'];
  END CASE;

  IF (d - allowed_keys) <> '{}'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'unexpected_details_key';
  END IF;
  IF d ? 'descripcion' AND (
    jsonb_typeof(d->'descripcion') <> 'string' OR length(d->>'descripcion') > 2000
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_description';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_report_details
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION app_private.validate_report_details();

-- ---------------------------------------------------------------------------
-- Public commands and minimized projections.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.submit_report(
  p_id UUID,
  p_longitude DOUBLE PRECISION,
  p_latitude DOUBLE PRECISION,
  p_gps_accuracy_meters NUMERIC,
  p_mock_location_suspected BOOLEAN,
  p_incident_type public.incident_type,
  p_sighting_type public.sighting_type,
  p_details JSONB,
  p_color_predominante TEXT,
  p_tamano public.dog_size,
  p_tiene_collar BOOLEAN,
  p_photo_expected BOOLEAN,
  p_client_photo_check_passed BOOLEAN,
  p_device_fingerprint TEXT,
  p_honeypot_filled BOOLEAN,
  p_client_created_at TIMESTAMPTZ
)
RETURNS TABLE (report_id UUID, moderation_status public.report_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_environment public.deployment_environment;
  v_location extensions.geography(POINT, 4326);
  v_gps_max NUMERIC;
  v_hash TEXT;
  v_existing_hash TEXT;
  v_reason public.report_status_reason;
BEGIN
  IF p_id IS NULL OR p_device_fingerprint IS NULL OR length(p_device_fingerprint) < 16 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_submission_identity';
  END IF;
  IF p_gps_accuracy_meters IS NULL OR p_mock_location_suspected IS NULL
     OR p_honeypot_filled IS NULL OR p_client_created_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'missing_required_submission_signal';
  END IF;
  IF p_longitude NOT BETWEEN -180 AND 180 OR p_latitude NOT BETWEEN -90 AND 90 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_coordinates';
  END IF;

  v_environment := app_private.current_environment();
  v_location := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography;
  v_hash := encode(extensions.digest(jsonb_build_object(
    'id', p_id, 'longitude', p_longitude, 'latitude', p_latitude,
    'gps_accuracy_meters', p_gps_accuracy_meters,
    'mock_location_suspected', p_mock_location_suspected,
    'incident_type', p_incident_type, 'sighting_type', p_sighting_type,
    'details', COALESCE(p_details, '{}'::jsonb),
    'color', p_color_predominante, 'size', p_tamano, 'collar', p_tiene_collar,
    'photo_expected', p_photo_expected,
    'client_photo_check_passed', p_client_photo_check_passed,
    'honeypot_filled', p_honeypot_filled,
    'device_fingerprint_hash', encode(extensions.digest(p_device_fingerprint, 'sha256'), 'hex'),
    'client_created_at', p_client_created_at
  )::TEXT, 'sha256'), 'hex');

  -- Identical replay is accepted even if the active geofence later changed.
  -- New submissions still fail closed against the current approved geofence.
  SELECT submission_hash INTO v_existing_hash
  FROM public.reports WHERE id = p_id;
  IF FOUND THEN
    IF v_existing_hash <> v_hash THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'report_id_payload_conflict';
    END IF;
    RETURN QUERY SELECT r.id, r.status FROM public.reports r WHERE r.id = p_id;
    RETURN;
  END IF;

  IF p_client_created_at > now() + interval '1 hour'
     OR p_client_created_at < now() - interval '30 days' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'client_created_at_out_of_bounds';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.zone_sets zs
    JOIN public.zones z ON z.zone_set_id = zs.id
    WHERE zs.environment = v_environment
      AND zs.status = 'active'
      AND extensions.ST_Covers(z.boundary::extensions.geometry, v_location::extensions.geometry)
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.zone_sets
      WHERE environment = v_environment AND status = 'active'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'geofence_not_configured';
    END IF;
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'location_outside_geofence';
  END IF;

  SELECT gps_accuracy_max_meters INTO STRICT v_gps_max
  FROM public.config_versions
  WHERE environment = v_environment AND is_active;

  v_reason := CASE
    WHEN p_mock_location_suspected THEN 'mock_location'::public.report_status_reason
    WHEN p_gps_accuracy_meters > v_gps_max THEN 'imprecise_gps'::public.report_status_reason
    WHEN p_honeypot_filled THEN 'honeypot_signal'::public.report_status_reason
    ELSE 'awaiting_trust_assessment'::public.report_status_reason
  END;

  INSERT INTO public.reports (
    id, submission_hash, location, gps_accuracy_meters,
    mock_location_suspected, incident_type, sighting_type, details,
    color_predominante, tamano, tiene_collar, photo_expected,
    client_photo_check_passed, honeypot_suspected, status, status_reason,
    device_fingerprint_hash, fingerprint_expires_at, client_created_at
  ) VALUES (
    p_id, v_hash, v_location, p_gps_accuracy_meters,
    p_mock_location_suspected, p_incident_type, p_sighting_type,
    COALESCE(p_details, '{}'::jsonb), p_color_predominante, p_tamano,
    p_tiene_collar, p_photo_expected, p_client_photo_check_passed,
    p_honeypot_filled,
    'pending_review', v_reason,
    encode(extensions.digest(p_device_fingerprint, 'sha256'), 'hex'), now() + interval '30 days',
    p_client_created_at
  ) ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT submission_hash INTO v_existing_hash FROM public.reports WHERE id = p_id;
    IF v_existing_hash <> v_hash THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'report_id_payload_conflict';
    END IF;
  END IF;

  RETURN QUERY SELECT r.id, r.status FROM public.reports r WHERE r.id = p_id;
END;
$$;

CREATE FUNCTION public.submit_report_flag(
  p_report_id UUID,
  p_reason public.flag_reason,
  p_reason_detail TEXT,
  p_device_fingerprint TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_threshold INTEGER;
  v_count INTEGER;
  v_previous JSONB;
BEGIN
  IF p_device_fingerprint IS NULL OR length(p_device_fingerprint) < 16 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_flag_identity';
  END IF;

  -- Lock the report before insert/count so concurrent flags cannot miss the
  -- auto-hide threshold. Non-canonical and non-public rows are not flaggable.
  SELECT jsonb_build_object('status', r.status, 'status_reason', r.status_reason)
    INTO v_previous
  FROM public.reports r
  WHERE r.id = p_report_id
    AND r.status = 'visible'
    AND r.public_until > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.duplicate_memberships dm
      WHERE dm.report_id = r.id AND dm.active AND dm.member_role = 'duplicate'
    )
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'report_not_flaggable';
  END IF;

  INSERT INTO public.report_flags (
    report_id, reason, reason_detail, device_fingerprint_hash, fingerprint_expires_at
  ) VALUES (
    p_report_id, p_reason, p_reason_detail,
    encode(extensions.digest(p_device_fingerprint, 'sha256'), 'hex'), now() + interval '30 days'
  ) RETURNING id INTO v_id;

  SELECT flag_auto_hide_threshold INTO STRICT v_threshold
  FROM public.config_versions
  WHERE environment = app_private.current_environment() AND is_active;

  SELECT count(DISTINCT device_fingerprint_hash) INTO v_count
  FROM public.report_flags
  WHERE report_id = p_report_id
    AND fingerprint_expires_at > now()
    AND device_fingerprint_hash IS NOT NULL;

  IF v_count >= v_threshold THEN
    UPDATE public.reports
    SET status = 'hidden', status_reason = 'flag_threshold', hidden_at = now()
    WHERE id = p_report_id AND status = 'visible';
    IF FOUND THEN
      PERFORM app_private.write_audit(
        NULL, 'report_auto_hidden', 'report', p_report_id, v_previous,
        jsonb_build_object('status', 'hidden', 'effective_flag_count', v_count),
        'Automatic hide at the active distinct-origin flag threshold'
      );
    END IF;
  END IF;

  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'flag_already_submitted';
END;
$$;

CREATE FUNCTION public.get_public_reports(
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  report_id UUID,
  approximate_longitude DOUBLE PRECISION,
  approximate_latitude DOUBLE PRECISION,
  incident public.incident_type,
  sighting public.sighting_type,
  public_details JSONB,
  predominant_color TEXT,
  dog_size public.dog_size,
  has_collar BOOLEAN,
  has_sanitized_photo BOOLEAN,
  occurred_at TIMESTAMPTZ,
  has_flags BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    r.id,
    extensions.ST_X(app_private.approximate_public_location(r.location)::extensions.geometry),
    extensions.ST_Y(app_private.approximate_public_location(r.location)::extensions.geometry),
    r.incident_type,
    r.sighting_type,
    r.details,
    r.color_predominante,
    r.tamano,
    r.tiene_collar,
    (pa.id IS NOT NULL),
    r.client_created_at,
    EXISTS (SELECT 1 FROM public.report_flags f WHERE f.report_id = r.id)
  FROM public.reports r
  LEFT JOIN public.photo_assets pa ON pa.report_id = r.id AND pa.state = 'approved'
    AND pa.purge_after > now()
  WHERE r.status = 'visible'
    AND r.public_until > now()
    AND (p_since IS NULL OR r.client_created_at >= p_since)
    AND NOT EXISTS (
      SELECT 1 FROM public.duplicate_memberships dm
      WHERE dm.report_id = r.id AND dm.active AND dm.member_role = 'duplicate'
    )
  ORDER BY r.client_created_at DESC, r.id
  LIMIT LEAST(GREATEST(p_limit, 1), 1000)
$$;

CREATE FUNCTION public.get_public_clusters(
  p_zoom INTEGER,
  p_min_longitude DOUBLE PRECISION DEFAULT NULL,
  p_min_latitude DOUBLE PRECISION DEFAULT NULL,
  p_max_longitude DOUBLE PRECISION DEFAULT NULL,
  p_max_latitude DOUBLE PRECISION DEFAULT NULL,
  p_limit INTEGER DEFAULT 2000
)
RETURNS TABLE (
  cluster_id INTEGER,
  report_count BIGINT,
  approximate_longitude DOUBLE PRECISION,
  approximate_latitude DOUBLE PRECISION,
  highest_severity public.incident_type,
  type_counts JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_viewport BOOLEAN;
  v_limit INTEGER;
BEGIN
  IF p_zoom IS NULL OR p_zoom < 0 OR p_zoom > 22 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_cluster_zoom';
  END IF;
  v_has_viewport := (p_min_longitude IS NOT NULL OR p_min_latitude IS NOT NULL
                     OR p_max_longitude IS NOT NULL OR p_max_latitude IS NOT NULL);
  IF v_has_viewport AND (
       p_min_longitude IS NULL OR p_min_latitude IS NULL
       OR p_max_longitude IS NULL OR p_max_latitude IS NULL
       OR p_min_longitude NOT BETWEEN -180 AND 180
       OR p_max_longitude NOT BETWEEN -180 AND 180
       OR p_min_latitude NOT BETWEEN -90 AND 90
       OR p_max_latitude NOT BETWEEN -90 AND 90
       OR p_min_longitude >= p_max_longitude
       OR p_min_latitude >= p_max_latitude
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_cluster_viewport';
  END IF;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 5000);

  RETURN QUERY
  WITH eligible AS (
    SELECT r.id, r.incident_type,
           extensions.ST_Transform(r.location::extensions.geometry, 32613) AS metric_location
    FROM public.reports r
    WHERE r.status = 'visible' AND r.public_until > now()
      AND NOT EXISTS (
        SELECT 1 FROM public.duplicate_memberships dm
        WHERE dm.report_id = r.id AND dm.active AND dm.member_role = 'duplicate'
      )
      AND (
        NOT v_has_viewport
        OR extensions.ST_Intersects(
             r.location::extensions.geometry,
             extensions.ST_MakeEnvelope(
               p_min_longitude, p_min_latitude, p_max_longitude, p_max_latitude, 4326
             )
           )
      )
    ORDER BY r.client_created_at DESC, r.id
    LIMIT v_limit
  ), clustered AS (
    SELECT *, extensions.ST_ClusterDBSCAN(
      metric_location,
      eps => CASE
        WHEN p_zoom >= 16 THEN 35
        WHEN p_zoom >= 14 THEN 75
        WHEN p_zoom >= 12 THEN 200
        WHEN p_zoom >= 10 THEN 500
        ELSE 1000
      END,
      minpoints => 1
    ) OVER () AS cid
    FROM eligible
  ), per_type AS (
    SELECT cid, incident_type, count(*) AS type_count,
           extensions.ST_Collect(metric_location) AS type_locations
    FROM clustered
    GROUP BY cid, incident_type
  ), grouped AS (
    SELECT cid,
      sum(type_count)::BIGINT AS total_count,
      extensions.ST_Collect(type_locations) AS all_locations,
      (array_agg(incident_type ORDER BY app_private.incident_severity(incident_type) DESC))[1] AS severe,
      jsonb_build_object(
        'avistamiento_simple', 0,
        'ataque_mascota', 0,
        'ataque_ganado', 0,
        'ataque_humano', 0,
        'perro_lastimado', 0,
        'otro', 0
      ) || jsonb_object_agg(incident_type::TEXT, type_count) AS counts
    FROM per_type
    GROUP BY cid
  )
  SELECT
    grouped.cid,
    grouped.total_count,
    extensions.ST_X(extensions.ST_Transform(extensions.ST_SnapToGrid(extensions.ST_Centroid(grouped.all_locations), 50.0, 50.0), 4326)),
    extensions.ST_Y(extensions.ST_Transform(extensions.ST_SnapToGrid(extensions.ST_Centroid(grouped.all_locations), 50.0, 50.0), 4326)),
    grouped.severe,
    grouped.counts
  FROM grouped
  ORDER BY grouped.cid;
END;
$$;

-- ---------------------------------------------------------------------------
-- Client photo status. Upload bytes go only to the image-specific Edge Function;
-- clients never receive Storage write access or write photo_assets directly.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.get_report_photo_status(
  p_report_id UUID,
  p_device_fingerprint TEXT
)
RETURNS TABLE (
  report_id UUID,
  photo_expected BOOLEAN,
  photo_state public.photo_state,
  rejection_code TEXT,
  processing_complete BOOLEAN,
  upload_succeeded BOOLEAN,
  local_cleanup_allowed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report public.reports%ROWTYPE;
  v_photo public.photo_assets%ROWTYPE;
  v_fingerprint_hash TEXT;
  v_complete BOOLEAN;
  v_succeeded BOOLEAN;
  v_has_photo BOOLEAN;
BEGIN
  IF p_report_id IS NULL OR p_device_fingerprint IS NULL OR length(p_device_fingerprint) < 16 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_photo_status_identity';
  END IF;
  v_fingerprint_hash := encode(extensions.digest(p_device_fingerprint, 'sha256'), 'hex');

  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'report_not_found';
  END IF;
  IF v_report.device_fingerprint_hash IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'report_photo_access_expired';
  END IF;
  IF v_report.device_fingerprint_hash <> v_fingerprint_hash THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'report_photo_access_denied';
  END IF;

  SELECT * INTO v_photo FROM public.photo_assets WHERE photo_assets.report_id = p_report_id;
  v_has_photo := FOUND;
  IF NOT v_report.photo_expected THEN
    RETURN QUERY SELECT
      p_report_id, FALSE, NULL::public.photo_state, NULL::TEXT, TRUE, FALSE, TRUE;
    RETURN;
  END IF;
  -- Completion and local cleanup are monotonic: retention states remain terminal,
  -- but only an approved sanitized object is a successful upload.
  v_complete := v_has_photo AND v_photo.state IN (
    'approved', 'rejected', 'purge_pending', 'purged'
  );
  v_succeeded := v_has_photo AND v_photo.state = 'approved';
  RETURN QUERY SELECT
    p_report_id,
    TRUE,
    CASE WHEN v_has_photo THEN v_photo.state ELSE NULL::public.photo_state END,
    CASE WHEN v_has_photo THEN v_photo.rejection_code ELSE NULL::TEXT END,
    v_complete,
    v_succeeded,
    v_complete;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trusted image Edge Function boundary. No mobile role receives EXECUTE.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.service_begin_photo_processing(
  p_report_id UUID,
  p_device_fingerprint TEXT,
  p_source_sha256 TEXT
)
RETURNS TABLE (
  photo_id UUID,
  photo_state public.photo_state,
  approved_object_path TEXT,
  rejection_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report public.reports%ROWTYPE;
  v_photo public.photo_assets%ROWTYPE;
  v_fingerprint_hash TEXT;
BEGIN
  IF p_report_id IS NULL OR p_device_fingerprint IS NULL
     OR length(p_device_fingerprint) < 16
     OR p_source_sha256 IS NULL OR lower(p_source_sha256) !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_photo_processing_identity';
  END IF;
  v_fingerprint_hash := encode(extensions.digest(p_device_fingerprint, 'sha256'), 'hex');

  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'report_not_found';
  END IF;
  IF NOT v_report.photo_expected THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'photo_not_expected';
  END IF;
  IF v_report.device_fingerprint_hash IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'report_photo_access_expired';
  END IF;
  IF v_report.device_fingerprint_hash <> v_fingerprint_hash THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'report_photo_access_denied';
  END IF;

  SELECT * INTO v_photo FROM public.photo_assets
  WHERE report_id = p_report_id FOR UPDATE;
  IF FOUND THEN
    IF v_photo.source_sha256 <> lower(p_source_sha256) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'photo_content_conflict';
    END IF;
    RETURN QUERY SELECT v_photo.id, v_photo.state,
      v_photo.approved_object_path, v_photo.rejection_code;
    RETURN;
  END IF;

  INSERT INTO public.photo_assets (report_id, state, source_sha256)
  VALUES (p_report_id, 'processing', lower(p_source_sha256))
  RETURNING * INTO v_photo;
  RETURN QUERY SELECT v_photo.id, v_photo.state,
    v_photo.approved_object_path, v_photo.rejection_code;
END;
$$;

CREATE FUNCTION public.service_register_processed_photo(
  p_report_id UUID,
  p_source_sha256 TEXT,
  p_approved_object_path TEXT,
  p_detected_mime_type TEXT,
  p_byte_size INTEGER,
  p_width_pixels INTEGER,
  p_height_pixels INTEGER,
  p_sanitized_sha256 TEXT,
  p_photo_validation_score NUMERIC,
  p_exif_consistency_score NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_photo public.photo_assets%ROWTYPE;
BEGIN
  IF p_source_sha256 IS NULL OR lower(p_source_sha256) !~ '^[0-9a-f]{64}$'
     OR p_sanitized_sha256 IS NULL OR lower(p_sanitized_sha256) !~ '^[0-9a-f]{64}$'
     OR p_approved_object_path IS NULL OR length(p_approved_object_path) NOT BETWEEN 1 AND 1000
     OR p_detected_mime_type NOT IN ('image/jpeg', 'image/png', 'image/heic')
     OR p_byte_size NOT BETWEEN 1 AND 10485760
     OR p_width_pixels NOT BETWEEN 1 AND 12000
     OR p_height_pixels NOT BETWEEN 1 AND 12000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_processed_image';
  END IF;
  SELECT * INTO v_photo FROM public.photo_assets
  WHERE report_id = p_report_id FOR UPDATE;
  IF NOT FOUND OR v_photo.source_sha256 <> lower(p_source_sha256) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'photo_processing_not_started';
  END IF;
  IF v_photo.state = 'approved' THEN
    IF v_photo.approved_object_path = p_approved_object_path
       AND v_photo.sanitized_sha256 = lower(p_sanitized_sha256) THEN
      RETURN;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'processed_photo_conflict';
  END IF;
  IF v_photo.state <> 'processing' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'photo_state_conflict';
  END IF;
  UPDATE public.photo_assets
  SET state = 'approved', approved_object_path = p_approved_object_path,
      detected_mime_type = p_detected_mime_type, byte_size = p_byte_size,
      width_pixels = p_width_pixels, height_pixels = p_height_pixels,
      sanitized_sha256 = lower(p_sanitized_sha256), approved_at = now(),
      purge_after = now() + interval '90 days'
  WHERE id = v_photo.id;
  UPDATE public.reports
  SET photo_validation_score = p_photo_validation_score,
      exif_consistency_score = p_exif_consistency_score
  WHERE id = p_report_id;
END;
$$;

CREATE FUNCTION public.service_reject_photo(
  p_report_id UUID,
  p_source_sha256 TEXT,
  p_rejection_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_photo public.photo_assets%ROWTYPE;
BEGIN
  IF p_source_sha256 IS NULL OR lower(p_source_sha256) !~ '^[0-9a-f]{64}$'
     OR p_rejection_code IS NULL OR length(trim(p_rejection_code)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_photo_rejection';
  END IF;
  SELECT * INTO v_photo FROM public.photo_assets
  WHERE report_id = p_report_id FOR UPDATE;
  IF NOT FOUND OR v_photo.source_sha256 <> lower(p_source_sha256) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'photo_processing_not_started';
  END IF;
  IF v_photo.state = 'rejected' AND v_photo.rejection_code = p_rejection_code THEN
    RETURN;
  END IF;
  IF v_photo.state <> 'processing' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'photo_state_conflict';
  END IF;
  UPDATE public.photo_assets
  SET state = 'rejected', rejection_code = p_rejection_code,
      purge_after = now() + interval '1 day'
  WHERE id = v_photo.id;
END;
$$;

CREATE FUNCTION public.service_authorize_report_photo_delivery(
  p_report_id UUID,
  p_requester_id UUID DEFAULT NULL
)
RETURNS TABLE (approved_object_path TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_role public.user_role;
BEGIN
  IF p_requester_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles
    WHERE id = p_requester_id AND active;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'photo_delivery_access_denied';
    END IF;
  END IF;

  RETURN QUERY
  SELECT pa.approved_object_path
  FROM public.reports r
  JOIN public.photo_assets pa ON pa.report_id = r.id
  WHERE r.id = p_report_id
    AND pa.state = 'approved'
    AND (pa.purge_after IS NULL OR pa.purge_after > now())
    AND (
      (
        p_requester_id IS NULL
        AND r.status = 'visible'
        AND r.public_until > now()
        AND NOT EXISTS (
          SELECT 1 FROM public.duplicate_memberships dm
          WHERE dm.report_id = r.id AND dm.active AND dm.member_role = 'duplicate'
        )
      )
      OR (
        v_role = 'association'
        AND r.status = 'visible'
        AND r.accepted_at >= now() - interval '5 years'
        AND NOT EXISTS (
          SELECT 1 FROM public.duplicate_memberships dm
          WHERE dm.report_id = r.id AND dm.active AND dm.member_role = 'duplicate'
        )
      )
      OR v_role = 'administrator'
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'photo_delivery_access_denied';
  END IF;
END;
$$;

CREATE FUNCTION public.service_apply_trust_assessment(
  p_report_id UUID,
  p_trust_score NUMERIC,
  p_photo_score NUMERIC,
  p_exif_score NUMERIC,
  p_gps_score NUMERIC,
  p_fingerprint_score NUMERIC
)
RETURNS public.report_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report public.reports%ROWTYPE;
  v_config public.config_versions%ROWTYPE;
  v_tier public.trust_tier;
  v_status public.report_status;
BEGIN
  IF p_trust_score IS NULL OR p_photo_score IS NULL OR p_exif_score IS NULL
     OR p_gps_score IS NULL OR p_fingerprint_score IS NULL
     OR p_trust_score NOT BETWEEN 0 AND 1 OR p_photo_score NOT BETWEEN 0 AND 1
     OR p_exif_score NOT BETWEEN 0 AND 1 OR p_gps_score NOT BETWEEN 0 AND 1
     OR p_fingerprint_score NOT BETWEEN 0 AND 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_trust_score';
  END IF;
  SELECT * INTO STRICT v_report FROM public.reports WHERE id = p_report_id FOR UPDATE;
  IF v_report.status = 'visible' THEN
    RETURN 'visible';
  ELSIF v_report.status <> 'pending_review' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'trust_assessment_not_allowed';
  END IF;
  SELECT * INTO STRICT v_config FROM public.config_versions
  WHERE environment = app_private.current_environment() AND is_active;

  v_tier := CASE
    WHEN p_trust_score >= v_config.trust_high_threshold THEN 'high'::public.trust_tier
    WHEN p_trust_score >= v_config.trust_medium_threshold THEN 'medium'::public.trust_tier
    ELSE 'low'::public.trust_tier
  END;

  IF v_report.mock_location_suspected THEN
    v_status := 'pending_review';
  ELSIF v_report.honeypot_suspected THEN
    v_status := 'pending_review';
  ELSIF v_report.gps_accuracy_meters > v_config.gps_accuracy_max_meters THEN
    v_status := 'pending_review';
  ELSIF v_report.photo_expected AND NOT EXISTS (
    SELECT 1 FROM public.photo_assets WHERE report_id = p_report_id AND state = 'approved'
  ) THEN
    v_status := 'pending_review';
  ELSIF v_tier = 'high' THEN
    v_status := 'visible';
  ELSE
    v_status := 'pending_review';
  END IF;

  UPDATE public.reports
  SET trust_score = p_trust_score, photo_validation_score = p_photo_score,
      exif_consistency_score = p_exif_score, gps_trust_score = p_gps_score,
      fingerprint_trust_score = p_fingerprint_score, trust_tier = v_tier,
      status = v_status,
      status_reason = CASE
        WHEN mock_location_suspected THEN 'mock_location'::public.report_status_reason
        WHEN honeypot_suspected THEN 'honeypot_signal'::public.report_status_reason
        WHEN gps_accuracy_meters > v_config.gps_accuracy_max_meters THEN 'imprecise_gps'::public.report_status_reason
        WHEN v_status = 'visible' THEN 'high_trust_auto_publish'::public.report_status_reason
        ELSE 'medium_or_low_trust'::public.report_status_reason
      END,
      accepted_at = CASE WHEN v_status = 'visible' THEN COALESCE(accepted_at, now()) ELSE accepted_at END,
      published_at = CASE WHEN v_status = 'visible' THEN now() ELSE published_at END,
      public_until = CASE WHEN v_status = 'visible' THEN now() + interval '90 days' ELSE public_until END
  WHERE id = p_report_id;

  UPDATE public.photo_assets
  SET purge_after = CASE WHEN v_status = 'visible' THEN now() + interval '90 days' ELSE purge_after END
  WHERE report_id = p_report_id AND state = 'approved';
  RETURN v_status;
END;
$$;

-- ---------------------------------------------------------------------------
-- Duplicate candidate detection. It suggests only; no visibility changes occur.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_private.detect_duplicate_candidates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_radius INTEGER;
  v_minutes INTEGER;
BEGIN
  SELECT duplicate_radius_meters, duplicate_time_window_minutes
    INTO STRICT v_radius, v_minutes
  FROM public.config_versions
  WHERE environment = app_private.current_environment() AND is_active;

  INSERT INTO public.duplicate_candidates (
    report_a, report_b, distance_meters, minutes_apart, matched_signals
  )
  SELECT
    LEAST(r.id, NEW.id), GREATEST(r.id, NEW.id),
    extensions.ST_Distance(r.location, NEW.location),
    abs(extract(epoch FROM (r.client_created_at - NEW.client_created_at)) / 60),
    jsonb_strip_nulls(jsonb_build_object(
      'same_size', CASE WHEN r.tamano = NEW.tamano AND NEW.tamano IS NOT NULL THEN TRUE END,
      'same_color', CASE WHEN lower(r.color_predominante) = lower(NEW.color_predominante)
                         AND NEW.color_predominante IS NOT NULL THEN TRUE END,
      'same_collar', CASE WHEN r.tiene_collar = NEW.tiene_collar AND NEW.tiene_collar IS NOT NULL THEN TRUE END
    ))
  FROM public.reports r
  WHERE r.id <> NEW.id AND r.status <> 'deleted'
    AND extensions.ST_DWithin(r.location, NEW.location, v_radius)
    AND abs(extract(epoch FROM (r.client_created_at - NEW.client_created_at)) / 60) <= v_minutes
    AND (
      (r.tamano = NEW.tamano AND NEW.tamano IS NOT NULL)
      OR (lower(r.color_predominante) = lower(NEW.color_predominante) AND NEW.color_predominante IS NOT NULL)
      OR (r.tiene_collar = NEW.tiene_collar AND NEW.tiene_collar IS NOT NULL)
    )
  ON CONFLICT (report_a, report_b) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_duplicate_candidates
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION app_private.detect_duplicate_candidates();

CREATE FUNCTION public.get_my_profile()
RETURNS TABLE (
  user_id UUID,
  role public.user_role,
  display_name TEXT,
  is_active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication_required';
  END IF;
  RETURN QUERY
  SELECT p.id, p.role, p.display_name, p.active
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());
END;
$$;

-- ---------------------------------------------------------------------------
-- Association projection: accepted canonical business data only, five years.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.get_association_reports(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  report_id UUID,
  exact_longitude DOUBLE PRECISION,
  exact_latitude DOUBLE PRECISION,
  incident public.incident_type,
  sighting public.sighting_type,
  business_details JSONB,
  predominant_color TEXT,
  dog_size public.dog_size,
  has_collar BOOLEAN,
  has_sanitized_photo BOOLEAN,
  occurred_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.has_role('association') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'association_role_required';
  END IF;
  RETURN QUERY
  SELECT r.id, extensions.ST_X(r.location::extensions.geometry), extensions.ST_Y(r.location::extensions.geometry),
         r.incident_type, r.sighting_type, r.details, r.color_predominante,
         r.tamano, r.tiene_collar, (pa.id IS NOT NULL),
         r.client_created_at, r.accepted_at
  FROM public.reports r
  LEFT JOIN public.photo_assets pa ON pa.report_id = r.id AND pa.state = 'approved'
    AND pa.purge_after > now()
  WHERE r.status = 'visible'
    AND r.accepted_at >= now() - interval '5 years'
    AND (p_from IS NULL OR r.client_created_at >= p_from)
    AND (p_to IS NULL OR r.client_created_at < p_to)
    AND NOT EXISTS (
      SELECT 1 FROM public.duplicate_memberships dm
      WHERE dm.report_id = r.id AND dm.active AND dm.member_role = 'duplicate'
    )
  ORDER BY r.client_created_at DESC, r.id
  LIMIT LEAST(GREATEST(p_limit, 1), 5000)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

-- ---------------------------------------------------------------------------
-- Administrator moderation/configuration projections and audited commands.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.get_administrator_moderation_queue(
  p_limit INTEGER DEFAULT 200,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  report_id UUID,
  moderation_status public.report_status,
  reason public.report_status_reason,
  exact_longitude DOUBLE PRECISION,
  exact_latitude DOUBLE PRECISION,
  gps_accuracy_meters NUMERIC,
  mock_location_suspected BOOLEAN,
  incident public.incident_type,
  sighting public.sighting_type,
  original_details JSONB,
  predominant_color TEXT,
  dog_size public.dog_size,
  has_collar BOOLEAN,
  photo_expected BOOLEAN,
  has_sanitized_photo BOOLEAN,
  trust_level public.trust_tier,
  trust_score NUMERIC,
  photo_validation_score NUMERIC,
  exif_consistency_score NUMERIC,
  gps_trust_score NUMERIC,
  fingerprint_trust_score NUMERIC,
  honeypot_suspected BOOLEAN,
  flags JSONB,
  duplicate_candidates JSONB,
  active_duplicate_group_id UUID,
  active_duplicate_member_role public.duplicate_member_role,
  occurred_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.has_role('administrator') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required';
  END IF;
  RETURN QUERY
  SELECT r.id, r.status, r.status_reason,
         extensions.ST_X(r.location::extensions.geometry), extensions.ST_Y(r.location::extensions.geometry),
         r.gps_accuracy_meters, r.mock_location_suspected,
         r.incident_type, r.sighting_type, r.details,
         r.color_predominante, r.tamano, r.tiene_collar, r.photo_expected,
         (pa.id IS NOT NULL),
         r.trust_tier, r.trust_score,
         r.photo_validation_score, r.exif_consistency_score,
         r.gps_trust_score, r.fingerprint_trust_score, r.honeypot_suspected,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'reason', f.reason, 'detail', f.reason_detail, 'created_at', f.created_at
           ) ORDER BY f.created_at)
           FROM public.report_flags f WHERE f.report_id = r.id
         ), '[]'::jsonb),
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'candidate_id', dc.id,
             'other_report_id', CASE WHEN dc.report_a = r.id THEN dc.report_b ELSE dc.report_a END,
             'distance_meters', dc.distance_meters,
             'minutes_apart', dc.minutes_apart,
             'matched_signals', dc.matched_signals,
             'status', dc.status
           ) ORDER BY dc.created_at)
           FROM public.duplicate_candidates dc
           WHERE dc.status = 'pending' AND (dc.report_a = r.id OR dc.report_b = r.id)
         ), '[]'::jsonb),
         dg.id,
         dm.member_role,
         r.client_created_at, r.synced_at
  FROM public.reports r
  LEFT JOIN public.photo_assets pa ON pa.report_id = r.id AND pa.state = 'approved'
    AND (pa.purge_after IS NULL OR pa.purge_after > now())
  LEFT JOIN public.duplicate_memberships dm ON dm.report_id = r.id AND dm.active
  LEFT JOIN public.duplicate_groups dg ON dg.id = dm.group_id AND dg.status = 'active'
  WHERE r.status IN ('pending_review', 'hidden', 'deleted')
     OR EXISTS (SELECT 1 FROM public.report_flags f WHERE f.report_id = r.id)
     OR EXISTS (
       SELECT 1 FROM public.duplicate_candidates dc
       WHERE dc.status = 'pending' AND (dc.report_a = r.id OR dc.report_b = r.id)
     )
     OR dm.active
  ORDER BY r.synced_at, r.id
  LIMIT LEAST(GREATEST(p_limit, 1), 500)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

CREATE FUNCTION public.get_administrator_active_duplicate_groups()
RETURNS TABLE (
  group_id UUID,
  canonical_report_id UUID,
  member_report_ids UUID[],
  resolved_at TIMESTAMPTZ,
  resolution_version INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.has_role('administrator') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required';
  END IF;
  RETURN QUERY
  SELECT dg.id, dg.canonical_report_id,
         ARRAY(
           SELECT dm.report_id FROM public.duplicate_memberships dm
           WHERE dm.group_id = dg.id AND dm.active ORDER BY dm.report_id
         ),
         dg.resolved_at, dg.resolution_version
  FROM public.duplicate_groups dg
  WHERE dg.status = 'active'
  ORDER BY dg.resolved_at DESC, dg.id;
END;
$$;

CREATE FUNCTION public.get_administrator_configuration()
RETURNS TABLE (
  active_configuration JSONB,
  zone_sets JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_environment public.deployment_environment;
BEGIN
  IF NOT app_private.has_role('administrator') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required';
  END IF;
  v_environment := app_private.current_environment();
  RETURN QUERY
  SELECT
    (SELECT to_jsonb(c) - ARRAY['created_by']::TEXT[]
     FROM public.config_versions c
     WHERE c.environment = v_environment AND c.is_active),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', zs.id, 'version', zs.version, 'name', zs.name,
          'source_uri', zs.source_uri, 'source_version', zs.source_version,
          'source_sha256', zs.source_sha256, 'status', zs.status,
          'association_approval_reference', zs.association_approval_reference,
          'approved_at', zs.approved_at, 'activated_at', zs.activated_at,
          'created_at', zs.created_at
        ) ORDER BY zs.version DESC
      ) FROM public.zone_sets zs WHERE zs.environment = v_environment
    ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION public.admin_approve_report(p_report_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_before JSONB;
BEGIN
  IF NOT app_private.has_role('administrator') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required';
  END IF;
  SELECT jsonb_build_object('status', status, 'reason', status_reason) INTO v_before
  FROM public.reports WHERE id = p_report_id AND status IN ('pending_review', 'hidden') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invalid_approve_transition'; END IF;
  UPDATE public.reports
  SET status = 'visible', status_reason = 'administrator_approved',
      accepted_at = COALESCE(accepted_at, now()), published_at = now(),
      public_until = now() + interval '90 days', hidden_at = NULL,
      flag_reviewed_at = now()
  WHERE id = p_report_id;
  UPDATE public.photo_assets SET purge_after = now() + interval '90 days'
  WHERE report_id = p_report_id AND state = 'approved';
  PERFORM app_private.write_audit(auth.uid(), 'report_approved', 'report', p_report_id,
    v_before, jsonb_build_object('status', 'visible'), p_note);
END;
$$;

CREATE FUNCTION public.admin_hide_report(p_report_id UUID, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_before JSONB;
BEGIN
  IF NOT app_private.has_role('administrator') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required'; END IF;
  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'moderation_note_required'; END IF;
  SELECT jsonb_build_object('status', status, 'reason', status_reason) INTO v_before
  FROM public.reports WHERE id = p_report_id AND status IN ('pending_review', 'visible') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invalid_hide_transition'; END IF;
  UPDATE public.reports SET status = 'hidden', status_reason = 'administrator_hidden', hidden_at = now()
  WHERE id = p_report_id;
  PERFORM app_private.write_audit(auth.uid(), 'report_hidden', 'report', p_report_id,
    v_before, jsonb_build_object('status', 'hidden'), p_note);
END;
$$;

CREATE FUNCTION public.admin_logical_delete_report(p_report_id UUID, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_before JSONB; v_previous public.report_status;
BEGIN
  IF NOT app_private.has_role('administrator') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required'; END IF;
  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'moderation_note_required'; END IF;
  SELECT status, jsonb_build_object('status', status, 'reason', status_reason)
    INTO v_previous, v_before FROM public.reports
  WHERE id = p_report_id AND status <> 'deleted' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invalid_delete_transition'; END IF;
  UPDATE public.reports
  SET previous_status = v_previous, status = 'deleted', status_reason = 'logical_deletion', deleted_at = now()
  WHERE id = p_report_id;
  PERFORM app_private.write_audit(auth.uid(), 'report_logically_deleted', 'report', p_report_id,
    v_before, jsonb_build_object('status', 'deleted'), p_note);
END;
$$;

CREATE FUNCTION public.admin_restore_report(p_report_id UUID, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_before JSONB;
BEGIN
  IF NOT app_private.has_role('administrator') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required'; END IF;
  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'moderation_note_required'; END IF;
  SELECT jsonb_build_object('status', status, 'reason', status_reason) INTO v_before
  FROM public.reports WHERE id = p_report_id AND status IN ('hidden', 'deleted') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invalid_restore_transition'; END IF;
  UPDATE public.reports
  SET status = 'pending_review', status_reason = 'restored_for_review',
      previous_status = NULL, deleted_at = NULL, hidden_at = NULL,
      accepted_at = NULL, published_at = NULL, public_until = NULL,
      flag_reviewed_at = now()
  WHERE id = p_report_id;
  PERFORM app_private.write_audit(auth.uid(), 'report_restored', 'report', p_report_id,
    v_before, jsonb_build_object('status', 'pending_review'), p_note);
END;
$$;

CREATE FUNCTION public.admin_resolve_duplicate_group(
  p_canonical_report_id UUID,
  p_report_ids UUID[],
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_group_id UUID; v_distinct_count INTEGER; v_connected_count INTEGER;
BEGIN
  IF NOT app_private.has_role('administrator') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required'; END IF;
  SELECT count(DISTINCT value) INTO v_distinct_count FROM unnest(p_report_ids) AS value;
  IF v_distinct_count < 2 OR NOT (p_canonical_report_id = ANY(p_report_ids)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_duplicate_group';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reports r WHERE r.id = ANY(p_report_ids) AND r.status = 'deleted'
  ) OR (SELECT count(*) FROM public.reports r WHERE r.id = ANY(p_report_ids)) <> v_distinct_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_duplicate_member';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.duplicate_memberships dm WHERE dm.report_id = ANY(p_report_ids) AND dm.active
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'active_duplicate_membership_exists';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(p_report_ids) AS member(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.duplicate_candidates dc
      WHERE dc.status = 'pending'
        AND dc.report_a = ANY(p_report_ids)
        AND dc.report_b = ANY(p_report_ids)
        AND (dc.report_a = member.id OR dc.report_b = member.id)
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'duplicate_candidates_required';
  END IF;
  WITH RECURSIVE connected AS (
    SELECT p_canonical_report_id AS id
    UNION
    SELECT CASE WHEN dc.report_a = connected.id THEN dc.report_b ELSE dc.report_a END
    FROM connected
    JOIN public.duplicate_candidates dc
      ON dc.status = 'pending'
     AND dc.report_a = ANY(p_report_ids)
     AND dc.report_b = ANY(p_report_ids)
     AND (dc.report_a = connected.id OR dc.report_b = connected.id)
  )
  SELECT count(*) INTO v_connected_count FROM connected;
  IF v_connected_count <> v_distinct_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'duplicate_group_not_connected';
  END IF;

  INSERT INTO public.duplicate_groups (canonical_report_id, resolved_by, note)
  VALUES (p_canonical_report_id, auth.uid(), p_note) RETURNING id INTO v_group_id;
  INSERT INTO public.duplicate_memberships (group_id, report_id, member_role)
  SELECT v_group_id, value,
         CASE WHEN value = p_canonical_report_id THEN 'canonical'::public.duplicate_member_role
              ELSE 'duplicate'::public.duplicate_member_role END
  FROM (SELECT DISTINCT unnest(p_report_ids) AS value) members;
  UPDATE public.duplicate_candidates
  SET status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE report_a = ANY(p_report_ids) AND report_b = ANY(p_report_ids);
  PERFORM app_private.write_audit(auth.uid(), 'duplicate_resolved', 'duplicate_group', v_group_id,
    NULL, jsonb_build_object('canonical_report_id', p_canonical_report_id, 'report_ids', p_report_ids), p_note);
  RETURN v_group_id;
END;
$$;

CREATE FUNCTION public.admin_reverse_duplicate_group(p_group_id UUID, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_report_ids UUID[];
BEGIN
  IF NOT app_private.has_role('administrator') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required'; END IF;
  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'reversal_note_required'; END IF;
  SELECT array_agg(report_id) INTO v_report_ids FROM public.duplicate_memberships
  WHERE group_id = p_group_id AND active;
  IF v_report_ids IS NULL THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'active_duplicate_group_not_found'; END IF;
  UPDATE public.duplicate_groups
  SET status = 'reversed', reversed_by = auth.uid(), reversed_at = now()
  WHERE id = p_group_id AND status = 'active';
  UPDATE public.duplicate_memberships SET active = FALSE WHERE group_id = p_group_id AND active;
  UPDATE public.duplicate_candidates SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
  WHERE report_a = ANY(v_report_ids) AND report_b = ANY(v_report_ids);
  PERFORM app_private.write_audit(auth.uid(), 'duplicate_reversed', 'duplicate_group', p_group_id,
    jsonb_build_object('report_ids', v_report_ids), jsonb_build_object('status', 'reversed'), p_note);
END;
$$;

CREATE FUNCTION public.admin_publish_configuration(
  p_flag_auto_hide_threshold INTEGER,
  p_duplicate_radius_meters INTEGER,
  p_duplicate_time_window_minutes INTEGER,
  p_trust_high_threshold NUMERIC,
  p_trust_medium_threshold NUMERIC,
  p_gps_accuracy_max_meters NUMERIC,
  p_report_rate_limit_per_hour INTEGER,
  p_flag_rate_limit_per_hour INTEGER,
  p_change_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_environment public.deployment_environment; v_version INTEGER; v_id UUID; v_old JSONB;
BEGIN
  IF NOT app_private.has_role('administrator') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required'; END IF;
  v_environment := app_private.current_environment();
  SELECT to_jsonb(c), version + 1 INTO v_old, v_version
  FROM public.config_versions c WHERE environment = v_environment AND is_active FOR UPDATE;
  UPDATE public.config_versions SET is_active = FALSE WHERE environment = v_environment AND is_active;
  INSERT INTO public.config_versions (
    environment, version, is_active, flag_auto_hide_threshold,
    duplicate_radius_meters, duplicate_time_window_minutes,
    trust_high_threshold, trust_medium_threshold, gps_accuracy_max_meters,
    report_rate_limit_per_hour, flag_rate_limit_per_hour, change_note, created_by
  ) VALUES (
    v_environment, v_version, TRUE, p_flag_auto_hide_threshold,
    p_duplicate_radius_meters, p_duplicate_time_window_minutes,
    p_trust_high_threshold, p_trust_medium_threshold, p_gps_accuracy_max_meters,
    p_report_rate_limit_per_hour, p_flag_rate_limit_per_hour, p_change_note, auth.uid()
  ) RETURNING id INTO v_id;
  PERFORM app_private.write_audit(auth.uid(), 'configuration_published', 'config_version', v_id,
    v_old, jsonb_build_object('version', v_version), p_change_note);
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.admin_create_zone_set(
  p_name TEXT,
  p_source_uri TEXT,
  p_source_version TEXT,
  p_source_sha256 TEXT,
  p_boundary_geojson JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_environment public.deployment_environment; v_version INTEGER; v_id UUID; v_geometry extensions.geometry;
BEGIN
  IF NOT app_private.has_role('administrator') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required'; END IF;
  IF p_source_sha256 IS NULL OR lower(p_source_sha256) !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_source_sha256';
  END IF;
  v_environment := app_private.current_environment();
  v_geometry := extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_boundary_geojson::TEXT), 4326);
  IF extensions.GeometryType(v_geometry) NOT IN ('POLYGON', 'MULTIPOLYGON') OR NOT extensions.ST_IsValid(v_geometry)
     OR extensions.ST_IsEmpty(v_geometry) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_zone_geometry';
  END IF;
  IF NOT extensions.ST_CoveredBy(v_geometry, extensions.ST_MakeEnvelope(-109.1, 25.5, -103.0, 31.8, 4326))
     OR extensions.ST_Area(v_geometry::extensions.geography) NOT BETWEEN 1000 AND 10000000000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'zone_outside_chihuahua_sanity_bounds';
  END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v_version
  FROM public.zone_sets WHERE environment = v_environment;
  INSERT INTO public.zone_sets (
    environment, version, name, source_uri, source_version, source_sha256, created_by
  ) VALUES (
    v_environment, v_version, p_name, p_source_uri, p_source_version,
    lower(p_source_sha256), auth.uid()
  ) RETURNING id INTO v_id;
  INSERT INTO public.zones (zone_set_id, name, boundary)
  VALUES (v_id, p_name, extensions.ST_Multi(v_geometry)::extensions.geography);
  PERFORM app_private.write_audit(auth.uid(), 'zone_set_created', 'zone_set', v_id,
    NULL, jsonb_build_object('version', v_version, 'source_sha256', lower(p_source_sha256)), NULL);
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.admin_activate_zone_set(
  p_zone_set_id UUID,
  p_association_approval_reference TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_environment public.deployment_environment; v_old_id UUID;
BEGIN
  IF NOT app_private.has_role('administrator') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'administrator_role_required'; END IF;
  IF p_association_approval_reference IS NULL OR length(trim(p_association_approval_reference)) < 3 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'association_approval_required';
  END IF;
  IF p_note IS NOT NULL AND length(trim(p_note)) > 0
     AND lower(trim(p_note)) = lower(trim(p_association_approval_reference)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'approval_reference_must_not_be_admin_note';
  END IF;
  v_environment := app_private.current_environment();
  IF NOT EXISTS (
    SELECT 1 FROM public.zone_sets zs JOIN public.zones z ON z.zone_set_id = zs.id
    WHERE zs.id = p_zone_set_id
      AND zs.environment = v_environment
      AND zs.status IN ('draft', 'approved')
      AND zs.source_sha256 ~ '^[0-9a-f]{64}$'
  ) THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_zone_set'; END IF;

  SELECT id INTO v_old_id FROM public.zone_sets
  WHERE environment = v_environment AND status = 'active' FOR UPDATE;
  UPDATE public.zone_sets SET status = 'retired', activated_at = NULL
  WHERE id = v_old_id;
  UPDATE public.zone_sets
  SET status = 'active', association_approval_reference = p_association_approval_reference,
      approved_at = COALESCE(approved_at, now()), activated_at = now()
  WHERE id = p_zone_set_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'zone_activation_failed'; END IF;
  PERFORM app_private.write_audit(auth.uid(), 'zone_set_activated', 'zone_set', p_zone_set_id,
    jsonb_build_object('previous_active_zone_set_id', v_old_id),
    jsonb_build_object('association_approval_reference', p_association_approval_reference), p_note);
END;
$$;

-- ---------------------------------------------------------------------------
-- Retention worker. Storage deletion is compensating work: mark first, delete
-- the object externally, then acknowledge. Report rows are purged only after any
-- associated photo has reached purged state. A NULL photo.purge_after must not
-- block purge when the parent report is itself eligible.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_private.report_is_purge_eligible(
  p_status public.report_status,
  p_deleted_at TIMESTAMPTZ,
  p_accepted_at TIMESTAMPTZ,
  p_synced_at TIMESTAMPTZ,
  p_now TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    (p_status = 'deleted' AND p_deleted_at <= p_now - interval '1 year')
    OR (p_accepted_at IS NOT NULL AND p_accepted_at <= p_now - interval '5 years')
    OR (p_accepted_at IS NULL AND p_synced_at <= p_now - interval '5 years')
$$;

CREATE FUNCTION app_private.run_retention_at(p_now TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_report_fingerprints INTEGER; v_flag_fingerprints INTEGER;
        v_photos INTEGER; v_audits INTEGER; v_reports INTEGER;
BEGIN
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
  DELETE FROM public.audit_log WHERE created_at <= p_now - interval '2 years';
  GET DIAGNOSTICS v_audits = ROW_COUNT;
  DELETE FROM public.reports r
  WHERE app_private.report_is_purge_eligible(
          r.status, r.deleted_at, r.accepted_at, r.synced_at, p_now
        )
    AND NOT EXISTS (
      SELECT 1 FROM public.photo_assets pa
      WHERE pa.report_id = r.id AND pa.state <> 'purged'
    );
  GET DIAGNOSTICS v_reports = ROW_COUNT;
  RETURN jsonb_build_object(
    'report_fingerprints_cleared', v_report_fingerprints,
    'flag_fingerprints_cleared', v_flag_fingerprints,
    'photos_marked_for_purge', v_photos,
    'audit_rows_purged', v_audits,
    'report_rows_purged', v_reports
  );
END;
$$;

-- Production worker entrypoint. Clock is always server now(); no caller clock.
CREATE FUNCTION public.service_run_retention()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.run_retention_at(now())
$$;

CREATE FUNCTION public.service_acknowledge_photo_purge(p_photo_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.photo_assets
  SET state = 'purged', purged_at = now(), approved_object_path = NULL
  WHERE id = p_photo_id AND state = 'purge_pending';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'photo_not_pending_purge'; END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS and privileges. RLS restricts rows if a grant is added accidentally;
-- GRANT/REVOKE prevents broad table/API operations. Both layers are required.
-- ---------------------------------------------------------------------------

ALTER TABLE public.deployment_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth only. Clients read the caller's profile through get_my_profile.
CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.submit_report(
  UUID, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC, BOOLEAN,
  public.incident_type, public.sighting_type, JSONB, TEXT, public.dog_size,
  BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TIMESTAMPTZ
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_report_flag(UUID, public.flag_reason, TEXT, TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_reports(TIMESTAMPTZ, INTEGER)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_clusters(
  INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_photo_status(UUID, TEXT)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_profile()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_association_reports(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_administrator_moderation_queue(INTEGER, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_administrator_active_duplicate_groups()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_administrator_configuration()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_report(UUID, TEXT),
  public.admin_hide_report(UUID, TEXT),
  public.admin_logical_delete_report(UUID, TEXT),
  public.admin_restore_report(UUID, TEXT),
  public.admin_resolve_duplicate_group(UUID, UUID[], TEXT),
  public.admin_reverse_duplicate_group(UUID, TEXT),
  public.admin_publish_configuration(INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT),
  public.admin_create_zone_set(TEXT, TEXT, TEXT, TEXT, JSONB),
  public.admin_activate_zone_set(UUID, TEXT, TEXT)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.service_begin_photo_processing(UUID, TEXT, TEXT),
  public.service_register_processed_photo(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, NUMERIC, NUMERIC),
  public.service_reject_photo(UUID, TEXT, TEXT),
  public.service_authorize_report_photo_delivery(UUID, UUID),
  public.service_apply_trust_assessment(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC),
  public.service_run_retention(),
  public.service_acknowledge_photo_purge(UUID)
  TO service_role;

COMMIT;
