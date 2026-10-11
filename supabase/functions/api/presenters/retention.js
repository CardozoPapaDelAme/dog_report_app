/**
 * @module presenters/retention
 * Shapes the result of an internal retention run.
 */
/**
 * Responds 200 when every retention step succeeded, or 207 when any step failed.
 * @param {import('hono').Context} c - Hono request context.
 * @param {{failures: Array<*>}} result - Retention run result; other fields are passed through.
 * @returns {Response} `{ data: result }` with the `X-Request-Id` header.
 */
export function presentRetentionResult(c, result) {
  const requestId = c.get('requestId') ?? '';
  c.header('X-Request-Id', requestId);
  return c.json({ data: result }, result.failures.length > 0 ? 207 : 200);
}
