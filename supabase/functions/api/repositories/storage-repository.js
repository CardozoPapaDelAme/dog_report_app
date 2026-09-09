export async function deleteStorageObject(
  { supabaseUrl, serviceRoleKey, bucket, objectPath },
  fetchImplementation = fetch,
) {
  const response = await fetchImplementation(
    `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [objectPath] }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    const error = new Error('storage_delete_failed');
    error.code = 'storage_delete_failed';
    error.status = response.status;
    throw error;
  }
}
