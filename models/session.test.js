import {
  createAuthenticatedSession,
  createSession,
  createSessionProfile,
  dashboardForRole,
  isSessionExpired,
} from "./session.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(callback, message) {
  try {
    callback();
  } catch {
    return;
  }
  throw new Error(message);
}

const authSession = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_at: 1_800_000_000,
};

Deno.test("session model keeps Supabase tokens and expiry in app naming", () => {
  const session = createSession(authSession);
  assert(session.accessToken === "access-token", "should map the access token");
  assert(
    session.refreshToken === "refresh-token",
    "should map the refresh token",
  );
  assert(session.expiresAt === 1_800_000_000, "should preserve expiry seconds");
  assert(Object.isFrozen(session), "session should be immutable");
  assertThrows(
    () => createSession({ ...authSession, refresh_token: " " }),
    "should reject an empty refresh token",
  );
  assertThrows(
    () => createSession({ ...authSession, expires_at: "1800000000" }),
    "should reject nonnumeric expiry",
  );
});

Deno.test("session profile accepts only an active server-provided application role", () => {
  const profile = createSessionProfile({
    user_id: "11111111-1111-4111-8111-111111111111",
    role: "association",
    display_name: "Hotel account",
    active: true,
  });

  assert(profile.role === "association", "should preserve the server role");
  assert(profile.active === true, "should require an active profile");
  assert(
    createSessionProfile({
      user_id: "id",
      role: "association",
      display_name: null,
      active: true,
    }).displayName === null,
    "should allow nullable display names from the API contract",
  );
  assertThrows(
    () => createSessionProfile({ role: "administrator", active: false }),
    "should reject inactive profiles",
  );
  assertThrows(
    () => createSessionProfile({ role: "reporter", active: true }),
    "should reject unknown roles",
  );
});

Deno.test("authenticated session combines auth tokens with the validated /me profile", () => {
  const session = createAuthenticatedSession(authSession, {
    user_id: "22222222-2222-4222-8222-222222222222",
    role: "administrator",
    display_name: "Admin account",
    active: true,
  });

  assert(
    session.accessToken === "access-token",
    "should include Supabase Auth credentials",
  );
  assert(
    session.profile.userId === "22222222-2222-4222-8222-222222222222",
    "should include server-verified identity",
  );
  assert(Object.isFrozen(session), "authenticated session should be immutable");
});

Deno.test("session expiry uses Unix seconds and dashboard derives only from the validated role", () => {
  const valid = createSession(authSession);
  assert(
    !isSessionExpired(valid, 1_799_999_999_000),
    "should treat a future expiry as valid",
  );
  assert(
    isSessionExpired(valid, 1_800_000_000_000),
    "should expire at the timestamp boundary",
  );
  assert(
    dashboardForRole("association") === "associationDashboard",
    "association should reach its dashboard",
  );
  assert(
    dashboardForRole("administrator") === "administratorDashboard",
    "administrator should reach its dashboard",
  );
  assertThrows(
    () => dashboardForRole("reporter"),
    "should reject unknown roles",
  );
});
