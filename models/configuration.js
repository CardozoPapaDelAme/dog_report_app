/**
 * @module models/configuration
 * Client-side model for the administrator configuration form (FAB-1): field bounds, draft conversion,
 * validation, dirty checking and response validation.
 */
// Mobile form contract: docs/API.md and docs/DATA-MODEL.md (FAB-1).
// Kept independent of the server runtime; parity is checked in tests.
/**
 * Editable numeric fields with their group, inclusive bounds and allowed decimals.
 * @type {ReadonlyArray<{key: string, group: string, min: number, max: number, decimals: number}>}
 */
export const CONFIGURATION_FIELDS = Object.freeze([
  { key: 'flag_auto_hide_threshold', group: 'flags', min: 2, max: 100, decimals: 0 },
  { key: 'duplicate_radius_meters', group: 'duplicates', min: 10, max: 1000, decimals: 0 },
  { key: 'duplicate_time_window_minutes', group: 'duplicates', min: 5, max: 1440, decimals: 0 },
  { key: 'trust_high_threshold', group: 'trust', min: 0, max: 1, decimals: 3 },
  { key: 'trust_medium_threshold', group: 'trust', min: 0, max: 1, decimals: 3 },
  { key: 'gps_accuracy_max_meters', group: 'location', min: 5, max: 500, decimals: 2 },
  { key: 'report_rate_limit_per_hour', group: 'limits', min: 1, max: 500, decimals: 0 },
  { key: 'flag_rate_limit_per_hour', group: 'limits', min: 1, max: 1000, decimals: 0 },
]);
export const CONFIGURATION_GROUPS = ['flags', 'duplicates', 'trust', 'location', 'limits'];
const FIELD_KEYS = new Set([...CONFIGURATION_FIELDS.map(({ key }) => key), 'change_note']);
const DECIMAL = /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

/**
 * @typedef {object} ConfigurationState
 * @property {object} configuration - Active configuration row: `id`, `version`, `environment`
 *   (`staging` or `production`), `is_active: true` and one number per {@link CONFIGURATION_FIELDS} key.
 * @property {object | null} zone_set - Active zone set summary, or `null`.
 */
/**
 * Converts a configuration into string form values with an empty `change_note`.
 * @param {object} configuration
 * @returns {Record<string, string>}
 */
export function configurationToDraft(configuration) {
  return Object.fromEntries([
    ...CONFIGURATION_FIELDS.map(({ key }) => [key, String(configuration[key])]),
    // Never reuse the previous publication reason for a new change.
    ['change_note', ''],
  ]);
}

/**
 * Validates form values: range, decimals, `trust_medium_threshold < trust_high_threshold`, and a
 * non-empty `change_note` of at most 1000 characters. Decimal commas are accepted.
 * @param {Record<string, string>} draft
 * @returns {{payload: object | null, errors: Record<string, {key: string, values?: object}>}}
 *   `payload` holds numeric values plus `change_note`, or `null` when there are errors.
 */
export function validateConfigurationDraft(draft) {
  const errors = {};
  const payload = {};
  for (const { key, min, max, decimals } of CONFIGURATION_FIELDS) {
    const text = typeof draft[key] === 'string' ? draft[key].trim() : '';
    const value = DECIMAL.test(text) ? Number(text.replace(',', '.')) : NaN;
    if (!Number.isFinite(value)) errors[key] = { key: 'number' };
    else if (value < min || value > max) errors[key] = { key: 'range', values: { min, max } };
    else if (Number(value.toFixed(decimals)) !== value) {
      errors[key] = { key: decimals === 0 ? 'integer' : 'precision', values: { decimals } };
    }
    payload[key] = value;
  }
  if (!errors.trust_high_threshold && !errors.trust_medium_threshold &&
      payload.trust_medium_threshold >= payload.trust_high_threshold) {
    errors.trust_medium_threshold = { key: 'trustOrder' };
  }
  if (typeof draft.change_note !== 'string' || !draft.change_note.trim() || [...draft.change_note].length > 1000) {
    errors.change_note = { key: 'note' };
  }
  payload.change_note = draft.change_note;
  return { payload: Object.keys(errors).length ? null : payload, errors };
}

/**
 * @param {Record<string, string>} draft
 * @param {object | null} configuration
 * @returns {boolean} Whether any field differs from the configuration (always `false` without one).
 */
export function configurationIsDirty(draft, configuration) {
  if (!configuration) return false;
  const original = configurationToDraft(configuration);
  return [...FIELD_KEYS].some((key) => draft[key] !== original[key]);
}

/**
 * Extracts per-field server messages from an API error's `details.fields`.
 * @param {unknown} error
 * @returns {Record<string, string>} Only known field keys with non-empty messages.
 */
export function configurationFieldErrors(error) {
  const fields = error?.details?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
  return Object.fromEntries(Object.entries(fields).filter(([key, value]) =>
    FIELD_KEYS.has(key) && typeof value === 'string' && value.trim()
  ));
}

/**
 * Validates the `data` of a configuration response.
 * @param {unknown} data
 * @returns {ConfigurationState}
 * @throws {Error} `invalid_response` when the configuration is missing, inactive or out of bounds.
 */
export function readConfigurationState(data) {
  const config = data?.configuration;
  const invalid = () => {
    const error = new Error('Invalid configuration response');
    error.code = 'invalid_response';
    throw error;
  };
  if (!config || typeof config.id !== 'string' || !Number.isInteger(config.version) || config.version < 1 ||
      config.is_active !== true || !['staging', 'production'].includes(config.environment) ||
      !CONFIGURATION_FIELDS.every(({ key }) => typeof config[key] === 'number' && Number.isFinite(config[key]))) invalid();
  const { errors } = validateConfigurationDraft({ ...configurationToDraft(config), change_note: 'Response validation' });
  if (Object.keys(errors).length) invalid();
  return { configuration: config, zone_set: data.zone_set ?? null };
}
