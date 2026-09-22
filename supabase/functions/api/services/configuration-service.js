import { ConfigurationError, validateConfiguration } from '../domain/configuration.js';
import { getConfig } from '../infrastructure/config.js';
import { getSql } from '../infrastructure/db.js';
import * as repository from '../repositories/configuration-repository.js';

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

export function createConfigurationService(dependencies = {}) {
  const deps = { getConfig, getSql, repository, ...dependencies };

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

export const configurationService = createConfigurationService();
