export function getConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  return {
    supabaseUrl,
    jwtIssuer: supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/auth/v1` : '',
    jwtSecret: Deno.env.get('JWT_SECRET') ?? '',
    databaseUrl: Deno.env.get('APP_BACKEND_DATABASE_URL') ?? '',
  };
}
