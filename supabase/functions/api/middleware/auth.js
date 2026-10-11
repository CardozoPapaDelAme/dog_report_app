/**
 * @module middleware/auth
 * Authentication middleware for the Hono API.
 * `optionalAuth` runs globally and only verifies a present token; `requireAuth` protects routes by
 * verifying the token, loading the active profile, and checking that the token role matches it.
 * Fine-grained authorization stays in Services (ADR-019); this layer only establishes identity.
 */
import { verifyAccessToken } from '../infrastructure/jwt.js';
import { presentError } from '../presenters/error.js';
import { findProfileById } from '../repositories/profileRepository.js';

const KNOWN_ROLES = new Set(['association', 'administrator']);

/**
 * Parses the `Authorization` header.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {{kind: 'missing'} | {kind: 'invalid'} | {kind: 'present', token: string}}
 */
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

/**
 * Reads the application role from `app_metadata.app_role`, falling back to `app_metadata.role`.
 * @param {object} payload - Verified JWT claims.
 * @returns {string | null}
 */
function claimRole(payload) {
  const metadata = payload.app_metadata ?? {};
  const value = metadata.app_role ?? metadata.role;
  return typeof value === 'string' ? value : null;
}

function claimSubject(payload) {
  return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
}

/**
 * @typedef {object} AuthenticatedAuth
 * @property {'authenticated'} type
 * @property {object} claims - Verified JWT claims.
 * @property {string} userId - Token subject (`sub`).
 * @property {string} role - Role from the active profile.
 * @property {import('../repositories/profileRepository.js').ProfileRow} profile - Active profile row.
 */
/**
 * Fully authenticates a request: bearer token, signature, subject, active profile, and role match.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<{ok: true, auth: AuthenticatedAuth} | {ok: false, status: number, code: string, message: string}>}
 *   Failure codes: `authentication_required`, `invalid_token` (401); `inactive_profile`,
 *   `role_mismatch` (403); `database_unavailable` (503).
 */
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

/**
 * Global middleware: sets `auth` to `{ type: 'anonymous' }` when no token is sent, or to
 * `{ type: 'authenticated', claims }` when the token verifies. Does not load the profile.
 * Responds 401 `invalid_token` when a malformed or unverifiable token is supplied.
 * @param {import('hono').Context} c - Hono request context.
 * @param {import('hono').Next} next - Next middleware.
 * @returns {Promise<Response | void>}
 */
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

/**
 * Creates middleware that requires a fully authenticated, active profile with one of the given roles.
 * On success it replaces `auth` in the context with an {@link AuthenticatedAuth}. Failures are
 * presented with the codes from `authenticate`, or 403 `forbidden` when the role is not allowed.
 * @param {...('association' | 'administrator')} allowedRoles - Allowed roles; all known roles when omitted.
 * @returns {import('hono').MiddlewareHandler}
 * @throws {Error} At route-definition time when an unknown role is requested.
 */
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
