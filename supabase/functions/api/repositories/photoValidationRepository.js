/**
 * @module repositories/photoValidationRepository
 * Reads the public on-device photo validation threshold from the active configuration version.
 */
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction (anonymous role).
 * @returns {Promise<{version: number, photo_dog_probability_min: string | number} | null>}
 *   Active version of the deployment environment, or null when none is active.
 */
export async function getActivePhotoValidation(tx) {
  const rows = await tx`
    SELECT c.version, c.photo_dog_probability_min
    FROM public.config_versions c
    JOIN public.deployment_metadata d
      ON d.singleton = TRUE
     AND d.environment = c.environment
    WHERE c.is_active = TRUE
    LIMIT 1
  `;
  return rows[0] ?? null;
}
