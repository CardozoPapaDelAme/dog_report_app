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
  };
}
