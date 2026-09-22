-- Keep the exact canonical GeoJSON used for source_sha256.  Existing legacy
-- rows remain readable but cannot be activated through the new API because
-- their historical source bytes cannot be reconstructed from geography.
ALTER TABLE public.zone_sets
  ADD COLUMN IF NOT EXISTS source_geojson JSONB;

ALTER TABLE public.zone_sets
  DROP CONSTRAINT IF EXISTS zone_sets_source_geojson_check,
  ADD CONSTRAINT zone_sets_source_geojson_check
    CHECK (source_geojson IS NOT NULL AND jsonb_typeof(source_geojson) = 'object')
    NOT VALID;

COMMENT ON TABLE public.zone_sets IS
  'Versioned immutable geofence metadata and canonical source GeoJSON. source_sha256 is the SHA-256 of source_geojson serialized canonically by the API. association_approval_reference cites an external Asociación de Hoteles de Chihuahua decision; Administrator notes are not that approval. Retired versions retain activation and retirement timestamps.';
