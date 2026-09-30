import test from "node:test";
import assert from "node:assert/strict";

import { createLoginController } from "./loginController.js";

const freshSession = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_at: 2000,
};

function authService(overrides = {}) {
  const calls = [];
  return {
    calls,
    async signIn(email, password) {
      calls.push(["signIn", email, password]);
      return freshSession;
    },
    async getSession() { calls.push(["getSession"]); return null; },
    async refreshSession(token) {
      calls.push(["refreshSession", token]);
      return freshSession;
    },
    async getProfile(token) {
      calls.push(["getProfile", token]);
      return {
        user_id: "user-1",
        role: "association",
        display_name: "Hotel operator",
        active: true,
      };
    },
    async signOut() { calls.push(["signOut"]); },
    ...overrides,
  };
}

test("login navigates from the server-verified association role", async () => {
  const service = authService();
  const controller = createLoginController({ authService: service, now: () => 1000 });

  const result = await controller.login("operator@example.com", "secret");

  assert.equal(result.destination, "associationDashboard");
  assert.equal(result.session.profile.role, "association");
  assert.deepEqual(service.calls.map(([name]) => name), ["signIn", "getProfile"]);
});

test("administrator dashboard is selected only from GET /me", async () => {
  const service = authService({
    async getProfile() {
      return { user_id: "admin-1", role: "administrator", display_name: null, active: true };
    },
  });
  const controller = createLoginController({ authService: service, now: () => 1000 });

  const result = await controller.login("admin@example.com", "secret");

  assert.equal(result.destination, "administratorDashboard");
});

test("expired restored session is refreshed before requesting /me", async () => {
  const service = authService({
    async getSession() {
      service.calls.push(["getSession"]);
      return { ...freshSession, expires_at: 1 };
    },
  });
  const controller = createLoginController({ authService: service, now: () => 1000 });

  await controller.restoreSession();

  assert.deepEqual(service.calls.map(([name]) => name), [
    "getSession",
    "refreshSession",
    "getProfile",
  ]);
});

test("a failed /me check clears the Supabase session and keeps the original error", async () => {
  const profileError = new Error("Account is inactive");
  const service = authService();
  service.getProfile = async () => {
    service.calls.push(["getProfile", "access-token"]);
    throw profileError;
  };
  const controller = createLoginController({ authService: service, now: () => 1000 });

  await assert.rejects(controller.login("operator@example.com", "secret"), profileError);
  assert.deepEqual(service.calls.map(([name]) => name), ["signIn", "getProfile", "signOut"]);
});

test("an unknown server role clears the session instead of choosing a dashboard", async () => {
  const service = authService({
    async getProfile() {
      return { user_id: "user-1", role: "public", display_name: null, active: true };
    },
  });
  const controller = createLoginController({ authService: service, now: () => 1000 });

  await assert.rejects(controller.login("user@example.com", "secret"));
  assert.equal(service.calls.at(-1)[0], "signOut");
});
