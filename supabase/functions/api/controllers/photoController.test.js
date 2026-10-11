import { createPhotoController } from "./photoController.js";
import { PhotoServiceError } from "../services/photoService.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const REPORT_ID = "11111111-2222-4333-8444-555555555555";
const FINGERPRINT = "device-fingerprint-001";

function controllerWithService(service) {
  return createPhotoController(service);
}

function fakeContext({
  url = `/reports/${REPORT_ID}/photo`,
  reportId = REPORT_ID,
  headers = {},
  body = {},
} = {}) {
  const responseHeaders = new Headers();
  const headerValue = (name) => headers[name] ?? headers[name.toLowerCase()];
  return {
    req: {
      url: `https://api.example.test${url}`,
      param(name) {
        return name === "report_id" ? reportId : undefined;
      },
      header: headerValue,
      parseBody: async () => body,
    },
    get(name) {
      return name === "requestId" ? "request-test" : undefined;
    },
    header(name, value) {
      responseHeaders.set(name, value);
    },
    json(payload, status = 200) {
      responseHeaders.set("Content-Type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(payload), {
        status,
        headers: responseHeaders,
      });
    },
    body(responseBody, status = 200) {
      return new Response(responseBody, { status, headers: responseHeaders });
    },
  };
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
  const controller = controllerWithService(serviceThatMustNotRun());
  const response = await controller.status(fakeContext({
    url: `/reports/${REPORT_ID}/photo-status`,
  }));
  const body = await response.json();

  assert(response.status === 400, JSON.stringify(body));
  assert(
    body.error.code === "invalid_request",
    "missing fingerprint is invalid_request",
  );
});

Deno.test("photo upload rejects multipart fields other than a single photo part", async () => {
  const controller = controllerWithService(serviceThatMustNotRun());
  const response = await controller.upload(fakeContext({
    headers: {
      "Content-Type": "multipart/form-data; boundary=fixture",
      "X-Device-Fingerprint": FINGERPRINT,
    },
    body: {
      photo: new File(["not-an-image"], "fake.jpg", { type: "image/jpeg" }),
      extra: "unsupported",
    },
  }));
  const body = await response.json();

  assert(response.status === 400, JSON.stringify(body));
  assert(
    body.error.code === "invalid_request",
    "extra multipart fields should reject",
  );
});

Deno.test("photo upload maps unsupported sanitizer media to public 415 unsupported_photo_type", async () => {
  const controller = controllerWithService({
    getStatus() {
      throw new Error("status service should not run");
    },
    download() {
      throw new Error("download service should not run");
    },
    upload() {
      throw new PhotoServiceError(
        "unsupported_media_type",
        "Only JPEG and PNG photos are supported.",
      );
    },
  });
  const response = await controller.upload(fakeContext({
    headers: {
      "Content-Type": "multipart/form-data; boundary=fixture",
      "X-Device-Fingerprint": FINGERPRINT,
    },
    body: {
      photo: new File(["not-a-supported-photo"], "report.webp", {
        type: "image/webp",
      }),
    },
  }));
  const body = await response.json();

  assert(response.status === 415, JSON.stringify(body));
  assert(
    body.error.code === "unsupported_photo_type",
    "public API must expose RNF32 unsupported_photo_type",
  );
});

Deno.test("photo routes reject malformed report ids before service work", async () => {
  const controller = controllerWithService(serviceThatMustNotRun());
  const response = await controller.status(fakeContext({
    url: "/reports/not-a-uuid/photo-status",
    reportId: "not-a-uuid",
    headers: { "X-Device-Fingerprint": FINGERPRINT },
  }));
  const body = await response.json();

  assert(response.status === 400, JSON.stringify(body));
  assert(
    body.error.message.includes("report_id"),
    "error should identify report_id",
  );
});
