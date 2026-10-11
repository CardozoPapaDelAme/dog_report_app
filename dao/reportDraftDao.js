/**
 * @module dao/reportDraftDao
 * Local SQLite persistence for the offline report draft queue (`expo-sqlite`). JSON fields are stored
 * as text columns; the database is opened once per app process.
 */
import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'report-draft-queue.db';
const TABLE_NAME = 'report_drafts';
const DATABASE_VERSION = 1;
const STATE_CHECK = "'draft','queued','submitting','uploading','awaiting_processing','retry_wait','synced','terminal_error'";

let databasePromise = null;

function stringify(value) {
  return value == null ? null : JSON.stringify(value);
}

function parse(value) {
  return value == null ? null : JSON.parse(value);
}

/** Maps a table row to a draft, parsing the JSON columns; `null` for no row. */
function rowToDraft(row) {
  if (!row) return null;
  return {
    id: row.id,
    local_state: row.local_state,
    created_at: row.created_at,
    updated_at: row.updated_at,
    queued_at: row.queued_at,
    payload_json: row.payload_json,
    photo_file_uri: row.photo_file_uri,
    photo_validation: parse(row.photo_validation_json),
    location_snapshot: parse(row.location_json),
    client_created_at: row.client_created_at,
    retry_count: row.retry_count,
    next_retry_at: row.next_retry_at,
    last_error: parse(row.last_error_json),
    receipt: parse(row.receipt_json),
    photo_status: parse(row.photo_status_json),
  };
}

/** Returns the insert parameters in column order, serializing JSON fields. */
function draftValues(draft) {
  return [
    draft.id,
    draft.local_state,
    draft.created_at,
    draft.updated_at,
    draft.queued_at,
    draft.payload_json,
    draft.photo_file_uri,
    stringify(draft.photo_validation),
    stringify(draft.location_snapshot),
    draft.client_created_at,
    draft.retry_count,
    draft.next_retry_at,
    stringify(draft.last_error),
    stringify(draft.receipt),
    stringify(draft.photo_status),
  ];
}

/** Opens the shared database (WAL) and creates the table when missing. */
async function openDatabase(sqlite = SQLite) {
  if (!databasePromise) {
    databasePromise = sqlite.openDatabaseAsync(DATABASE_NAME);
  }
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id TEXT PRIMARY KEY,
      local_state TEXT NOT NULL CHECK (local_state IN (${STATE_CHECK})),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      queued_at TEXT,
      payload_json TEXT,
      photo_file_uri TEXT,
      photo_validation_json TEXT,
      location_json TEXT NOT NULL,
      client_created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      last_error_json TEXT,
      receipt_json TEXT,
      photo_status_json TEXT
    );
    PRAGMA user_version = ${DATABASE_VERSION};
  `);
  return db;
}

/**
 * @param {typeof import('expo-sqlite')} [sqlite] - Injectable SQLite module.
 * @returns {Promise<{
 *   insert: (draft: import('../models/reportDraft.js').ReportDraft) => Promise<void>,
 *   update: (draft: import('../models/reportDraft.js').ReportDraft) => Promise<void>,
 *   getById: (id: string) => Promise<import('../models/reportDraft.js').ReportDraft | null>,
 *   list: (filter?: {states?: string[]}) => Promise<import('../models/reportDraft.js').ReportDraft[]>
 * }>} `insert` and `update` are the same upsert; `list` orders by `updated_at` descending.
 */
export async function createReportDraftDao(sqlite = SQLite) {
  const db = await openDatabase(sqlite);
  const columns = `
    id, local_state, created_at, updated_at, queued_at, payload_json,
    photo_file_uri, photo_validation_json, location_json, client_created_at,
    retry_count, next_retry_at, last_error_json, receipt_json, photo_status_json
  `;
  const placeholders = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
  const updateSet = `
    local_state = excluded.local_state,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    queued_at = excluded.queued_at,
    payload_json = excluded.payload_json,
    photo_file_uri = excluded.photo_file_uri,
    photo_validation_json = excluded.photo_validation_json,
    location_json = excluded.location_json,
    client_created_at = excluded.client_created_at,
    retry_count = excluded.retry_count,
    next_retry_at = excluded.next_retry_at,
    last_error_json = excluded.last_error_json,
    receipt_json = excluded.receipt_json,
    photo_status_json = excluded.photo_status_json
  `;

  async function upsert(draft) {
    await db.runAsync(
      `INSERT INTO ${TABLE_NAME} (${columns}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${updateSet}`,
      ...draftValues(draft),
    );
  }

  return {
    insert: upsert,
    update: upsert,
    async getById(id) {
      return rowToDraft(
        await db.getFirstAsync(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, id),
      );
    },
    async list({ states } = {}) {
      if (Array.isArray(states) && states.length) {
        const statePlaceholders = states.map(() => '?').join(', ');
        const rows = await db.getAllAsync(
          `SELECT * FROM ${TABLE_NAME}
           WHERE local_state IN (${statePlaceholders})
           ORDER BY updated_at DESC`,
          ...states,
        );
        return rows.map(rowToDraft);
      }
      const rows = await db.getAllAsync(
        `SELECT * FROM ${TABLE_NAME} ORDER BY updated_at DESC`,
      );
      return rows.map(rowToDraft);
    },
  };
}
