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

function storageError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

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
