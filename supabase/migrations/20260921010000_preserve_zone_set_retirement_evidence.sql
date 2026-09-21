-- Retired geofence versions must retain their activation evidence.  The initial
-- target snapshot only allowed activated_at while active, which erased that
-- provenance when replacing a zone set.
ALTER TABLE public.zone_sets
  ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;

DO $$
DECLARE
  lifecycle_constraint TEXT;
BEGIN
  SELECT conname INTO lifecycle_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.zone_sets'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%activated_at%';

  IF lifecycle_constraint IS NULL THEN
    RAISE EXCEPTION 'zone_sets activated_at lifecycle constraint was not found';
  END IF;

  EXECUTE format('ALTER TABLE public.zone_sets DROP CONSTRAINT %I', lifecycle_constraint);
END;
$$;

ALTER TABLE public.zone_sets
  ADD CONSTRAINT zone_sets_lifecycle_check CHECK (
    (status = 'draft' AND association_approval_reference IS NULL
      AND approved_at IS NULL AND activated_at IS NULL AND retired_at IS NULL)
    OR (status = 'approved' AND length(btrim(association_approval_reference)) > 0
      AND approved_at IS NOT NULL AND activated_at IS NULL AND retired_at IS NULL)
    OR (status = 'active' AND length(btrim(association_approval_reference)) > 0
      AND approved_at IS NOT NULL AND activated_at IS NOT NULL AND retired_at IS NULL)
    OR (status = 'retired' AND length(btrim(association_approval_reference)) > 0
      AND approved_at IS NOT NULL AND activated_at IS NOT NULL AND retired_at IS NOT NULL
      AND retired_at >= activated_at)
  );

COMMENT ON TABLE public.zone_sets IS
  'Versioned immutable geofence metadata. source_sha256 is the SHA-256 of the canonical normalized GeoJSON accepted by the API. association_approval_reference cites an external Asociación de Hoteles de Chihuahua decision; Administrator notes are not that approval. Retired versions retain activation and retirement timestamps.';
