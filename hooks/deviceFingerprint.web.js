const LOCAL_STORAGE_KEY = 'dog_report_installation_fingerprint';

function createFallbackFingerprint() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `installation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
