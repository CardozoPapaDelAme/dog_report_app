import { verifyAccessToken } from '../infrastructure/jwt.js';
import { presentError } from '../presenters/error.js';

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

export async function requireAuth(c, next) {
  const parsed = bearerToken(c);
  if (parsed.kind === 'missing') {
    return presentError(
      c,
      401,
      'authentication_required',
      'This route requires a valid access token.',
    );
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
