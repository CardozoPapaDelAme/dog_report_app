import { getConfig } from '../infrastructure/config.js';
import { constantTimeEqual } from '../infrastructure/constant-time.js';
import { presentError } from '../presenters/error.js';

export async function isInternalSecretValid(suppliedSecret, configuredSecret) {
  return Boolean(
    suppliedSecret &&
      configuredSecret &&
      (await constantTimeEqual(suppliedSecret, configuredSecret)),
  );
}

export async function requireInternalSecret(c, next) {
  const configuredSecret = getConfig().internalRetentionSecret;
  if (!configuredSecret) {
    return presentError(c, 503, 'preflight_mismatch', 'Internal retention is not configured.');
  }

  const suppliedSecret = c.req.header('X-Internal-Secret') ?? '';
  if (!(await isInternalSecretValid(suppliedSecret, configuredSecret))) {
    return presentError(c, 401, 'invalid_internal_secret', 'Internal secret is invalid.');
  }

  await next();
}
