/**
 * @module infrastructure/jwt
 * Verifies Supabase Auth access tokens with `jose`.
 * Tokens are checked against the project's remote JWKS first and, when `JWT_SECRET` is configured,
 * against that symmetric secret as a fallback.
 */
import * as jose from 'jose';

import { getConfig } from './config.js';

let remoteJwks;

/**
 * Returns the cached remote JWKS resolver for the Supabase Auth project.
 * @returns {ReturnType<typeof jose.createRemoteJWKSet>}
 * @throws {Error} When `SUPABASE_URL` is not set.
 */
function jwks() {
  const { supabaseUrl } = getConfig();
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not set');
  }
  if (!remoteJwks) {
    remoteJwks = jose.createRemoteJWKSet(
      new URL(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`),
    );
  }
  return remoteJwks;
}

/**
 * Verifies an access token's signature and, when configured, its issuer.
 * @param {string} token - Raw bearer token.
 * @returns {Promise<import('jose').JWTPayload>} Verified token claims.
 * @throws {Error} The `jose` verification error when the token is invalid for every available key.
 */
export async function verifyAccessToken(token) {
  const { jwtIssuer, jwtSecret } = getConfig();
  const options = {};
  if (jwtIssuer) {
    options.issuer = jwtIssuer;
  }

  try {
    const { payload } = await jose.jwtVerify(token, jwks(), options);
    return payload;
  } catch (jwksError) {
    if (!jwtSecret) {
      throw jwksError;
    }
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret, options);
    return payload;
  }
}
