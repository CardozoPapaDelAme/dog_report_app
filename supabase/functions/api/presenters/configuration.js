/**
 * @module presenters/configuration
 * Shapes the active configuration version and active zone set into the API JSON envelope.
 */
import { CONFIGURATION_RULES } from '../domain/configuration.js';

/** Converts a date-like value to an ISO 8601 UTC string, keeping null and undefined as null. */
function utc(value) {
  return value == null ? null : new Date(value).toISOString();
}

/**
 * Responds with the active configuration and zone set. Numeric rule fields are coerced to numbers.
 * @param {import('hono').Context} c - Hono request context.
 * @param {{configuration: object, zone_set: object | null}} state - Result of the configuration Service.
 * @param {number} [status=200] - HTTP status (201 after a publish).
 * @returns {Response} `{ data: { configuration, zone_set } }` with the `X-Request-Id` header.
 */
export function presentConfiguration(c, state, status = 200) {
  const row = state.configuration;
  const configuration = {
    id: row.id, environment: row.environment, version: row.version, is_active: row.is_active,
  };
  for (const field of Object.keys(CONFIGURATION_RULES)) configuration[field] = Number(row[field]);
  for (const field of ['fingerprint_retention_days', 'public_retention_days',
    'business_retention_days', 'audit_retention_days', 'deleted_retention_days']) {
    configuration[field] = row[field];
  }
  configuration.change_note = row.change_note;
  configuration.created_by = row.created_by;
  configuration.created_at = utc(row.created_at);

  const zone = state.zone_set;
  const zoneSet = zone ? {
    id: zone.id, environment: zone.environment, version: zone.version, name: zone.name,
    source_uri: zone.source_uri, source_version: zone.source_version, source_sha256: zone.source_sha256,
    status: zone.status, association_approval_reference: zone.association_approval_reference,
    approved_at: utc(zone.approved_at), activated_at: utc(zone.activated_at), retired_at: utc(zone.retired_at),
  } : null;
  c.header('X-Request-Id', c.get('requestId') ?? '');
  return c.json({ data: { configuration, zone_set: zoneSet } }, status);
}
