/**
 * @module infrastructure/constantTime
 * Timing-safe string comparison for secrets, based on Web Crypto SHA-256 digests.
 */
/**
 * Compares two strings without leaking their common prefix length through timing.
 * Both inputs are hashed first, so the comparison always runs over equal-length digests.
 * @param {string} left - First value.
 * @param {string} right - Second value.
 * @returns {Promise<boolean>} True when both strings are equal.
 */
export async function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}
