export function presentIdentity(c, profile) {
    const requestId = c.get('requestId') ?? '';
    c.header('X-Request-Id', requestId);
    return c.json({ data: profile });
}