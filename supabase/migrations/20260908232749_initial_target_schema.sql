-- Versioned migration derived from db/schema.sql (authoritative target).
-- Applied only via Supabase CLI (`supabase db push --dry-run` then `supabase db push`).
-- Do not paste this file into the SQL Editor.

-- Creel stray-dog reporting application: authoritative target schema.
-- PostgreSQL + PostGIS, intended for Supabase managed projects.
-- Implements RF01-RF24 and RNF01-RNF36 as amended by
-- docs/product/APPROVED-CLARIFICATIONS.md.
--
-- MANAGED PROTOTYPE TARGET:
-- * Supabase Cloud owns physical hosts, TLS, gateway/runtime operation, Auth,
-- * PostGIS and pgcrypto live in schema extensions. Confirm the managed project
--   catalogs before migrations; do not assume provider-owned physical columns.
-- CONTRACT BOUNDARY:
-- * Mobile clients use Supabase Auth for sessions and Hono for all domain traffic.
-- * No domain table or domain/service SQL function is exposed to mobile roles.
-- * Repositories issue parameterized SQL through app_backend. The role is
--   NOBYPASSRLS, owns no objects, and receives explicit least-privilege grants.
-- * Services own authorization and transactions. Before repository access they
--   set transaction-local app.user_id, app.role, and (for anonymous origin-bound
--   operations) app.origin_hash. Missing or inconsistent context fails closed.
-- * PostgreSQL owns constraints, RLS, grants, PostGIS, locks, audit integrity,
--   dynamic-details validation, duplicate detection, durable rate buckets, and
--   narrow backend-only atomic/set-based primitives.
-- * Auth and Storage catalogs are Supabase-owned. Verify installed versions before
--   writing policies against them. Never place role passwords or service keys here.
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
--   live; live intake fails closed until an Asociación de Hoteles de Chihuahua-approved geofence
--   is active.
-- * This monolithic file is a target snapshot. Derive ordered migrations: create
--   app_backend/rate table; add policies/grants/primitives; then revoke/drop legacy
--   public RPCs before deploying disabled api and performing one direct cutover.


DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_backend') THEN
    CREATE ROLE app_backend LOGIN NOBYPASSRLS NOINHERIT;
  END IF;
END
$role$;
-- Managed Postgres forbids ALTER ROLE ... NOSUPERUSER unless the session is
-- SUPERUSER. CREATE ROLE already starts without SUPERUSER/CREATEDB/CREATEROLE.
ALTER ROLE app_backend NOBYPASSRLS NOINHERIT;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO CURRENT_USER;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;

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

-- Existing configuration versions are immutable; activation is the only update.
CREATE FUNCTION app_private.enforce_config_version_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'is_active') IS DISTINCT FROM (to_jsonb(OLD) - 'is_active') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'config_version_is_immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_config_version_immutability
BEFORE UPDATE ON public.config_versions
FOR EACH ROW EXECUTE FUNCTION app_private.enforce_config_version_immutability();

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
  -- Identical replay is accepted even if the active geofence later changed.
  -- New submissions still fail closed against the current approved geofence.
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
  trust_config_id UUID REFERENCES public.config_versions(id),
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
  CHECK (previous_status IS NULL OR previous_status <> 'deleted'),
  CHECK (trust_tier = 'unassessed' OR (trust_score IS NOT NULL AND trust_config_id IS NOT NULL))
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
  detected_mime_type TEXT CHECK (detected_mime_type IS NULL OR detected_mime_type IN ('image/jpeg', 'image/png')),
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
  CHECK (state <> 'approved' OR (
    approved_object_path IS NOT NULL AND approved_at IS NOT NULL
    AND detected_mime_type IS NOT NULL AND byte_size IS NOT NULL
    AND width_pixels IS NOT NULL AND height_pixels IS NOT NULL
    AND sanitized_sha256 IS NOT NULL
  )),
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

CREATE TABLE public.rate_limit_buckets (
  operation TEXT NOT NULL CHECK (operation IN ('report', 'flag')),
  origin_hash TEXT NOT NULL CHECK (origin_hash ~ '^[0-9a-f]{64}$'),
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (operation, origin_hash, window_start),
  CHECK (window_start = date_trunc('hour', window_start)),
  CHECK (expires_at > window_start)
);
CREATE INDEX idx_rate_limit_buckets_expiry ON public.rate_limit_buckets (expires_at);

