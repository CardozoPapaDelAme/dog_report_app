const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

function createRequestId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl || !baseUrl.trim()) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');
  }
  return baseUrl.replace(/\/+$/, '');
}

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
  } finally {
    clearTimeout(timeout);
  }
}
