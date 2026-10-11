/**
 * @module middleware/internalAuth
 * Shared-secret authentication for internal (non-user) routes such as scheduled retention.
 */
import { getConfig } from '../infrastructure/config.js';
import { constantTimeEqual } from '../infrastructure/constantTime.js';
import { presentError } from '../presenters/error.js';

/**
 * Checks a supplied secret against the configured one in constant time.
 * @param {string} suppliedSecret - Value sent by the caller.
 * @param {string} configuredSecret - Expected value from configuration.
 * @returns {Promise<boolean>} False when either value is empty or they differ.
 */
export async function isInternalSecretValid(suppliedSecret, configuredSecret) {
  return Boolean(
    suppliedSecret &&
      configuredSecret &&
      (await constantTimeEqual(suppliedSecret, configuredSecret)),
  );
}

/**
 * Middleware that requires a valid `X-Internal-Secret` header.
 * Responds 503 `preflight_mismatch` when no secret is configured, and 401 `invalid_internal_secret`
 * when the header is missing or wrong.
 * @param {import('hono').Context} c - Hono request context.
 * @param {import('hono').Next} next - Next middleware.
 * @returns {Promise<Response | void>}
 */
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
