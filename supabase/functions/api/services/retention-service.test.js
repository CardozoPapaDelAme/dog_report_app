import { runRetention, validateRetentionConfig } from './retention-service.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function config(overrides = {}) {
  return {
    supabaseUrl: 'https://project-ref.supabase.co',
    serviceRoleKey: 'server-only-key',
    expectedProjectRef: 'project-ref',
    expectedEnvironment: 'staging',
    approvedPhotosBucket: 'approved-photos',
    ...overrides,
  };
}

Deno.test('retention preflight requires matching project and complete server configuration', () => {
  assert(validateRetentionConfig(config()), 'valid configuration should pass');
  assert(!validateRetentionConfig(config({ expectedProjectRef: 'other' })), 'project mismatch should fail');
  assert(!validateRetentionConfig(config({ expectedEnvironment: 'demo' })), 'unknown environment should fail');
  assert(!validateRetentionConfig(config({ serviceRoleKey: '' })), 'missing Storage key should fail');
});

Deno.test('partial Storage failure acknowledges only successes and still finalizes', async () => {
  const events = [];
  const dependencies = {
    getConfig: () => config(),
    prepareAndList: () => {
      events.push('prepare');
      return {
        preparation: { photos_marked_for_purge: 3 },
        photos: [
          { id: 'photo-a', approved_object_path: 'a.jpg' },
          { id: 'photo-b', approved_object_path: 'b.jpg' },
          { id: 'photo-c', approved_object_path: null },
        ],
      };
    },
    deleteObject: ({ objectPath }) => {
      events.push(`delete:${objectPath}`);
      if (objectPath === 'b.jpg') {
        const error = new Error('storage_delete_failed');
        error.code = 'storage_delete_failed';
        error.status = 503;
        throw error;
      }
    },
    acknowledge: (photoId) => {
      events.push(`ack:${photoId}`);
      return true;
    },
    finalize: () => {
      events.push('finalize');
      return { report_rows_purged: 1, audit_rows_purged: 2 };
    },
  };

  const result = await runRetention(dependencies);
  assert(result.objects_deleted === 1, 'one Storage object should be deleted');
  assert(result.photos_acknowledged === 2, 'successful and pathless photos should be acknowledged');
  assert(result.failures.length === 1, 'failed Storage deletion should be reported');
  assert(result.failures[0].photo_id === 'photo-b', 'failure should identify the retained row');
  assert(!events.includes('ack:photo-b'), 'failed object deletion must not be acknowledged');
  assert(
    JSON.stringify(events) === JSON.stringify([
      'prepare',
      'delete:a.jpg',
      'ack:photo-a',
      'delete:b.jpg',
      'ack:photo-c',
      'finalize',
    ]),
    'retention phases should execute in strict order',
  );
  assert(events.at(-1) === 'finalize', 'finalization should run after object attempts');
});

Deno.test('dynamic environment mismatch aborts before object and finalization work', async () => {
  let dependencyWork = 0;
  try {
    await runRetention({
      getConfig: () => config(),
      prepareAndList: () => {
        const error = new Error('retention_environment_mismatch');
        error.code = 'preflight_mismatch';
        throw error;
      },
      deleteObject: () => {
        dependencyWork += 1;
      },
      acknowledge: () => {
        dependencyWork += 1;
      },
      finalize: () => {
        dependencyWork += 1;
      },
    });
    throw new Error('environment mismatch was accepted');
  } catch (error) {
    assert(error.code === 'preflight_mismatch', 'environment mismatch should remain typed');
    assert(dependencyWork === 0, 'environment mismatch must abort the retention pipeline');
  }
});

Deno.test('failed static preflight performs no retention work', async () => {
  let prepared = false;
  try {
    await runRetention({
      getConfig: () => config({ expectedProjectRef: 'wrong-project' }),
      prepareAndList: () => {
        prepared = true;
      },
    });
    throw new Error('preflight mismatch was accepted');
  } catch (error) {
    assert(error.code === 'preflight_mismatch', 'preflight should return a stable code');
    assert(!prepared, 'preflight failure must happen before database work');
  }
});
