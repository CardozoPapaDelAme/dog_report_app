/**
 * @module services/retentionService
 * Internal data retention run: prepares expired data, deletes purged photo objects from private
 * storage, acknowledges each purge, and finalizes retention. Per-photo failures are collected instead
 * of aborting the run.
 */
import { getConfig } from '../infrastructure/config.js';
import { getSql } from '../infrastructure/db.js';
import {
  acknowledgePhotoPurge,
  finalizeRetention,
  getDeploymentEnvironment,
  listPendingPhotoPurges,
  prepareRetention,
} from '../repositories/retentionRepository.js';
import { deleteStorageObject } from '../repositories/storageRepository.js';

/** Wraps a cause in an `Error` with `code` `dependency_unavailable`. */
function dependencyError(cause) {
  const error = new Error('retention_dependency_unavailable', { cause });
  error.code = 'dependency_unavailable';
  return error;
}

/**
 * Fail-closed preflight: the Supabase URL must belong to the expected project, the environment must be
 * `staging` or `production`, and the service role key and photo bucket must be set.
 * @param {import('../infrastructure/config.js').ApiConfig} config - API configuration.
 * @returns {boolean}
 */
export function validateRetentionConfig(config) {
  let projectRef = '';
  try {
    projectRef = new URL(config.supabaseUrl).hostname.split('.')[0];
  } catch {
    // The empty project reference fails the same closed preflight below.
  }
  const validEnvironment = ['staging', 'production'].includes(config.expectedEnvironment);
  return Boolean(
    config.supabaseUrl &&
      config.serviceRoleKey &&
      config.expectedProjectRef &&
      projectRef === config.expectedProjectRef &&
      validEnvironment &&
      config.approvedPhotosBucket,
  );
}

/** Runs `operation(tx)` with the `internal` role. */
function inInternalTransaction(operation) {
  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.user_id', '', true)`;
    await tx`SELECT set_config('app.role', 'internal', true)`;
    return operation(tx);
  });
}

const productionDependencies = {
  getConfig,
  prepareAndList(expectedEnvironment) {
    return inInternalTransaction(async (tx) => {
      const actualEnvironment = await getDeploymentEnvironment(tx);
      if (actualEnvironment !== expectedEnvironment) {
        const error = new Error('retention_environment_mismatch');
        error.code = 'preflight_mismatch';
        throw error;
      }
      const preparation = await prepareRetention(tx);
      const photos = await listPendingPhotoPurges(tx);
      return { preparation, photos };
    });
  },
  deleteObject: deleteStorageObject,
  acknowledge(photoId) {
    return inInternalTransaction((tx) => acknowledgePhotoPurge(tx, photoId));
  },
  finalize() {
    return inInternalTransaction((tx) => finalizeRetention(tx));
  },
};

/**
 * Executes one retention run.
 * @param {object} [dependencies] - Overrides for configuration, transactions, and storage (tests).
 * @returns {Promise<object>} Preparation and finalization counters plus `objects_deleted`,
 *   `photos_acknowledged`, and `failures` (`{photo_id, code, storage_status?}` per failed photo).
 * @throws {Error} With `code` `preflight_mismatch` (invalid configuration or environment mismatch) or
 *   `dependency_unavailable` (preparation or finalization failed).
 */
export async function runRetention(dependencies = productionDependencies) {
  const config = dependencies.getConfig();
  if (!validateRetentionConfig(config)) {
    const error = new Error('retention_preflight_mismatch');
    error.code = 'preflight_mismatch';
    throw error;
  }

  let batch;
  try {
    batch = await dependencies.prepareAndList(config.expectedEnvironment);
  } catch (error) {
    if (error?.code === 'preflight_mismatch') {
      throw error;
    }
    throw dependencyError(error);
  }

  const failures = [];
  let objectsDeleted = 0;
  let photosAcknowledged = 0;
  for (const photo of batch.photos) {
    if (photo.approved_object_path) {
      try {
        await dependencies.deleteObject({
          supabaseUrl: config.supabaseUrl,
          serviceRoleKey: config.serviceRoleKey,
          bucket: config.approvedPhotosBucket,
          objectPath: photo.approved_object_path,
        });
        objectsDeleted += 1;
      } catch (error) {
        failures.push({
          photo_id: photo.id,
          code: error?.code ?? 'storage_delete_failed',
          storage_status: error?.status ?? null,
        });
        continue;
      }
    }

    try {
      if (await dependencies.acknowledge(photo.id)) {
        photosAcknowledged += 1;
      } else {
        failures.push({ photo_id: photo.id, code: 'photo_acknowledgement_conflict' });
      }
    } catch {
      failures.push({ photo_id: photo.id, code: 'photo_acknowledgement_failed' });
    }
  }

  let finalization;
  try {
    finalization = await dependencies.finalize();
  } catch (error) {
    throw dependencyError(error);
  }

  return {
    ...batch.preparation,
    objects_deleted: objectsDeleted,
    photos_acknowledged: photosAcknowledged,
    ...finalization,
    failures,
  };
}
