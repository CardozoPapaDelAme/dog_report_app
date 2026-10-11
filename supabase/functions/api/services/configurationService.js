/**
 * @module services/configurationService
 * Administrator use cases for reading and publishing the versioned runtime configuration. Per ADR-019
 * this Service owns authorization: it checks the actor before any I/O and re-checks the stored profile
 * and deployment environment inside the transaction.
 */
import { ConfigurationError, validateConfiguration } from '../domain/configuration.js';
import { getConfig } from '../infrastructure/config.js';
import { getSql } from '../infrastructure/db.js';
import * as repository from '../repositories/configurationRepository.js';

/**
 * Requires an authenticated, active Administrator whose profile matches the token subject and role.
 * @throws {ConfigurationError} `authentication_required` or `forbidden`.
 */
function assertAdministrator(actor) {
  if (actor?.type !== 'authenticated' || !actor.userId) {
    throw new ConfigurationError('authentication_required', 'A valid administrator session is required.');
  }
  if (actor.role !== 'administrator') {
    throw new ConfigurationError('forbidden', 'Only an Administrator can manage configuration.');
  }
  if (actor.profile?.active !== true || actor.profile.id !== actor.userId ||
      actor.profile.role !== actor.role) {
    throw new ConfigurationError('forbidden', 'An active matching Administrator profile is required.');
  }
}

/**
 * Creates the configuration Service. Every operation runs in a transaction scoped to the actor and
 * translates storage errors into {@link ConfigurationError} codes.
 * @param {object} [dependencies] - Overrides for `getConfig`, `getSql`, and `repository` (tests).
 * @returns {{read: (options: {actor: import('../middleware/auth.js').AuthenticatedAuth}) => Promise<{configuration: object, zone_set: object | null}>,
 *   publish: (options: {actor: import('../middleware/auth.js').AuthenticatedAuth, input: unknown}) => Promise<{configuration: object, zone_set: object | null}>}}
 *   `read` returns the active state; `publish` validates the input, inserts and activates a new
 *   version, writes an audit entry, and returns the new active state.
 * @throws {ConfigurationError} `authentication_required`, `forbidden`, `invalid_request`,
 *   `preflight_mismatch` (environment not configured or mismatched), `configuration_unavailable`
 *   (no active version on read), `configuration_conflict` (unique violation or serialization failure),
 *   or `dependency_unavailable` (connection failures, SQLSTATE class 08 and 57P01-57P03). Unknown errors propagate unchanged.
 */
export function createConfigurationService(dependencies = {}) {
  const deps = { getConfig, getSql, repository, ...dependencies };

  /** Runs `operation(tx, environment)` after the in-transaction actor and environment preflight, mapping storage errors. */
  async function inTransaction(actor, operation) {
    const expectedEnvironment = deps.getConfig().expectedEnvironment;
    if (!['staging', 'production'].includes(expectedEnvironment)) {
      throw new ConfigurationError('preflight_mismatch', 'Deployment environment is not configured.');
    }
    try {
      return await deps.getSql().begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', ${actor.userId}, true)`;
        await tx`SELECT set_config('app.role', ${actor.role}, true)`;
        const profile = await deps.repository.readConfigurationActor(tx, actor.userId);
        if (!profile?.active || profile.role !== 'administrator') {
          throw new ConfigurationError('forbidden', 'The Administrator profile is no longer active.');
        }
        const environment = await deps.repository.readConfigurationEnvironment(tx);
        if (environment !== expectedEnvironment) {
          throw new ConfigurationError('preflight_mismatch', 'Deployment environment does not match.');
        }
        return operation(tx, environment);
      });
    } catch (error) {
      if (error instanceof ConfigurationError) throw error;
      if (error?.code === '42501') {
        throw new ConfigurationError('forbidden', 'The configuration operation is not permitted.');
      }
      if (['23505', '40001', '40P01'].includes(error?.code)) {
        throw new ConfigurationError('configuration_conflict', 'Configuration changed concurrently; retry the request.');
      }
      if (error?.code === '23514') {
        throw new ConfigurationError('invalid_request', 'Configuration violates a storage constraint.');
      }
      // Only connection failures are dependency errors; unknown SQL/programming errors remain 500.
      if (['CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECT_TIMEOUT', 'ECONNREFUSED',
        'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', '57P01', '57P02', '57P03'].includes(error?.code) ||
          error?.code?.startsWith('08')) {
        throw new ConfigurationError('dependency_unavailable', 'Configuration storage is unavailable.');
      }
      throw error;
    }
  }

  return {
    read({ actor }) {
      assertAdministrator(actor);
      return inTransaction(actor, async (tx, environment) => {
        const state = await deps.repository.readActiveConfiguration(tx, environment);
        if (!state.configuration) {
          throw new ConfigurationError('configuration_unavailable', 'There is no active configuration.');
        }
        return state;
      });
    },
    publish({ actor, input }) {
      assertAdministrator(actor);
      // Validate before obtaining a connection or invoking any repository operation.
      const values = validateConfiguration(input);
      return inTransaction(actor, async (tx, environment) => {
        await deps.repository.lockConfigurationEnvironment(tx, environment);
        const previous = await deps.repository.readActiveConfiguration(tx, environment);
        const id = await deps.repository.insertConfigurationVersion(tx, {
          environment, actorId: actor.userId, values,
        });
        await deps.repository.activateConfigurationVersion(tx, { environment, id });
        const current = await deps.repository.readActiveConfiguration(tx, environment);
        if (!current.configuration || current.configuration.id !== id) {
          throw new Error('Published configuration was not active.');
        }
        await deps.repository.insertConfigurationAudit(tx, {
          actorId: actor.userId, previous: previous.configuration,
          current: current.configuration, note: values.change_note,
        });
        return current;
      });
    },
  };
}

/** Production configuration Service instance. */
export const configurationService = createConfigurationService();
