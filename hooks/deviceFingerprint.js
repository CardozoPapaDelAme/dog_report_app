/**
 * @module hooks/deviceFingerprint
 * Native installation fingerprint: a random UUID persisted in a dedicated SQLite database
 * (`report-device-identity.db`). The web variant lives in `hooks/deviceFingerprint.web.js`.
 */
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

const FINGERPRINT_DB = 'report-device-identity.db';
const FINGERPRINT_TABLE = 'device_identity';
const FINGERPRINT_KEY = 'installation_fingerprint';

/** Lazily opened database shared by every call in this process. */
let identityDbPromise = null;

/** Opens the identity database once and ensures the key/value table exists. */
async function openIdentityDatabase(sqlite = SQLite) {
  if (!identityDbPromise) {
    identityDbPromise = sqlite.openDatabaseAsync(FINGERPRINT_DB);
  }
  const db = await identityDbPromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ${FINGERPRINT_TABLE} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

/**
 * Returns the stored installation fingerprint, creating and storing a new UUID when missing or
 * shorter than 16 characters.
 * @param {object} [options]
 * @param {typeof SQLite} [options.sqlite=SQLite] - `expo-sqlite` module (injectable for tests).
 * @param {{randomUUID: () => string}} [options.crypto=Crypto] - `expo-crypto` module.
 * @returns {Promise<string>}
 */
export async function getOrCreateDeviceFingerprint({
  sqlite = SQLite,
  crypto = Crypto,
} = {}) {
  const db = await openIdentityDatabase(sqlite);
  const existing = await db.getFirstAsync(
    `SELECT value FROM ${FINGERPRINT_TABLE} WHERE key = ?`,
    FINGERPRINT_KEY,
  );
  if (typeof existing?.value === 'string' && existing.value.length >= 16) {
    return existing.value;
  }
  const generated = crypto.randomUUID();
  await db.runAsync(
    `INSERT OR REPLACE INTO ${FINGERPRINT_TABLE} (key, value) VALUES (?, ?)`,
    FINGERPRINT_KEY,
    generated,
  );
  return generated;
}
