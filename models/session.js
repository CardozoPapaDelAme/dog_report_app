const VALID_ROLES = new Set(["association", "administrator"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Validates and normalizes the Supabase Auth session fields needed by the app.
 * Supabase remains responsible for refreshing expired access tokens.
 */
export function createSession(authSession) {
  if (!authSession || typeof authSession !== "object") {
    throw new TypeError("Supabase session is required.");
  }

  const { access_token, refresh_token, expires_at } = authSession;
  if (!isNonEmptyString(access_token)) {
    throw new TypeError("Supabase access token is required.");
  }
  if (!isNonEmptyString(refresh_token)) {
    throw new TypeError("Supabase refresh token is required.");
  }
  if (!isValidTimestamp(expires_at)) {
    throw new TypeError(
      "Supabase session expiry must be a Unix timestamp in seconds.",
    );
  }

  return Object.freeze({
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: expires_at,
  });
}

/**
 * Validates the ProfileView returned by GET /me before role-based navigation.
 */
export function createSessionProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw new TypeError("Profile from GET /me is required.");
  }

  const { user_id, role, display_name, active } = profile;
  if (!isNonEmptyString(user_id)) {
    throw new TypeError("Profile user_id is required.");
  }
  if (typeof role !== "string" || !VALID_ROLES.has(role)) {
    throw new TypeError("Profile role must be association or administrator.");
  }
  if (display_name !== null && typeof display_name !== "string") {
    throw new TypeError("Profile display_name must be a string or null.");
  }
  if (active !== true) {
    throw new TypeError("Profile must be active.");
  }

  return Object.freeze({
    userId: user_id,
    role,
    displayName: display_name,
    active,
  });
}

/**
 * Combines a valid Supabase session and server-verified profile.
 */
export function createAuthenticatedSession(authSession, profile) {
  return Object.freeze({
    ...createSession(authSession),
    profile: createSessionProfile(profile),
  });
}

export function isSessionExpired(session, nowMs = Date.now()) {
  return !session || !isValidTimestamp(session.expiresAt) ||
    session.expiresAt * 1000 <= nowMs;
}

export function dashboardForRole(role) {
  if (!VALID_ROLES.has(role)) {
    throw new TypeError("A validated application role is required.");
  }
  return role === "association"
    ? "associationDashboard"
    : "administratorDashboard";
}
