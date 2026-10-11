/**
 * @module hooks/deviceFingerprint.web
 * Web variant of the installation fingerprint: a random id persisted in `localStorage`.
 * Same export as `hooks/deviceFingerprint.js` (native, SQLite).
 */
const LOCAL_STORAGE_KEY = 'dog_report_installation_fingerprint';

/** Random id used when `crypto.randomUUID` is unavailable. */
function createFallbackFingerprint() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `installation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Returns the stored installation fingerprint, creating and storing a new one when missing or
 * shorter than 16 characters.
 * @param {object} [options]
 * @param {Storage} [options.storage=globalThis.localStorage] - Optional; without it the id is not persisted.
 * @param {{randomUUID?: () => string}} [options.crypto=globalThis.crypto]
 * @returns {Promise<string>}
 */
export async function getOrCreateDeviceFingerprint({
  storage = globalThis.localStorage,
  crypto = globalThis.crypto,
} = {}) {
  const existing = storage?.getItem?.(LOCAL_STORAGE_KEY);
  if (typeof existing === 'string' && existing.length >= 16) {
    return existing;
  }
  const generated = crypto?.randomUUID?.() ?? createFallbackFingerprint();
  storage?.setItem?.(LOCAL_STORAGE_KEY, generated);
  return generated;
}
