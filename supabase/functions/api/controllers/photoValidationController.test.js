import { Hono } from "hono";

import { ConfigurationError } from "../domain/configuration.js";
import { createPhotoValidationRoutes } from "../routes/photoValidation.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function appWith(service) {
  const app = new Hono();
  app.route("/", createPhotoValidationRoutes({ service }));
  return app;
}

const ok = { read: () => Promise.resolve({ version: 2, photo_dog_probability_min: 0.2, change_note: "x" }) };

Deno.test("photo validation endpoint returns only version and threshold on both paths", async () => {
  for (const path of ["/public/photo-validation", "/api/public/photo-validation"]) {
    const response = await appWith(ok).request(path);
    assert(response.status === 200, "200 expected");
    const body = await response.json();
    assert(
      JSON.stringify(body) === JSON.stringify({ data: { version: 2, photo_dog_probability_min: 0.2 } }),
      "only public fields",
    );
  }
});

Deno.test("photo validation endpoint rejects query parameters and non-GET methods", async () => {
  let calls = 0;
  const app = appWith({ read: () => { calls += 1; return ok.read(); } });
  const query = await app.request("/public/photo-validation?x=1");
  assert(query.status === 400 && (await query.json()).error.code === "invalid_request", "400");
  assert(calls === 0, "service not called");
  const post = await app.request("/public/photo-validation", { method: "POST" });
  assert(post.status === 405 && post.headers.get("Allow") === "GET", "405 with Allow");
});

Deno.test("photo validation endpoint maps service failures", async () => {
  for (const [code, status] of [["configuration_unavailable", 503], ["dependency_unavailable", 503]]) {
    const response = await appWith({
      read: () => Promise.reject(new ConfigurationError(code, "down")),
    }).request("/public/photo-validation");
    assert(response.status === status && (await response.json()).error.code === code, code);
  }
  const unknown = await appWith({ read: () => Promise.reject(new Error("boom")) })
    .request("/public/photo-validation");
  assert(unknown.status === 500, "500 for unknown");
});
