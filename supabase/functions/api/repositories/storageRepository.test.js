import {
  deleteStorageObject,
  downloadStorageObject,
  uploadStorageObject,
} from "./storageRepository.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const request = {
  supabaseUrl: "https://project.supabase.co",
  serviceRoleKey: "server-only-key",
  bucket: "approved-photos",
  objectPath: "reports/photo.jpg",
};

Deno.test("storage deletion uses the authenticated bulk delete API", async () => {
  let capturedUrl;
  let capturedOptions;
  await deleteStorageObject(request, (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return Promise.resolve(new Response("[]", { status: 200 }));
  });

  assert(
    capturedUrl.endsWith("/storage/v1/object/approved-photos"),
    "bucket URL should be exact",
  );
  assert(capturedOptions.method === "DELETE", "method should be DELETE");
  assert(
    capturedOptions.headers.apikey === request.serviceRoleKey,
    "apikey should stay server-side",
  );
  assert(
    capturedOptions.headers.Authorization ===
      `Bearer ${request.serviceRoleKey}`,
    "authorization should use the server credential",
  );
  assert(
    capturedOptions.body === JSON.stringify({ prefixes: [request.objectPath] }),
    "request should delete only the selected object",
  );
});

Deno.test("storage deletion returns a typed retryable failure", async () => {
  try {
    await deleteStorageObject(
      request,
      () => Promise.resolve(new Response("", { status: 503 })),
    );
    throw new Error("storage failure was accepted");
  } catch (error) {
    assert(
      error.code === "storage_delete_failed",
      "failure should have a stable code",
    );
    assert(error.status === 503, "failure should retain the dependency status");
  }
});

Deno.test("storage upload writes one private object with server credentials", async () => {
  let capturedUrl;
  let capturedOptions;
  await uploadStorageObject(
    {
      ...request,
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    },
    (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
  );

  assert(
    capturedUrl.endsWith(
      "/storage/v1/object/approved-photos/reports%2Fphoto.jpg",
    ) === false,
    "object path should be encoded by path segment, not as one slash-containing segment",
  );
  assert(
    capturedUrl.endsWith(
      "/storage/v1/object/approved-photos/reports/photo.jpg",
    ),
  );
  assert(capturedOptions.method === "POST", "method should upload");
  assert(capturedOptions.headers.apikey === request.serviceRoleKey);
  assert(
    capturedOptions.headers.Authorization ===
      `Bearer ${request.serviceRoleKey}`,
  );
  assert(capturedOptions.headers["Content-Type"] === "image/png");
  assert(capturedOptions.headers["x-upsert"] === "false");
});

Deno.test("storage download proxies private bytes without creating a public URL", async () => {
  let capturedUrl;
  const result = await downloadStorageObject(request, (url, options) => {
    capturedUrl = url;
    assert(options.method === "GET", "method should download");
    assert(
      options.headers.Authorization === `Bearer ${request.serviceRoleKey}`,
    );
    return Promise.resolve(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg", "Content-Length": "3" },
      }),
    );
  });

  assert(
    capturedUrl.endsWith(
      "/storage/v1/object/approved-photos/reports/photo.jpg",
    ),
  );
  assert(
    result.body instanceof ReadableStream,
    "download should expose a stream",
  );
  assert(result.contentType === "image/jpeg");
  assert(
    !Object.hasOwn(result, "url"),
    "storage repository must not create public URLs",
  );
});

Deno.test("storage upload and download failures keep stable error codes", async () => {
  try {
    await uploadStorageObject(
      { ...request, bytes: new Uint8Array([1]), contentType: "image/png" },
      () => Promise.resolve(new Response("", { status: 503 })),
    );
    throw new Error("upload failure was accepted");
  } catch (error) {
    assert(error.code === "storage_upload_failed");
    assert(error.status === 503);
  }

  try {
    await downloadStorageObject(
      request,
      () => Promise.resolve(new Response("", { status: 404 })),
    );
    throw new Error("download failure was accepted");
  } catch (error) {
    assert(error.code === "storage_download_failed");
    assert(error.status === 404);
  }
});