COMMENT ON TABLE public.reports IS 'Immutable public-submitted content plus server-controlled moderation and derived trust state. Mobile insertion is Hono-only.';
COMMENT ON COLUMN public.reports.client_created_at IS 'Device timestamp. New submissions must fall in [now()-30 days, now()+1 hour]. Identical replays skip this window.';
COMMENT ON TABLE public.photo_assets IS 'Private sanitized-photo processing, approval, rejection, and purge lifecycle. Raw input and raw EXIF are never persisted.';
COMMENT ON TABLE public.duplicate_groups IS 'Audited, reversible human duplicate resolution with one canonical report.';
COMMENT ON TABLE public.config_versions IS 'Typed, validated, versioned operational thresholds. Direct client mutation is prohibited.';
COMMENT ON TABLE public.zone_sets IS 'Versioned geofence metadata. source_sha256 is required. association_approval_reference cites an external Asociación de Hoteles de Chihuahua decision; Administrator notes are not that approval.';
COMMENT ON TABLE public.audit_log IS 'Append-only audit evidence retained for two years; direct UPDATE and DELETE are prohibited.';
COMMENT ON COLUMN public.reports.client_created_at IS 'Validated device observation timestamp, never a server lifecycle timestamp.';
COMMENT ON COLUMN public.reports.trust_config_id IS 'Configuration version used for the persisted trust assessment, including photo-free assessment.';
COMMENT ON TABLE public.photo_assets IS 'Sanitized JPEG/PNG lifecycle only. Raw image, HEIC, and raw EXIF are never persisted.';
COMMENT ON TABLE public.audit_log IS 'Append-only audit evidence; app_backend receives INSERT but never UPDATE or DELETE.';
COMMENT ON TABLE public.rate_limit_buckets IS 'Durable cross-instance report/flag rate counters. Idempotent replay is resolved before consumption.';

-- ---------------------------------------------------------------------------
-- Private helpers. They are not exposed through PostgREST's public schema.
-- ---------------------------------------------------------------------------
-- Context helpers are backend-private and intentionally absent from public schema.
CREATE FUNCTION app_private.actor_role()
RETURNS TEXT LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT NULLIF(pg_catalog.current_setting('app.role', true), '') $$;

CREATE FUNCTION app_private.actor_id()
RETURNS UUID LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT NULLIF(pg_catalog.current_setting('app.user_id', true), '')::UUID $$;

CREATE FUNCTION app_private.origin_hash()
RETURNS TEXT LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT NULLIF(pg_catalog.current_setting('app.origin_hash', true), '') $$;

CREATE FUNCTION app_private.current_environment()
RETURNS public.deployment_environment
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT environment FROM public.deployment_metadata WHERE singleton = TRUE
$$;

CREATE FUNCTION app_private.is_active_actor(required_role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = app_private.actor_id() AND active AND role = required_role
      AND app_private.actor_role() = required_role::TEXT
  )
$$;

