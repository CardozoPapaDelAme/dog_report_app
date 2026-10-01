import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

const FINGERPRINT_DB = 'report-device-identity.db';
const FINGERPRINT_TABLE = 'device_identity';
const FINGERPRINT_KEY = 'installation_fingerprint';

let identityDbPromise = null;

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
