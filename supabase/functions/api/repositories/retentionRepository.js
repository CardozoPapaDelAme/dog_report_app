/**
 * @module repositories/retentionRepository
 * SQL access for the internal data-retention job. Every function runs on a caller-provided transaction
 * and delegates retention rules to `app_private` database functions.
 */
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<string | null>} The `deployment_metadata` environment, or null when missing.
 */
export async function getDeploymentEnvironment(tx) {
  const rows = await tx`
    SELECT environment
    FROM public.deployment_metadata
    WHERE singleton = TRUE
  `;
  return rows[0]?.environment ?? null;
}

/**
 * Runs `app_private.prepare_retention()`.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<*>} The counts object returned by the database function.
 */
export async function prepareRetention(tx) {
  const rows = await tx`SELECT app_private.prepare_retention() AS counts`;
  return rows[0].counts;
}

/**
 * Lists photo assets in `purge_pending` state, oldest first.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<Array<{id: string, approved_object_path: string | null}>>}
 */
export function listPendingPhotoPurges(tx) {
  return tx`
    SELECT id, approved_object_path
    FROM public.photo_assets
    WHERE state = 'purge_pending'
    ORDER BY created_at, id
  `;
}

/**
 * Confirms that a photo's stored object was purged, via `app_private.acknowledge_photo_purge`.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} photoId - Photo asset id.
 * @returns {Promise<boolean>} True when the database acknowledged the purge.
 */
export async function acknowledgePhotoPurge(tx, photoId) {
  const rows = await tx`
    SELECT app_private.acknowledge_photo_purge(${photoId}) AS acknowledged
  `;
  return rows[0].acknowledged === true;
}

/**
 * Runs `app_private.finalize_retention()`.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<*>} The counts object returned by the database function.
 */
export async function finalizeRetention(tx) {
  const rows = await tx`SELECT app_private.finalize_retention() AS counts`;
  return rows[0].counts;
}
