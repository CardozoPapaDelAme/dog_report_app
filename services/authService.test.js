import { createAuthService } from "./authService.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertRejects(action, expectedCode) {
  try {
    await action();
  } catch (error) {
    assert(
      error.code === expectedCode,
      `expected ${expectedCode}, got ${error.code}`,
    );
    return;
  }
  throw new Error(`expected rejection with ${expectedCode}`);
}

function fakeSupabase(overrides = {}) {
  const calls = [];
  const auth = {
    async signInWithPassword(credentials) {
      calls.push(["signInWithPassword", credentials]);
      return {
        data: {
          session: {
            access_token: "access",
            refresh_token: "refresh",
            expires_at: 1_900_000_000,
          },
        },
        error: null,
      };
    },
    async getSession() {
      calls.push(["getSession"]);
      return { data: { session: null }, error: null };
    },
    async refreshSession(options) {
      calls.push(["refreshSession", options]);
      return {
        data: {
          session: {
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_at: 1_900_000_000,
          },
        },
        error: null,
      };
    },
    async signOut(options) {
      calls.push(["signOut", options]);
      return { error: null };
    },
    ...overrides,
  };
  return { client: { auth }, calls };
}

Deno.test("auth service signs in directly through Supabase Auth", async () => {
  const { client, calls } = fakeSupabase();
  const service = createAuthService({
    supabase: client,
    request: () => {
      throw new Error("/me should not be called by sign in service");
    },
  });
  const session = await service.signIn("person@example.com", "secret");

  assert(session.access_token === "access", "should return Supabase session");
  assert(calls[0][0] === "signInWithPassword", "should use password sign in");
  assert(
    calls[0][1].email === "person@example.com",
    "should pass email to Auth",
  );
});

Deno.test("auth service calls /me with the Supabase bearer token", async () => {
  const { client } = fakeSupabase();
  let requestPath;
  let requestOptions;
  const service = createAuthService({
    supabase: client,
    request: async (path, options) => {
      requestPath = path;
      requestOptions = options;
      return Response.json({ data: { role: "association" } });
    },
  });

  const profile = await service.getProfile("signed-access-token");
  assert(requestPath === "/me", "should use /me relative to the API base URL");
  assert(
    requestOptions.headers.Authorization === "Bearer signed-access-token",
    "should send the access token",
  );
  assert(profile.role === "association", "should return the server profile");
});

Deno.test("auth service preserves typed /me failures for controller cleanup", async () => {
  const { client } = fakeSupabase();
  const service = createAuthService({
    supabase: client,
    request: async () =>
      Response.json({
        error: { code: "inactive_profile", message: "Inactive" },
      }, { status: 403 }),
  });

  await assertRejects(
    () => service.getProfile("signed-access-token"),
    "inactive_profile",
  );
});

Deno.test("auth service clears the current device session without logging out other devices", async () => {
  const calls = [];
  const { client } = fakeSupabase({
    async signOut(options) {
      calls.push(options.scope);
      return options.scope === "local" ? { error: null } : { error: { code: "unexpected_scope" } };
    },
  });
  const service = createAuthService({ supabase: client });
  await service.signOut();

  assert(
    calls.join(",") === "local",
    "should clear only this device's session",
  );
});
