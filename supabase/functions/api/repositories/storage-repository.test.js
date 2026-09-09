import { deleteStorageObject } from './storage-repository.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const request = {
  supabaseUrl: 'https://project.supabase.co',
  serviceRoleKey: 'server-only-key',
  bucket: 'approved-photos',
  objectPath: 'reports/photo.jpg',
};

Deno.test('storage deletion uses the authenticated bulk delete API', async () => {
  let capturedUrl;
  let capturedOptions;
  await deleteStorageObject(request, (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return Promise.resolve(new Response('[]', { status: 200 }));
  });

  assert(capturedUrl.endsWith('/storage/v1/object/approved-photos'), 'bucket URL should be exact');
  assert(capturedOptions.method === 'DELETE', 'method should be DELETE');
  assert(capturedOptions.headers.apikey === request.serviceRoleKey, 'apikey should stay server-side');
  assert(
    capturedOptions.headers.Authorization === `Bearer ${request.serviceRoleKey}`,
    'authorization should use the server credential',
  );
  assert(
    capturedOptions.body === JSON.stringify({ prefixes: [request.objectPath] }),
    'request should delete only the selected object',
  );
});

Deno.test('storage deletion returns a typed retryable failure', async () => {
  try {
    await deleteStorageObject(request, () => Promise.resolve(new Response('', { status: 503 })));
    throw new Error('storage failure was accepted');
  } catch (error) {
    assert(error.code === 'storage_delete_failed', 'failure should have a stable code');
    assert(error.status === 503, 'failure should retain the dependency status');
  }
});
