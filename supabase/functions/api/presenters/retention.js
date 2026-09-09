export function presentRetentionResult(c, result) {
  const requestId = c.get('requestId') ?? '';
  c.header('X-Request-Id', requestId);
  return c.json({ data: result }, result.failures.length > 0 ? 207 : 200);
}
