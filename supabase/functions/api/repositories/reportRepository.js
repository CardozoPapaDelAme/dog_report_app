/**
 * @module repositories/reportRepository
 * SQL access for anonymous report submission: idempotency locking, active configuration, geofence checks,
 * per-origin rate limiting, and report insertion. Every function runs on a caller-provided transaction.
 */
/**
 * Takes a transaction-scoped advisory lock derived from the first 64 bits of the report UUID, so
 * concurrent submissions of the same id are serialized.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} reportId - Client-generated report UUID.
 * @returns {Promise<void>}
 */
export async function lockReportIdentity(tx, reportId) {
  const compact = reportId.replaceAll("-", "");
  const keyA = signedInt32(compact.slice(0, 8));
  const keyB = signedInt32(compact.slice(8, 16));
  await tx`SELECT pg_catalog.pg_advisory_xact_lock(${keyA}, ${keyB})`;
}

/** Converts eight hex digits to a signed 32-bit integer, as `pg_advisory_xact_lock` expects. */
function signedInt32(hex) {
  const value = Number.parseInt(hex, 16);
  return value > 0x7fffffff ? value - 0x100000000 : value;
}

/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} reportId - Report id.
 * @returns {Promise<{id: string, submission_hash: string, status: string, photo_expected: boolean} | null>}
 */
export async function findReportById(tx, reportId) {
  const rows = await tx`
    SELECT
      id,
      submission_hash,
      status,
      photo_expected
    FROM public.reports
    WHERE id = ${reportId}
  `;
  return rows[0] ?? null;
}

/**
 * @typedef {object} ActiveReportConfig
 * @property {string} id - Configuration version id.
 * @property {number} trust_high_threshold
 * @property {number} trust_medium_threshold
 * @property {number} gps_accuracy_max_meters
 * @property {number} report_rate_limit_per_hour
 * @property {number} fingerprint_retention_days
 * @property {number} public_retention_days
 * @property {Date} server_now
 */
/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @returns {Promise<ActiveReportConfig | null>} Active configuration for the deployment environment, or null.
 */
