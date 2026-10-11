/**
 * @module infrastructure/config
 * Reads runtime configuration for the API from Deno environment variables.
 * Values are read on every call so tests and deployments can change them without module reloads.
 */
/**
 * @typedef {object} ApiConfig
 * @property {string} supabaseUrl - `SUPABASE_URL`, or an empty string when unset.
 * @property {string} jwtIssuer - Expected JWT issuer (`<supabaseUrl>/auth/v1`), or empty when `supabaseUrl` is unset.
 * @property {string} jwtSecret - Optional symmetric `JWT_SECRET` used as a verification fallback.
 * @property {string} databaseUrl - `APP_BACKEND_DATABASE_URL` for the Postgres connection.
 * @property {string} serviceRoleKey - `SUPABASE_SERVICE_ROLE_KEY` for privileged Storage calls.
 * @property {string} internalRetentionSecret - Shared secret required by internal retention routes.
 * @property {string} expectedProjectRef - `EXPECTED_SUPABASE_PROJECT_REF` used by deployment preflight checks.
 * @property {string} expectedEnvironment - `EXPECTED_DEPLOYMENT_ENVIRONMENT` used by deployment preflight checks.
 * @property {string} approvedPhotosBucket - Storage bucket that holds sanitized, approved photos.
 * @property {boolean} allowReportsWithoutActiveGeofence - True only when `ALLOW_REPORTS_WITHOUT_ACTIVE_GEOFENCE` is `'true'`.
 */
/**
 * Builds the API configuration from the current environment. Missing variables become empty strings.
 * @returns {ApiConfig}
 */
export function getConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  return {
    supabaseUrl,
    jwtIssuer: supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/auth/v1` : '',
    jwtSecret: Deno.env.get('JWT_SECRET') ?? '',
    databaseUrl: Deno.env.get('APP_BACKEND_DATABASE_URL') ?? '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    internalRetentionSecret: Deno.env.get('INTERNAL_RETENTION_SECRET') ?? '',
    expectedProjectRef: Deno.env.get('EXPECTED_SUPABASE_PROJECT_REF') ?? '',
    expectedEnvironment: Deno.env.get('EXPECTED_DEPLOYMENT_ENVIRONMENT') ?? '',
    approvedPhotosBucket: Deno.env.get('APPROVED_PHOTOS_BUCKET') ?? '',
    allowReportsWithoutActiveGeofence:
      Deno.env.get('ALLOW_REPORTS_WITHOUT_ACTIVE_GEOFENCE') === 'true',
  };
}
