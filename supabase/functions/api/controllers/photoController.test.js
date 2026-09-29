import { Hono } from "hono";

import { createPhotoRoutes } from "../routes/photo.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const REPORT_ID = "11111111-2222-4333-8444-555555555555";
const FINGERPRINT = "device-fingerprint-001";

function appWithService(service) {
  const app = new Hono();
  app.route("/", createPhotoRoutes({ service }));
  return app;
}

function serviceThatMustNotRun() {
  return {
    getStatus() {
      throw new Error("status service should not run");
    },
    upload() {
      throw new Error("upload service should not run");
    },
    download() {
      throw new Error("download service should not run");
    },
  };
}

Deno.test("photo-status rejects missing device fingerprint before service work", async () => {
  const app = appWithService(serviceThatMustNotRun());
  const response = await app.request(`/reports/${REPORT_ID}/photo-status`);
  const body = await response.json();

  assert(response.status === 400, JSON.stringify(body));
  assert(
    body.error.code === "invalid_request",
    "missing fingerprint is invalid_request",
  );
});

Deno.test("photo upload rejects multipart fields other than a single photo part", async () => {
  const app = appWithService(serviceThatMustNotRun());
  const form = new FormData();
  form.set(
    "photo",
    new File(["not-an-image"], "fake.jpg", { type: "image/jpeg" }),
  );
  form.set("extra", "unsupported");

  const response = await app.request(`/reports/${REPORT_ID}/photo`, {
    method: "POST",
    headers: { "X-Device-Fingerprint": FINGERPRINT },
    body: form,
  });
  const body = await response.json();

  assert(response.status === 400, JSON.stringify(body));
  assert(
    body.error.code === "invalid_request",
    "extra multipart fields should reject",
  );
});

Deno.test("photo routes reject malformed report ids before service work", async () => {
  const app = appWithService(serviceThatMustNotRun());
  const response = await app.request("/reports/not-a-uuid/photo-status", {
    headers: { "X-Device-Fingerprint": FINGERPRINT },
  });
  const body = await response.json();

  assert(response.status === 400, JSON.stringify(body));
  assert(
    body.error.message.includes("report_id"),
    "error should identify report_id",
  );
});
