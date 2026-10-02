import { isNativeMapAvailable } from './mapAvailability.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }

Deno.test('Expo Go (storeClient) on native has no map', () => {
  assert(isNativeMapAvailable({ executionEnvironment: 'storeClient', platform: 'ios' }) === false);
  assert(isNativeMapAvailable({ executionEnvironment: 'storeClient', platform: 'android' }) === false);
});

Deno.test('development and standalone builds have the map', () => {
  for (const executionEnvironment of ['bare', 'standalone']) {
    assert(isNativeMapAvailable({ executionEnvironment, platform: 'android' }) === true, executionEnvironment);
  }
});

Deno.test('web always uses the map view (stub)', () => {
  assert(isNativeMapAvailable({ executionEnvironment: 'storeClient', platform: 'web' }) === true);
  assert(isNativeMapAvailable({ executionEnvironment: 'bare', platform: 'web' }) === true);
});