CREATE FUNCTION app_private.is_noncanonical(p_report_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.duplicate_memberships
    WHERE report_id = p_report_id AND active AND member_role = 'duplicate'
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

-- Atomic, cross-instance hourly limiter. Services resolve idempotent report replay
-- before invoking it; FALSE maps to the typed 429 without domain mutation.
CREATE FUNCTION app_private.consume_rate_limit(
  p_operation TEXT, p_origin_hash TEXT, p_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
  v_window TIMESTAMPTZ := date_trunc('hour', now());
  v_role TEXT := app_private.actor_role();
  v_context_origin_hash TEXT := app_private.origin_hash();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('anonymous', 'internal')
     OR p_origin_hash IS DISTINCT FROM v_context_origin_hash THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invalid_rate_limit_context';
  END IF;
  IF p_operation NOT IN ('report', 'flag') OR p_origin_hash !~ '^[0-9a-f]{64}$'
     OR p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_rate_limit_input';
  END IF;
  INSERT INTO public.rate_limit_buckets (
    operation, origin_hash, window_start, request_count, expires_at
  ) VALUES (p_operation, p_origin_hash, v_window, 1, v_window + interval '2 hours')
  ON CONFLICT (operation, origin_hash, window_start) DO UPDATE
    SET request_count = public.rate_limit_buckets.request_count + 1
    WHERE public.rate_limit_buckets.request_count < p_limit
  RETURNING request_count INTO v_count;
  RETURN v_count IS NOT NULL;
END;
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
-- Duplicate candidate detection. It suggests only; no visibility changes occur.
-- ---------------------------------------------------------------------------
-- Set-based PostGIS suggestion remains a persistence invariant; it never resolves,
-- hides, merges, or selects a canonical report.
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

-- ---------------------------------------------------------------------------
-- Retention worker. Storage deletion is compensating work: mark first, delete
-- the object externally, then acknowledge. Report rows are purged only after any
-- associated photo has reached purged state. A NULL photo.purge_after must not
-- block purge when the parent report is itself eligible.
-- ---------------------------------------------------------------------------
-- Deterministic form is retained for controlled SQL tests and is not granted to
-- app_backend. The production wrapper below always supplies server now().
CREATE FUNCTION app_private.run_retention_at(p_now TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_report_fingerprints INTEGER; v_flag_fingerprints INTEGER;
        v_photos INTEGER; v_audits INTEGER; v_reports INTEGER;
        v_buckets INTEGER;
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
    'rate_buckets_purged', v_buckets,
    'audit_rows_purged', v_audits,
    'report_rows_purged', v_reports
  );
END;
$$;

CREATE FUNCTION app_private.run_retention()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT app_private.run_retention_at(now()) $$;

-- Production worker entrypoint. Clock is always server now(); no caller clock.

-- ---------------------------------------------------------------------------
-- RLS and privileges. RLS restricts rows if a grant is added accidentally;
-- GRANT/REVOKE prevents broad table/API operations. Both layers are required.
-- ---------------------------------------------------------------------------
-- RLS: app_backend remains subject to every policy. Context is set locally by the
-- owning Service transaction; role/profile agreement is checked again in SQL.
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
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY deployment_backend_select ON public.deployment_metadata
FOR SELECT TO app_backend USING (app_private.actor_role() IN ('anonymous', 'association', 'administrator', 'internal'));

CREATE POLICY profiles_actor_select ON public.profiles FOR SELECT TO app_backend
USING (id = app_private.actor_id() OR app_private.actor_role() = 'internal');

CREATE POLICY zones_backend_select ON public.zone_sets FOR SELECT TO app_backend
USING (app_private.actor_role() IN ('anonymous', 'association', 'administrator', 'internal'));
CREATE POLICY zones_backend_mutate ON public.zone_sets FOR ALL TO app_backend
USING (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal')
WITH CHECK (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal');
CREATE POLICY zone_geometry_backend_select ON public.zones FOR SELECT TO app_backend
USING (app_private.actor_role() IN ('anonymous', 'administrator', 'internal'));
CREATE POLICY zone_geometry_backend_mutate ON public.zones FOR ALL TO app_backend
USING (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal')
WITH CHECK (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal');

CREATE POLICY config_backend_select ON public.config_versions FOR SELECT TO app_backend
USING (app_private.actor_role() IN ('anonymous', 'association', 'administrator', 'internal'));
CREATE POLICY config_backend_mutate ON public.config_versions FOR ALL TO app_backend
USING (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal')
WITH CHECK (app_private.is_active_actor('administrator') OR app_private.actor_role() = 'internal');

CREATE POLICY reports_backend_select ON public.reports FOR SELECT TO app_backend USING (
  app_private.actor_role() = 'internal'
  OR app_private.is_active_actor('administrator')
  OR (app_private.is_active_actor('association') AND status = 'visible'
      AND accepted_at >= now() - interval '5 years' AND NOT app_private.is_noncanonical(id))
  OR (app_private.actor_role() = 'anonymous' AND (
      (status = 'visible' AND public_until > now() AND NOT app_private.is_noncanonical(id))
      OR device_fingerprint_hash = app_private.origin_hash()
  ))
);
CREATE POLICY reports_backend_insert ON public.reports FOR INSERT TO app_backend
WITH CHECK (app_private.actor_role() IN ('anonymous', 'internal'));
CREATE POLICY reports_backend_update ON public.reports FOR UPDATE TO app_backend
USING (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator')
  OR (app_private.actor_role() = 'anonymous'
      AND (device_fingerprint_hash = app_private.origin_hash() OR status = 'visible')))
WITH CHECK (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator')
  OR app_private.actor_role() = 'anonymous');

CREATE POLICY photos_backend_select ON public.photo_assets FOR SELECT TO app_backend USING (
  app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator')
  OR EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id)
);
-- clients never receive Storage write access or write photo_assets directly.
CREATE POLICY photos_backend_insert ON public.photo_assets FOR INSERT TO app_backend
WITH CHECK (
  app_private.actor_role() = 'internal'
  OR (app_private.actor_role() = 'anonymous' AND EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_id AND r.device_fingerprint_hash = app_private.origin_hash()
  ))
);
CREATE POLICY photos_backend_update ON public.photo_assets FOR UPDATE TO app_backend
USING (
  app_private.actor_role() = 'internal'
  OR (app_private.actor_role() = 'anonymous' AND EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_id AND r.device_fingerprint_hash = app_private.origin_hash()
  ))
)
WITH CHECK (
  app_private.actor_role() = 'internal'
  OR (app_private.actor_role() = 'anonymous' AND EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_id AND r.device_fingerprint_hash = app_private.origin_hash()
  ))
);

CREATE POLICY flags_backend_select ON public.report_flags FOR SELECT TO app_backend
USING (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator'));
CREATE POLICY flags_backend_insert ON public.report_flags FOR INSERT TO app_backend
WITH CHECK (app_private.actor_role() IN ('anonymous', 'internal'));

CREATE POLICY candidates_backend_select ON public.duplicate_candidates FOR SELECT TO app_backend
USING (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator'));
CREATE POLICY candidates_backend_insert ON public.duplicate_candidates FOR INSERT TO app_backend
WITH CHECK (app_private.actor_role() IN ('anonymous', 'internal'));
CREATE POLICY candidates_backend_update ON public.duplicate_candidates FOR UPDATE TO app_backend
USING (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator'))
WITH CHECK (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator'));

CREATE POLICY groups_backend_all ON public.duplicate_groups FOR ALL TO app_backend
USING (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator'))
WITH CHECK (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator'));
CREATE POLICY memberships_backend_all ON public.duplicate_memberships FOR ALL TO app_backend
USING (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator'))
WITH CHECK (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator'));

CREATE POLICY audit_backend_select ON public.audit_log FOR SELECT TO app_backend
USING (app_private.actor_role() = 'internal' OR app_private.is_active_actor('administrator'));
CREATE POLICY audit_backend_insert ON public.audit_log FOR INSERT TO app_backend
WITH CHECK (app_private.actor_role() IN ('anonymous', 'internal')
  OR app_private.is_active_actor('administrator'));

CREATE POLICY rates_backend_all ON public.rate_limit_buckets FOR ALL TO app_backend
USING (app_private.actor_role() IN ('anonymous', 'internal'))
WITH CHECK (app_private.actor_role() IN ('anonymous', 'internal'));

-- Mobile/PostgREST kill switch: no application table, sequence, or function grant.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public, app_private, extensions TO app_backend;
GRANT SELECT ON public.deployment_metadata, public.profiles, public.zone_sets,
  public.zones, public.config_versions, public.reports, public.photo_assets,
  public.report_flags, public.duplicate_candidates, public.duplicate_groups,
  public.duplicate_memberships, public.audit_log TO app_backend;
GRANT INSERT ON public.reports, public.photo_assets, public.report_flags,
  public.duplicate_candidates, public.duplicate_groups,
  public.duplicate_memberships, public.config_versions, public.zone_sets,
  public.zones, public.audit_log TO app_backend;
GRANT UPDATE (status, status_reason, previous_status, trust_tier, trust_score, trust_config_id, photo_validation_score, exif_consistency_score, gps_trust_score, fingerprint_trust_score, device_fingerprint_hash, fingerprint_expires_at, accepted_at, published_at, public_until, hidden_at, deleted_at, flag_reviewed_at) ON public.reports TO app_backend;
GRANT UPDATE (state, approved_object_path, detected_mime_type, byte_size, width_pixels, height_pixels, sanitized_sha256, rejection_code, approved_at, purge_after, purged_at) ON public.photo_assets TO app_backend;
GRANT UPDATE (status, reviewed_by, reviewed_at) ON public.duplicate_candidates TO app_backend;
GRANT UPDATE (status, resolution_version, reversed_by, reversed_at) ON public.duplicate_groups TO app_backend;
GRANT UPDATE (active) ON public.duplicate_memberships TO app_backend;
GRANT UPDATE (is_active) ON public.config_versions TO app_backend;
GRANT UPDATE (status, association_approval_reference, approved_at, activated_at) ON public.zone_sets TO app_backend;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_backend;

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM app_backend;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM app_backend;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM app_backend;
GRANT EXECUTE ON FUNCTION app_private.actor_role(), app_private.actor_id(),
  app_private.origin_hash(), app_private.current_environment(),
  app_private.is_active_actor(public.user_role),
  app_private.is_noncanonical(UUID),
  app_private.incident_severity(public.incident_type),
  app_private.approximate_public_location(extensions.geography),
  app_private.consume_rate_limit(TEXT, TEXT, INTEGER),
  app_private.run_retention() TO app_backend;
