-- Adds the administrator-managed, versioned on-device AI dog-detection threshold.
-- Existing configuration versions backfill to the previously hardcoded mobile default (0.200).
-- The immutability trigger compares whole rows, so the new column is covered automatically; existing
-- RLS policies and the table-level SELECT grant already apply to it.
BEGIN;

ALTER TABLE public.config_versions
  ADD COLUMN photo_dog_probability_min NUMERIC(4,3) NOT NULL DEFAULT 0.200
    CHECK (photo_dog_probability_min BETWEEN 0 AND 1);

COMMIT;
