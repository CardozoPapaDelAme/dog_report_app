/**
 * @module services/identityService
 * Exposes the authenticated caller's own profile.
 */
/**
 * Projects the authenticated context into the public profile view.
 * @param {import('../middleware/auth.js').AuthenticatedAuth} auth - Authenticated context set by `requireAuth`.
 * @returns {{user_id: string, role: string, display_name: string | null, active: boolean}}
 */
export function getCurrentProfile(auth) {
  return {
    user_id: auth.userId,
    role: auth.role,
    display_name: auth.profile.display_name,
    active: auth.profile.active,
  };
}