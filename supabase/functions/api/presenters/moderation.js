/**
 * @module presenters/moderation
 * Shapes the administrator moderation queue and moderation command results, including the commands
 * allowed from each report status.
 */
import { allowedCommands } from '../domain/reportModeration.js';

/** Normalizes an array or a JSON-encoded array string to an array; anything else becomes `[]`. */
function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Encodes the keyset cursor `<synced_at ISO>|<id>` as unpadded base64url. */
function encodeCursor(row) {
  const raw = `${new Date(row.synced_at).toISOString()}|${row.id}`;
  return btoa(raw).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/**
 * Responds 200 with one page of the moderation queue. The caller fetches `limit + 1` rows; the extra
 * row only signals that `next_cursor` must be emitted.
 * @param {import('hono').Context} c - Hono request context.
 * @param {object[]} rows - Queue rows from `listModerationQueue`.
 * @param {number} limit - Page size.
 * @returns {Response} `{ data: { items, next_cursor } }` with the `X-Request-Id` header.
 */
export function presentModerationQueue(c, rows, limit) {
  const requestId = c.get('requestId') ?? '';
  c.header('X-Request-Id', requestId);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map((row) => ({
    id: row.id,
    location: {
      longitude: Number(row.longitude),
      latitude: Number(row.latitude),
      accuracy_meters: Number(row.gps_accuracy_meters),
      mock_suspected: row.mock_location_suspected,
    },
    incident_type: row.incident_type,
    sighting_type: row.sighting_type,
    details: row.details,
    dog: {
      predominant_color: row.color_predominante,
      size: row.tamano,
      has_collar: row.tiene_collar,
    },
    honeypot_suspected: row.honeypot_suspected,
    status: row.status,
    status_reason: row.status_reason,
    previous_status: row.previous_status,
    trust: {
      tier: row.trust_tier,
      score: row.trust_score === null ? null : Number(row.trust_score),
      photo_validation_score:
        row.photo_validation_score === null ? null : Number(row.photo_validation_score),
      exif_consistency_score:
        row.exif_consistency_score === null ? null : Number(row.exif_consistency_score),
      gps_trust_score: row.gps_trust_score === null ? null : Number(row.gps_trust_score),
      fingerprint_trust_score:
        row.fingerprint_trust_score === null ? null : Number(row.fingerprint_trust_score),
    },
    photo_expected: row.photo_expected,
    photo_available: row.photo_state === 'approved',
    photo_state: row.photo_state,
    flags: asArray(row.flags),
    pending_duplicate_candidates: asArray(row.pending_duplicate_candidates),
    active_group_id: row.active_group_id,
    active_member_role: row.active_member_role,
    allowed_commands: allowedCommands(row.status),
    client_created_at: row.client_created_at,
    synced_at: row.synced_at,
    accepted_at: row.accepted_at,
    published_at: row.published_at,
    public_until: row.public_until,
    hidden_at: row.hidden_at,
    deleted_at: row.deleted_at,
    flag_reviewed_at: row.flag_reviewed_at,
  }));

  return c.json(
    {
      data: {
        items,
        next_cursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
      },
    },
    200,
  );
}

/**
 * Responds 200 with the report state after a moderation command.
 * @param {import('hono').Context} c - Hono request context.
 * @param {import('../repositories/moderationRepository.js').ModerationReportState} report - Updated report state.
 * @returns {Response} `{ data: { report_id, status, ..., allowed_commands } }` with the `X-Request-Id` header.
 */
export function presentModerationCommand(c, report) {
  const requestId = c.get('requestId') ?? '';
  c.header('X-Request-Id', requestId);
  return c.json(
    {
      data: {
        report_id: report.id,
        status: report.status,
        status_reason: report.status_reason,
        previous_status: report.previous_status,
        accepted_at: report.accepted_at,
        published_at: report.published_at,
        public_until: report.public_until,
        hidden_at: report.hidden_at,
        deleted_at: report.deleted_at,
        allowed_commands: allowedCommands(report.status),
      },
    },
    200,
  );
}