export async function getActiveReportConfig(tx) {
  const rows = await tx`
    SELECT
      c.id,
      c.trust_high_threshold,
      c.trust_medium_threshold,
      c.gps_accuracy_max_meters,
      c.report_rate_limit_per_hour,
      c.fingerprint_retention_days,
      c.public_retention_days,
      now() AS server_now
    FROM public.config_versions c
    JOIN public.deployment_metadata d
      ON d.singleton = TRUE
     AND d.environment = c.environment
    WHERE c.is_active = TRUE
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Checks a point against the zones of the environment's active zone set.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {number} options.longitude
 * @param {number} options.latitude
 * @returns {Promise<{configured: boolean, contains: boolean}>} `configured` is false when no active zone exists.
 */
export async function checkActiveCreelGeofence(tx, { longitude, latitude }) {
  const rows = await tx`
    WITH active_zone_sets AS (
      SELECT zs.id
      FROM public.zone_sets zs
      JOIN public.deployment_metadata d
        ON d.singleton = TRUE
       AND d.environment = zs.environment
      WHERE zs.status = 'active'
    ),
    active_zones AS (
      SELECT z.boundary
      FROM public.zones z
      JOIN active_zone_sets azs ON azs.id = z.zone_set_id
    ),
    submitted_point AS (
      SELECT extensions.ST_SetSRID(
        extensions.ST_MakePoint(${longitude}, ${latitude}),
        4326
      ) AS geom
    )
    SELECT
      EXISTS (SELECT 1 FROM active_zones) AS configured,
      EXISTS (
        SELECT 1
        FROM active_zones az
        CROSS JOIN submitted_point p
        WHERE extensions.ST_Covers(az.boundary::extensions.geometry, p.geom)
      ) AS contains
  `;
  return {
    configured: rows[0]?.configured === true,
    contains: rows[0]?.contains === true,
  };
}

/**
 * Consumes one unit of the origin's hourly report budget via `app_private.consume_rate_limit`.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {string} options.originHash - Hashed origin fingerprint.
 * @param {number} options.limit - Allowed reports per hour.
 * @returns {Promise<boolean>} True when the report is allowed.
 */
export async function consumeReportRateLimit(tx, { originHash, limit }) {
  const rows = await tx`
    SELECT app_private.consume_rate_limit('report', ${originHash}, ${limit}) AS allowed
  `;
  return rows[0]?.allowed === true;
}

/**
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {string} originHash - Hashed origin fingerprint.
 * @returns {Promise<{request_count: number} | null>} The origin's report bucket for the current hour, or null.
 */
export async function getCurrentReportRateBucket(tx, originHash) {
  const rows = await tx`
    SELECT request_count
    FROM public.rate_limit_buckets
    WHERE operation = 'report'
      AND origin_hash = ${originHash}
      AND window_start = date_trunc('hour', now())
  `;
  return rows[0] ?? null;
}

/**
 * Inserts a report. Visible reports get `accepted_at`, `published_at`, and a `public_until` based on
 * `public_retention_days`; others leave them null.
 * @param {import('postgres').TransactionSql} tx - Active transaction.
 * @param {object} options
 * @param {object} options.command - Validated submission (id, location, incident and sighting types,
 *   details, dog, photo, antiAbuse, clientCreatedAt).
 * @param {string} options.submissionHash - Hash of the submission used for idempotency.
 * @param {string} options.originHash - Hashed origin fingerprint.
 * @param {ActiveReportConfig} options.config - Active configuration.
 * @param {{status: string, statusReason: string, trustTier: string, trustScore: number, gpsTrustScore: number, fingerprintTrustScore: number}} options.trust
 *   Trust evaluation result.
 * @returns {Promise<{id: string, status: string, photo_expected: boolean}>}
 */
export async function insertReport(
  tx,
  { command, submissionHash, originHash, config, trust },
) {
  const details = tx.json(command.details ?? {});
  const rows = await tx`
    INSERT INTO public.reports (
      id,
      submission_hash,
      location,
      gps_accuracy_meters,
      mock_location_suspected,
      incident_type,
      sighting_type,
      details,
      color_predominante,
      tamano,
      tiene_collar,
      photo_expected,
      client_photo_check_passed,
      honeypot_suspected,
      status,
      status_reason,
      trust_tier,
      trust_score,
      trust_config_id,
      gps_trust_score,
      fingerprint_trust_score,
      device_fingerprint_hash,
      fingerprint_expires_at,
      client_created_at,
      accepted_at,
      published_at,
      public_until
    )
    VALUES (
      ${command.id},
      ${submissionHash},
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(${command.location.longitude}, ${command.location.latitude}),
        4326
      )::extensions.geography,
      ${command.location.accuracyMeters},
      ${command.location.mockSuspected},
      ${command.incidentType}::public.incident_type,
      ${command.sightingType}::public.sighting_type,
      ${details},
      ${command.dog.predominantColor},
      ${command.dog.size}::public.dog_size,
      ${command.dog.hasCollar},
      ${command.photo.expected},
      ${command.photo.clientCheckPassed},
      ${command.antiAbuse.honeypotFilled},
      ${trust.status}::public.report_status,
      ${trust.statusReason}::public.report_status_reason,
      ${trust.trustTier}::public.trust_tier,
      ${trust.trustScore},
      ${config.id},
      ${trust.gpsTrustScore},
      ${trust.fingerprintTrustScore},
      ${originHash},
      now() + (${config.fingerprint_retention_days} * interval '1 day'),
      ${command.clientCreatedAt},
      CASE WHEN ${trust.status} = 'visible' THEN now() ELSE NULL END,
      CASE WHEN ${trust.status} = 'visible' THEN now() ELSE NULL END,
      CASE
        WHEN ${trust.status} = 'visible'
        THEN now() + (${config.public_retention_days} * interval '1 day')
        ELSE NULL
      END
    )
    RETURNING id, status, photo_expected
  `;
  return rows[0];
}
