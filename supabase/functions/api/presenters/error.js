/**
 * @module presenters/error
 * Uniform error envelope shared by every route and Controller.
 */
/**
 * Responds with `{ error: { code, message, request_id, details? } }` and the `X-Request-Id` header.
 * @param {object} c - Hono-compatible request context.
 * @param {number} status - HTTP status code.
 * @param {string} code - Stable machine-readable error code.
 * @param {string} message - Human-readable description.
 * @param {object} [details] - Optional structured details (for example `fields`); omitted when falsy.
 * @returns {Response}
 */
export function presentError(c, status, code, message, details) {
  const requestId = c.get('requestId') ?? '';
  c.header('X-Request-Id', requestId);
  const error = { code, message, request_id: requestId };
  if (details) {
    error.details = details;
  }
  return c.json({ error }, status);
}
