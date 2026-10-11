/**
 * @module controllers/identityController
 * HTTP adapter for the caller's own profile.
 */
import {getCurrentProfile} from '../services/identityService.js';
import { presentIdentity } from '../presenters/identityPresenter.js';


/**
 * `GET /me`: responds 200 with the authenticated profile. Must run after `requireAuth`, which sets a
 * fully authenticated `auth` context.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<Response>}
 */
export async function getCurrentProfileController(c) {
  const auth = c.get('auth');
  const profile = getCurrentProfile(auth);
  return presentIdentity(c, profile);
}
