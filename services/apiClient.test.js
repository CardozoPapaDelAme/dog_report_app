import { apiRequest, getApiBaseUrl } from './apiClient.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

function withApiBaseUrl(value, fn) {
  const previousProcess = Object.getOwnPropertyDescriptor(globalThis, 'process');
  const env = {};
  if (value == null) {
    delete env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    env.EXPO_PUBLIC_API_BASE_URL = value;
  }
  Object.defineProperty(globalThis, 'process', {
    configurable: true,
    value: { env },
  });
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previousProcess) {
        Object.defineProperty(globalThis, 'process', previousProcess);
      } else {
        delete globalThis.process;
      }
    });
}

Deno.test('API client requires an API base URL with a typed error', async () => {
  await withApiBaseUrl(null, () => {
    try {
      getApiBaseUrl();
      throw new Error('Expected failure');
    } catch (error) {
      assert(error.code === 'api_base_url_missing');
    }
  });
});

Deno.test('API client preserves request id when fetch cannot reach the server', async () => {
  const originalFetch = globalThis.fetch;
  await withApiBaseUrl('https://api.example/functions/v1/api/', async () => {
    globalThis.fetch = async (url, options) => {
      assert(url === 'https://api.example/functions/v1/api/reports');
      assert(options.headers['X-Request-Id'] === 'request-1');
      throw new TypeError('Network request failed');
    };
    try {
      await apiRequest('/reports', { requestId: 'request-1' });
      throw new Error('Expected failure');
    } catch (error) {
      assert(error.code === 'network_unavailable');
      assert(error.requestId === 'request-1');
      assert(error.status === null);
      assert(error.url === 'https://api.example/functions/v1/api/reports');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test('API client marks aborted requests as timeout failures', async () => {
  const originalFetch = globalThis.fetch;
  await withApiBaseUrl('https://api.example/functions/v1/api', async () => {
    globalThis.fetch = async () => {
      throw Object.assign(new Error('The operation was aborted.'), {
        name: 'AbortError',
      });
    };
    try {
      await apiRequest('/reports', { requestId: 'request-timeout' });
      throw new Error('Expected failure');
    } catch (error) {
      assert(error.code === 'request_timeout');
      assert(error.requestId === 'request-timeout');
      assert(error.status === null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
