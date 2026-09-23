-- L2 retirement is part of the same atomic replacement performed by app_backend.
-- The original column grant predates retired_at, so grant only this added field
-- without broadening any other zone-set mutation permission.
GRANT UPDATE (retired_at) ON public.zone_sets TO app_backend;
