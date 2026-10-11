/**
 * @module middleware/requestId
 * Assigns a request id to every request, reusing a non-blank incoming `X-Request-Id` or generating a UUID.
 */
/**
 * Stores the request id in the context as `requestId` and echoes it in the `X-Request-Id` response header.
 * @param {import('hono').Context} c - Hono request context.
 * @param {import('hono').Next} next - Next middleware.
 * @returns {Promise<void>}
 */
export async function requestId(c, next) {
  const incoming = c.req.header('X-Request-Id');
  const id =
    incoming && incoming.trim()
      ? incoming.trim()
      : crypto.randomUUID();
  c.set('requestId', id);
  await next();
  c.header('X-Request-Id', id);
}
