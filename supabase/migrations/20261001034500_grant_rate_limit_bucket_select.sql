BEGIN;

-- Report submission consumes quota through app_private.consume_rate_limit(), then
-- reads the current bucket to calculate fingerprint trust. Keep writes inside
-- the atomic primitive; grant only the read needed by the repository.
GRANT SELECT ON public.rate_limit_buckets TO app_backend;

COMMIT;
