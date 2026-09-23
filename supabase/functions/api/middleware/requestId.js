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
