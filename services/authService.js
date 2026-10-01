import { apiRequest } from "./apiClient.js";

// TODO(auth-routing): keep this isolated for removal if API base URL ownership changes.
const PROFILE_PATH = "/me";

export class AuthServiceError extends Error {
  constructor(message, { code = "auth_request_failed", status = null } = {}) {
    super(message);
    this.name = "AuthServiceError";
    this.code = code;
    this.status = status;
  }
}

function requireSupabaseClient(supabase) {
  if (!supabase?.auth) {
    throw new TypeError("A configured Supabase client is required.");
  }
}

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
 */
export function createAuthService({ supabase, request = apiRequest }) {
  requireSupabaseClient(supabase);

  return Object.freeze({
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

    async getProfile(accessToken) {
      const response = await request(PROFILE_PATH, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return readApiResponse(response);
    },

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
