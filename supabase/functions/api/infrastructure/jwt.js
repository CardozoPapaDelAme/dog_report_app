import * as jose from 'jose';

import { getConfig } from './config.js';

let remoteJwks;

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
