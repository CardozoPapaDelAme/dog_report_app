/**
 * @module presenters/identityPresenter
 * Shapes the authenticated caller's profile.
 */
/**
 * Responds 200 with the caller's profile.
 * @param {import('hono').Context} c - Hono request context.
 * @param {{user_id: string, role: string, display_name: string | null, active: boolean}} profile - Result of `getCurrentProfile`.
 * @returns {Response} `{ data: profile }` with the `X-Request-Id` header.
 */
export function presentIdentity(c, profile) {
    const requestId = c.get('requestId') ?? '';
    c.header('X-Request-Id', requestId);
    return c.json({ data: profile });
}
