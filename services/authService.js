/**
 * @module services/authService
 * Authentication I/O for the mobile app: Supabase Auth sign-in, session restore/refresh/sign-out, and the
 * server-verified profile from `GET /me`. Session policy lives in `controllers/loginController.js`.
 */
import { apiRequest } from "./apiClient.js";

const PROFILE_PATH = "/me";

/**
 * Error raised by the auth service with a stable `code` and the HTTP `status` when known.
 */
export class AuthServiceError extends Error {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code='auth_request_failed']
   * @param {number | null} [options.status=null]
   */
  constructor(message, { code = "auth_request_failed", status = null } = {}) {
    super(message);
    this.name = "AuthServiceError";
    this.code = code;
    this.status = status;
  }
}

/** Throws a TypeError unless the client exposes `auth`. */
function requireSupabaseClient(supabase) {
  if (!supabase?.auth) {
    throw new TypeError("A configured Supabase client is required.");
  }
}

/**
 * Returns the profile `data` object; throws {@link AuthServiceError} with the API `code` (default
 * `profile_request_failed`) on non-2xx, or `invalid_profile_response` when `data` is not an object.
 */
async function readApiResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new AuthServiceError(
      payload?.error?.message ?? "Could not validate the account profile.",
      {
        code: payload?.error?.code ?? "profile_request_failed",
        status: response.status,
      },
    );
  }

  if (!payload?.data || typeof payload.data !== "object") {
    throw new AuthServiceError("The profile response is invalid.", {
      code: "invalid_profile_response",
      status: response.status,
    });
  }
  return payload.data;
}

/**
 * Supabase Auth and API I/O only. Login orchestration and session policy belong
 * to the MVC controller; persistence is configured on the Supabase client.
 * @param {object} options
 * @param {import('@supabase/supabase-js').SupabaseClient} options.supabase - Configured Supabase client.
 * @param {typeof import('./apiClient.js').apiRequest} [options.request] - Injectable API transport.
 * @returns {Readonly<{
 *   signIn: (email: string, password: string) => Promise<import('@supabase/supabase-js').Session>,
 *   getSession: () => Promise<import('@supabase/supabase-js').Session | null>,
 *   refreshSession: (refreshToken?: string) => Promise<import('@supabase/supabase-js').Session>,
 *   getProfile: (accessToken: string) => Promise<object>,
 *   signOut: () => Promise<void>
 * }>}
 * @throws {TypeError} When `supabase.auth` is missing.
 */
export function createAuthService({ supabase, request = apiRequest }) {
  requireSupabaseClient(supabase);

  return Object.freeze({
    /**
     * Signs in with email and password.
     * @throws {AuthServiceError} Supabase error `code` (default `invalid_credentials`), or `session_missing`.
     */
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        throw new AuthServiceError(error.message ?? "Sign in failed.", {
          code: error.code ?? "invalid_credentials",
          status: error.status ?? null,
        });
      }
      if (!data?.session) {
        throw new AuthServiceError("Supabase did not return a session.", {
          code: "session_missing",
        });
      }
      return data.session;
    },

    /**
     * Returns the persisted session, or `null` when signed out.
     * @throws {AuthServiceError} Supabase error `code` (default `session_restore_failed`).
     */
    async getSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw new AuthServiceError(
          error.message ?? "Could not restore the session.",
          {
            code: error.code ?? "session_restore_failed",
          },
        );
      }
      return data?.session ?? null;
    },

    /**
     * Refreshes the session, using `refreshToken` when given and the stored session otherwise.
     * @throws {AuthServiceError} Supabase error `code` (default `session_refresh_failed`), or `session_missing`.
     */
    async refreshSession(refreshToken) {
      const result = refreshToken
        ? await supabase.auth.refreshSession({ refresh_token: refreshToken })
        : await supabase.auth.refreshSession();
      const { data, error } = result;
      if (error) {
        throw new AuthServiceError(
          error.message ?? "Could not refresh the session.",
          {
            code: error.code ?? "session_refresh_failed",
            status: error.status ?? null,
          },
        );
      }
      if (!data?.session) {
        throw new AuthServiceError(
          "Supabase did not return a refreshed session.",
          {
            code: "session_missing",
          },
        );
      }
      return data.session;
    },

    /**
     * Reads the caller's profile (`GET /me`) as raw `data`; validate with `createSessionProfile`.
     * @throws {AuthServiceError} API error `code` (default `profile_request_failed`) or `invalid_profile_response`;
     *   transport errors from `apiRequest` propagate unchanged.
     */
    async getProfile(accessToken) {
      const response = await request(PROFILE_PATH, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return readApiResponse(response);
    },

    /**
     * Clears the session stored on this device only (`scope: 'local'`).
     * @throws {AuthServiceError} Supabase error `code` (default `session_clear_failed`).
     */
    async signOut() {
      // This app clears the current device's persisted session without ending
      // sessions belonging to another provisioned operator/device.
      const { error: localError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (localError) {
        throw new AuthServiceError(
          "Could not clear the local Supabase session.",
          {
            code: localError.code ?? "session_clear_failed",
            status: localError.status ?? null,
          },
        );
      }
    },
  });
}
