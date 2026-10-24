/**
 * @module services/photoValidationService
 * Anonymous use case: read the active on-device photo validation threshold. Exposes no audit fields.
 */
import { ConfigurationError } from "../domain/configuration.js";
import { getSql } from "../infrastructure/db.js";
import * as repository from "../repositories/photoValidationRepository.js";

function isConnectionError(error) {
  return [
    "CONNECTION_CLOSED",
    "CONNECTION_ENDED",
    "CONNECT_TIMEOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "ENOTFOUND",
    "EAI_AGAIN",
    "57P01",
    "57P02",
    "57P03",
  ].includes(error?.code) || error?.code?.startsWith("08");
}

/**
 * Creates the photo validation Service. The read runs in an anonymous transaction.
 * @param {object} [dependencies] - Overrides for `getSql` and `repository` (tests).
 * @returns {{read: () => Promise<{version: number, photo_dog_probability_min: number}>}}
 * @throws {ConfigurationError} `configuration_unavailable` (no active version) or
 *   `dependency_unavailable` (connection failure).
 */
export function createPhotoValidationService(dependencies = {}) {
  const deps = { getSql, repository, ...dependencies };
  return {
    async read() {
      try {
        const row = await deps.getSql().begin(async (tx) => {
          await tx`SELECT set_config('app.user_id', '', true)`;
          await tx`SELECT set_config('app.role', 'anonymous', true)`;
          return deps.repository.getActivePhotoValidation(tx);
        });
        if (!row) {
          throw new ConfigurationError(
            "configuration_unavailable",
            "There is no active configuration.",
          );
        }
        return {
          version: Number(row.version),
          photo_dog_probability_min: Number(row.photo_dog_probability_min),
        };
      } catch (error) {
        if (error instanceof ConfigurationError) throw error;
        if (isConnectionError(error)) {
          throw new ConfigurationError(
            "dependency_unavailable",
            "Configuration storage is unavailable.",
          );
        }
        throw error;
      }
    },
  };
}

/** Production photo validation Service. */
export const photoValidationService = createPhotoValidationService();
