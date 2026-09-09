import { verifyAccessToken } from '../infrastructure/jwt.js';
import { presentError } from '../presenters/error.js';
import { findProfileById } from '../repositories/profile-repository.js';

const KNOWN_ROLES = new Set(['association', 'administrator']);

function bearerToken(c) {
  const header = c.req.header('Authorization');
  if (!header) {
    return { kind: 'missing' };
  }
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return { kind: 'invalid' };
  }
  return { kind: 'present', token: match[1] };
}

function claimRole(payload) {
  const metadata = payload.app_metadata ?? {};
  const value = metadata.app_role ?? metadata.role;
  return typeof value === 'string' ? value : null;
}

function claimSubject(payload) {
  return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
}

async function authenticate(c) {
  const parsed = bearerToken(c);
  if (parsed.kind === 'missing') {
    return { ok: false, status: 401, code: 'authentication_required', message: 'This route requires a valid access token.' };
  }
  if (parsed.kind === 'invalid') {
    return { ok: false, status: 401, code: 'invalid_token', message: 'Authorization bearer token is invalid.' };
  }

  let claims;
  try {
    claims = await verifyAccessToken(parsed.token);
  } catch {
    return { ok: false, status: 401, code: 'invalid_token', message: 'Authorization bearer token is invalid.' };
  }

  const userId = claimSubject(claims);
  const jwtRole = claimRole(claims);
  if (!userId) {
    return { ok: false, status: 401, code: 'invalid_token', message: 'Authorization bearer token is invalid.' };
  }

  let profile;
  try {
    profile = await findProfileById(userId);
  } catch {
    return { ok: false, status: 503, code: 'database_unavailable', message: 'Postgres is not reachable.' };
  }

  if (!profile || profile.active !== true) {
    return { ok: false, status: 403, code: 'inactive_profile', message: 'The account profile is missing or inactive.' };
  }

  if (!jwtRole || jwtRole !== profile.role) {
    return { ok: false, status: 403, code: 'role_mismatch', message: 'The token role does not match the active profile.' };
  }

  return {
    ok: true,
    auth: {
      type: 'authenticated',
      claims,
      userId,
      role: profile.role,
      profile,
    },
  };
}

export async function optionalAuth(c, next) {
  const parsed = bearerToken(c);
  if (parsed.kind === 'missing') {
    c.set('auth', { type: 'anonymous' });
    await next();
    return;
  }
  if (parsed.kind === 'invalid') {
    return presentError(c, 401, 'invalid_token', 'Authorization bearer token is invalid.');
  }
  try {
    const claims = await verifyAccessToken(parsed.token);
    c.set('auth', { type: 'authenticated', claims });
    await next();
  } catch {
    return presentError(c, 401, 'invalid_token', 'Authorization bearer token is invalid.');
  }
}

export function requireAuth(...allowedRoles) {
  const roles = allowedRoles.length > 0 ? allowedRoles : [...KNOWN_ROLES];
  for (const role of roles) {
    if (!KNOWN_ROLES.has(role)) {
      throw new Error(`Unknown role: ${role}`);
    }
  }

  return async function requireAuthMiddleware(c, next) {
    const result = await authenticate(c);
    if (!result.ok) {
      return presentError(c, result.status, result.code, result.message);
    }
    if (!roles.includes(result.auth.role)) {
      return presentError(c, 403, 'forbidden', 'This route does not allow the authenticated role.');
    }
    c.set('auth', result.auth);
    await next();
  };
}
