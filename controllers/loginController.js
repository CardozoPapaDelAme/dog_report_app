import {
  createAuthenticatedSession,
  dashboardForRole,
  isSessionExpired,
} from "../models/session.js";

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
