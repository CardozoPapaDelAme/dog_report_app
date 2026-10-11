/**
 * @module presenters/health
 * Shapes the health check response.
 */
/**
 * Responds 200 with the health body.
 * @param {import('hono').Context} c - Hono request context.
 * @param {object} body - Health status, for example `{ ok: true, database: 'up' }`.
 * @returns {Response} `{ data: body }` with the `X-Request-Id` header.
 */
export function presentHealth(c, body) {
  const requestId = c.get('requestId') ?? '';
  c.header('X-Request-Id', requestId);
  return c.json({ data: body }, 200);
}
