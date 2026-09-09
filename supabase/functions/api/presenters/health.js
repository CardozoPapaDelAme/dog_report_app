export function presentHealth(c, body) {
  const requestId = c.get('requestId') ?? '';
  c.header('X-Request-Id', requestId);
  return c.json({ data: body }, 200);
}
