/**
 * @module repositories/storageRepository
 * Supabase Storage REST client for photo objects, authenticated with the service role key.
 * Each request has a 10-second timeout; `fetchImplementation` is injectable for tests.
 */
function storageHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extra,
  };
}

function storageBaseUrl(supabaseUrl) {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object`;
}

function encodeObjectPath(objectPath) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

function objectUrl({ supabaseUrl, bucket, objectPath }) {
  return `${storageBaseUrl(supabaseUrl)}/${encodeURIComponent(bucket)}/${
    encodeObjectPath(objectPath)
  }`;
}

/** Builds an `Error` carrying a storage error `code` and the HTTP `status`. */
function storageError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

/**
 * Uploads an object without overwriting an existing one (`x-upsert: false`).
 * @param {object} options
 * @param {string} options.supabaseUrl - Supabase project URL.
 * @param {string} options.serviceRoleKey - Service role key.
 * @param {string} options.bucket - Bucket name.
 * @param {string} options.objectPath - Object path inside the bucket.
 * @param {BodyInit} options.bytes - Object body.
 * @param {string} options.contentType - MIME type.
 * @param {typeof fetch} [fetchImplementation] - Fetch function.
 * @returns {Promise<void>}
 * @throws {Error} `storage_upload_failed`, with the HTTP `status`, on a non-2xx response.
 */
export async function uploadStorageObject(
  { supabaseUrl, serviceRoleKey, bucket, objectPath, bytes, contentType },
  fetchImplementation = fetch,
) {
  const response = await fetchImplementation(
    objectUrl({ supabaseUrl, bucket, objectPath }),
    {
      method: "POST",
      headers: storageHeaders(serviceRoleKey, {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=0, no-store",
        "x-upsert": "false",
      }),
      body: bytes,
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw storageError("storage_upload_failed", response.status);
  }
}

/**
 * Downloads an object as a stream.
 * @param {object} options
 * @param {string} options.supabaseUrl - Supabase project URL.
 * @param {string} options.serviceRoleKey - Service role key.
 * @param {string} options.bucket - Bucket name.
 * @param {string} options.objectPath - Object path inside the bucket.
 * @param {typeof fetch} [fetchImplementation] - Fetch function.
 * @returns {Promise<{body: ReadableStream<Uint8Array> | null, contentType: string | null, contentLength: string | null}>}
 * @throws {Error} `storage_download_failed`, with the HTTP `status`, on a non-2xx response.
 */
export async function downloadStorageObject(
  { supabaseUrl, serviceRoleKey, bucket, objectPath },
  fetchImplementation = fetch,
) {
  const response = await fetchImplementation(
    objectUrl({ supabaseUrl, bucket, objectPath }),
    {
      method: "GET",
      headers: storageHeaders(serviceRoleKey),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw storageError("storage_download_failed", response.status);
  }
  return {
    body: response.body,
    contentType: response.headers.get("Content-Type"),
    contentLength: response.headers.get("Content-Length"),
  };
}

/**
 * Deletes an object by path.
 * @param {object} options
 * @param {string} options.supabaseUrl - Supabase project URL.
 * @param {string} options.serviceRoleKey - Service role key.
 * @param {string} options.bucket - Bucket name.
 * @param {string} options.objectPath - Object path inside the bucket.
 * @param {typeof fetch} [fetchImplementation] - Fetch function.
 * @returns {Promise<void>}
 * @throws {Error} `storage_delete_failed`, with the HTTP `status`, on a non-2xx response.
 */
export async function deleteStorageObject(
  { supabaseUrl, serviceRoleKey, bucket, objectPath },
  fetchImplementation = fetch,
) {
  const response = await fetchImplementation(
    `${storageBaseUrl(supabaseUrl)}/${encodeURIComponent(bucket)}`,
    {
      method: "DELETE",
      headers: storageHeaders(serviceRoleKey, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ prefixes: [objectPath] }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw storageError("storage_delete_failed", response.status);
  }
}
