export function presentError(c, status, code, message, details) {
  const requestId = c.get('requestId') ?? '';
  c.header('X-Request-Id', requestId);
  const error = { code, message, request_id: requestId };
  if (details) {
    error.details = details;
  }
  return c.json({ error }, status);
}
