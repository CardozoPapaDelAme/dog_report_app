/**
 * @module repositories/profileRepository
 * Reads account profiles from `public.profiles` for authentication.
 */
import { getSql } from '../infrastructure/db.js';

/**
 * @typedef {object} ProfileRow
 * @property {string} id - Profile id (equal to the auth user id).
 * @property {string} role - Application role (`association` or `administrator`).
 * @property {boolean} active - Whether the account may use protected routes.
 * @property {string | null} display_name
 */
/**
 * Loads a profile inside a transaction that sets `app.user_id` for row-level policies.
 * @param {string} userId - Auth user id.
 * @returns {Promise<ProfileRow | null>} The profile, or null when none exists.
 */
export async function findProfileById(userId) {
  const sql = getSql();

  return sql.begin(async (tx) => {
    await tx`
      SELECT set_config('app.user_id', ${userId}, true)
    `;

    const rows = await tx`
      SELECT id, role, active, display_name
      FROM public.profiles
      WHERE id = ${userId}
    `;
    
    return rows[0] ?? null;
  });
}
