/**
 * @module controllers/configurationController
 * HTTP adapter for reading and publishing the runtime configuration. Validates the request shape at the
 * boundary and maps {@link ConfigurationError} codes to HTTP statuses.
 */
import { ConfigurationError, validateConfiguration } from '../domain/configuration.js';
import { presentConfiguration } from '../presenters/configuration.js';
import { presentError } from '../presenters/error.js';
import { configurationService } from '../services/configurationService.js';

/** HTTP status for each `ConfigurationError` code; unmapped errors become 500 `internal_error`. */
const ERROR_STATUSES = {
  invalid_request: 400, authentication_required: 401, forbidden: 403,
  configuration_conflict: 409, configuration_unavailable: 503,
  dependency_unavailable: 503, preflight_mismatch: 503,
};

function handleError(c, error) {
  if (error instanceof ConfigurationError && ERROR_STATUSES[error.code]) {
    return presentError(c, ERROR_STATUSES[error.code], error.code, error.message, error.details);
  }
  return presentError(c, 500, 'internal_error', 'The request could not be completed.');
}

/** @throws {ConfigurationError} `invalid_request` when the URL has a query string. */
function rejectQuery(c) {
  if (new URL(c.req.url).search) {
    throw new ConfigurationError('invalid_request', 'This route does not accept query parameters.');
  }
}

/**
 * Creates the configuration Controller.
 * `read` responds 200 and `publish` responds 201 with the active state. Errors: 400 `invalid_request`
 * (query string, non-JSON Content-Type, invalid body), 401 `authentication_required`, 403 `forbidden`,
 * 409 `configuration_conflict`, 503 `configuration_unavailable` / `dependency_unavailable` /
 * `preflight_mismatch`, 500 `internal_error` otherwise.
 * @param {ReturnType<typeof import('../services/configurationService.js').createConfigurationService>} [service]
 *   Configuration Service.
 * @returns {{read: (c: import('hono').Context) => Promise<Response>, publish: (c: import('hono').Context) => Promise<Response>}}
 */
export function createConfigurationController(service = configurationService) {
  return {
    async read(c) {
      try {
        rejectQuery(c);
        return presentConfiguration(c, await service.read({ actor: c.get('auth') }));
      } catch (error) { return handleError(c, error); }
    },
    async publish(c) {
      try {
        rejectQuery(c);
        const contentType = c.req.header('Content-Type')?.split(';')[0].trim().toLowerCase();
        if (contentType !== 'application/json') {
          throw new ConfigurationError('invalid_request', 'Content-Type must be application/json.');
        }
        let body;
        try { body = await c.req.json(); } catch {
          throw new ConfigurationError('invalid_request', 'Body must contain valid JSON.');
        }
        // Boundary validation prevents malformed input reaching the Service;
        // the Service also validates for non-HTTP callers.
        const input = validateConfiguration(body);
        const state = await service.publish({ actor: c.get('auth'), input });
        return presentConfiguration(c, state, 201);
      } catch (error) { return handleError(c, error); }
    },
  };
}
