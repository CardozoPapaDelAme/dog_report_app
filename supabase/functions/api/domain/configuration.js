// Exact storage limits: db/schema.sql, public.config_versions.
export const CONFIGURATION_RULES = Object.freeze({
  flag_auto_hide_threshold: { min: 2, max: 100, decimals: 0 },
  duplicate_radius_meters: { min: 10, max: 1000, decimals: 0 },
  duplicate_time_window_minutes: { min: 5, max: 1440, decimals: 0 },
  trust_high_threshold: { min: 0, max: 1, decimals: 3 },
  trust_medium_threshold: { min: 0, max: 1, decimals: 3 },
  gps_accuracy_max_meters: { min: 5, max: 500, decimals: 2 },
  report_rate_limit_per_hour: { min: 1, max: 500, decimals: 0 },
  flag_rate_limit_per_hour: { min: 1, max: 1000, decimals: 0 },
});

export class ConfigurationError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = code;
    this.details = details;
  }
}

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
