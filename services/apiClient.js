/** Default request timeout in milliseconds. */
/**
 * @module services/apiClient
 * Low-level HTTP transport from the mobile client to the Edge Function API. Resolves the base URL from
 * `EXPO_PUBLIC_API_BASE_URL`, attaches a request id and a timeout, and normalizes transport failures.
 * Response envelopes are parsed by the calling service, not here.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

/** Returns a random UUID (or a timestamp-based fallback) for the `X-Request-Id` header. */
function createRequestId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Returns the configured API base URL without trailing slashes.
 * @returns {string}
 * @throws {Error} With `code: 'api_base_url_missing'` when `EXPO_PUBLIC_API_BASE_URL` is unset or blank.
 */
export function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl || !baseUrl.trim()) {
    throw Object.assign(new Error('EXPO_PUBLIC_API_BASE_URL is not set'), {
      code: 'api_base_url_missing',
    });
  }
  return baseUrl.replace(/\/+$/, '');
}

/**
 * Wraps a `fetch` failure as an Error with `code` `request_timeout` (aborted) or `network_unavailable`,
 * `status: null`, the request id, URL and original `cause`.
 */
function transportError(error, { requestId, url }) {
  const timeout =
    error?.name === 'AbortError' ||
    error?.message === 'Aborted' ||
    error?.message === 'The operation was aborted.';
  return Object.assign(
    new Error(timeout ? 'Request timed out' : error?.message ?? 'Network request failed'),
    {
      code: timeout ? 'request_timeout' : 'network_unavailable',
      status: null,
      requestId,
      url,
      cause: error,
    },
  );
}

/**
 * Sends a request to the API and returns the raw `Response`; HTTP error statuses are not thrown here.
 * @param {string} path - API path; a leading slash is added when missing.
 * @param {object} [options] - Extra `fetch` options are forwarded unchanged.
 * @param {string} [options.method='GET']
 * @param {Record<string, string>} [options.headers] - Merged over the default `Accept`/`X-Request-Id` headers.
 * @param {BodyInit} [options.body]
 * @param {string | null} [options.contentType='application/json'] - `null` omits `Content-Type` (e.g. multipart).
 * @param {number} [options.timeoutMs=15000] - Aborts the request after this many milliseconds.
 * @param {string} [options.requestId] - Defaults to a generated id.
 * @param {AbortSignal} [options.signal] - Replaces the internal timeout signal when provided.
 * @returns {Promise<Response>}
 * @throws {Error} `api_base_url_missing` (see {@link getApiBaseUrl}), or a transport error with `code`
 *   `request_timeout` or `network_unavailable`, `status: null`, `requestId` and `url`.
 */
export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    headers,
    body,
    contentType = 'application/json',
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    requestId = createRequestId(),
    ...rest
  } = options;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestHeaders = {
      Accept: 'application/json',
      'X-Request-Id': requestId,
      ...headers,
    };
    if (contentType !== null && requestHeaders['Content-Type'] === undefined) {
      requestHeaders['Content-Type'] = contentType;
    }

    const response = await fetch(url, {
      ...rest,
      method,
      signal: rest.signal ?? controller.signal,
      headers: requestHeaders,
      body,
    });
    return response;
  } catch (error) {
    throw transportError(error, { requestId, url });
  } finally {
    clearTimeout(timeout);
  }
}
