/**
 * @module domain/configuration
 * Domain rules for the administrator-managed operational configuration (thresholds, radii, rate limits).
 * Pure validation with no I/O; persistence lives in `repositories/configurationRepository.js`.
 */
// Exact storage limits: db/schema.sql, public.config_versions.
/**
 * Allowed range and decimal precision for each configurable value.
 * @type {Readonly<Record<string, {min: number, max: number, decimals: number}>>}
 */
export const CONFIGURATION_RULES = Object.freeze({
  flag_auto_hide_threshold: { min: 2, max: 100, decimals: 0 },
  duplicate_radius_meters: { min: 10, max: 1000, decimals: 0 },
  duplicate_time_window_minutes: { min: 5, max: 1440, decimals: 0 },
  trust_high_threshold: { min: 0, max: 1, decimals: 3 },
  trust_medium_threshold: { min: 0, max: 1, decimals: 3 },
  gps_accuracy_max_meters: { min: 5, max: 500, decimals: 2 },
  report_rate_limit_per_hour: { min: 1, max: 500, decimals: 0 },
  flag_rate_limit_per_hour: { min: 1, max: 1000, decimals: 0 },
  photo_dog_probability_min: { min: 0, max: 1, decimals: 3 },
});

/**
 * Validation error raised by configuration rules.
 * @property {string} code - Machine-readable error code (currently `invalid_request`).
 * @property {{fields: Record<string, string>} | undefined} details - Per-field messages, when available.
 */
export class ConfigurationError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * @typedef {object} ConfigurationValues
 * @property {number} flag_auto_hide_threshold
 * @property {number} duplicate_radius_meters
 * @property {number} duplicate_time_window_minutes
 * @property {number} trust_high_threshold
 * @property {number} trust_medium_threshold
 * @property {number} gps_accuracy_max_meters
 * @property {number} report_rate_limit_per_hour
 * @property {number} flag_rate_limit_per_hour
 * @property {number} photo_dog_probability_min - Minimum on-device AI dog probability, 0 to 1.
 * @property {string} change_note - Non-blank note of 1 to 1000 characters.
 */
/**
 * Validates a complete configuration submission. Every rule field and `change_note` are required,
 * unknown fields are rejected, and `trust_medium_threshold` must be below `trust_high_threshold`.
 * @param {unknown} input - Parsed request body.
 * @returns {ConfigurationValues} Only the allowed fields, copied from the input.
 * @throws {ConfigurationError} `invalid_request`, with `details.fields` when individual fields fail.
 */
export function validateConfiguration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ConfigurationError('invalid_request', 'Body must be a JSON object.');
  }

  const fields = Object.create(null);
  const allowed = new Set([...Object.keys(CONFIGURATION_RULES), 'change_note']);
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) fields[field] = 'Unknown field.';
  }
  for (const [field, { min, max, decimals }] of Object.entries(CONFIGURATION_RULES)) {
    const value = input[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      fields[field] = `Must be a number between ${min} and ${max}.`;
    } else if (Number(value.toFixed(decimals)) !== value) {
      fields[field] = decimals === 0
        ? 'Must be an integer.'
        : `Must have at most ${decimals} decimal places.`;
    }
  }
  if (!fields.trust_medium_threshold && !fields.trust_high_threshold &&
      input.trust_medium_threshold >= input.trust_high_threshold) {
    fields.trust_medium_threshold = 'Must be less than trust_high_threshold.';
  }
  if (typeof input.change_note !== 'string' || input.change_note.trim().length === 0 ||
      [...input.change_note].length > 1000) {
    fields.change_note = 'Must contain between 1 and 1000 characters and not be blank.';
  }
  if (Object.keys(fields).length) {
    throw new ConfigurationError('invalid_request', 'Configuration values are invalid.', { fields });
  }
  return Object.fromEntries([...allowed].map((field) => [field, input[field]]));
}
