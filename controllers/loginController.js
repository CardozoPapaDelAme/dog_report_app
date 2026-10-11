/**
 * @module controllers/loginController
 * Login and session restore orchestration: refreshes expired sessions, verifies the profile with the API,
 * resolves the role dashboard, and signs out locally when verification fails.
 */
import {
  createAuthenticatedSession,
  dashboardForRole,
  isSessionExpired,
} from "../models/session.js";

/** Throws a TypeError unless the service implements every auth method. */
function requireAuthService(authService) {
  for (const method of [
    "signIn",
    "getSession",
    "refreshSession",
    "getProfile",
    "signOut",
  ]) {
    if (typeof authService?.[method] !== "function") {
      throw new TypeError(`Auth service must provide ${method}().`);
    }
  }
}

/**
 * @typedef {object} LoginResult
 * @property {Readonly<object>} session - From `createAuthenticatedSession`.
 * @property {'associationDashboard' | 'administratorDashboard'} destination
 */
/**
 * @param {object} options
 * @param {ReturnType<typeof import('../services/authService.js').createAuthService>} options.authService
 * @param {() => number} [options.now=Date.now] - Clock in milliseconds.
 * @returns {Readonly<{login: (email: string, password: string) => Promise<Readonly<LoginResult>>,
 *   restoreSession: () => Promise<Readonly<LoginResult> | null>, logout: () => Promise<null>}>}
 *   On a verification failure the local session is cleared and the original error is rethrown, with any
 *   cleanup failure attached as `sessionCleanupError`.
 * @throws {TypeError} When `authService` is incomplete.
 */
export function createLoginController({ authService, now = Date.now }) {
  requireAuthService(authService);

  async function verifySession(initialAuthSession) {
    const authSession = isSessionExpired(
      {
        expiresAt: initialAuthSession?.expires_at,
      },
      now(),
    )
      ? await authService.refreshSession(initialAuthSession?.refresh_token)
      : initialAuthSession;
    const profile = await authService.getProfile(authSession.access_token);
    const session = createAuthenticatedSession(authSession, profile);
    return Object.freeze({
      session,
      destination: dashboardForRole(session.profile.role),
    });
  }

  async function validateAndClear(authSession) {
    try {
      return await verifySession(authSession);
    } catch (error) {
      try {
        await authService.signOut();
      } catch (cleanupError) {
        error.sessionCleanupError = cleanupError;
      }
      throw error;
    }
  }

  return Object.freeze({
    async login(email, password) {
      const authSession = await authService.signIn(email, password);
      return validateAndClear(authSession);
    },

    async restoreSession() {
      const authSession = await authService.getSession();
      if (!authSession) return null;
      return validateAndClear(authSession);
    },

    async logout() {
      await authService.signOut();
      return null;
    },
  });
}
