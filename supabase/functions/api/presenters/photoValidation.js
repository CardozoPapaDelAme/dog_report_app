/**
 * @module presenters/photoValidation
 * Shapes the anonymous photo validation threshold. Never includes `change_note` or `created_by`.
 */
/**
 * Responds 200 with the active threshold.
 * @param {import('hono').Context} c - Hono request context.
 * @param {{version: number, photo_dog_probability_min: number}} state - Result of the Service.
 * @returns {Response} `{ data: { version, photo_dog_probability_min } }` with the `X-Request-Id` header.
 */
export function presentPhotoValidation(c, state) {
  c.header("X-Request-Id", c.get("requestId") ?? "");
  return c.json({
    data: {
      version: state.version,
      photo_dog_probability_min: state.photo_dog_probability_min,
    },
  }, 200);
}
