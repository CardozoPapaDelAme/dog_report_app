/**
 * @module models/reportPayload
 * Report form model and `POST /reports` payload builder: catalogues, empty form, form validation and the
 * details contract per incident type.
 */
import { isDogColor } from './dogColor.js';

export const INCIDENT_TYPES = Object.freeze([
  'avistamiento_simple',
  'ataque_mascota',
  'ataque_ganado',
  'ataque_humano',
  'perro_lastimado',
  'otro',
]);

export const SIGHTING_TYPES = Object.freeze(['solitario', 'manada']);
export const DOG_SIZES = Object.freeze(['chico', 'mediano', 'grande']);
export const COLLAR_VALUES = Object.freeze(['si', 'no', 'no_se']);
export const INJURED_DOG_SITUATIONS = Object.freeze([
  'herido',
  'atropellado',
  'atrapado',
  'mal_estado',
]);

/** Allowed `details` keys per incident type. */
export const REPORT_DETAILS_CONTRACT = Object.freeze({
  avistamiento_simple: Object.freeze(['cantidad_aprox', 'descripcion']),
  ataque_humano: Object.freeze(['hubo_mordida', 'descripcion']),
  ataque_mascota: Object.freeze(['tipo_animal', 'resulto_herido', 'descripcion']),
  ataque_ganado: Object.freeze(['tipo_animal', 'cantidad_afectada', 'descripcion']),
  perro_lastimado: Object.freeze(['situacion', 'descripcion']),
  otro: Object.freeze(['descripcion']),
});

const EDITABLE_REPORT_FIELDS = Object.freeze([
  'incident_type',
  'sighting_type',
  'details',
  'dog',
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIELD_MAX = Object.freeze({
  descripcion: 2000,
  tipo_animal: 120,
  predominant_color: 80,
});

/** Throws `<name>_must_be_object` unless `value` is a non-array object. */
function requirePlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name}_must_be_object`);
  }
  return value;
}

/** Throws `<name>_must_be_number` unless `value` is a finite number. */
function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name}_must_be_number`);
  }
  return value;
}

/** Throws `invalid_report_draft_id` unless `id` is a lowercase UUID. */
function assertDraftId(id) {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw new Error('invalid_report_draft_id');
  }
  return id;
}

/** Validates the stored location snapshot; throws `invalid_location_snapshot` when out of range. */
function normalizeLocationSnapshot(snapshot) {
  const value = requirePlainObject(snapshot, 'location_snapshot');
  const longitude = finiteNumber(value.longitude, 'longitude');
  const latitude = finiteNumber(value.latitude, 'latitude');
  const accuracyMeters = finiteNumber(
    value.accuracy_meters ?? value.accuracyMeters,
    'accuracy_meters',
  );
  const mockSuspected = Boolean(value.mock_suspected ?? value.mockSuspected);

  if (
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90 ||
    accuracyMeters <= 0 ||
    accuracyMeters > 99999.99
  ) {
    throw new Error('invalid_location_snapshot');
  }

  return {
    longitude,
    latitude,
    accuracy_meters: accuracyMeters,
    mock_suspected: mockSuspected,
    captured_at: value.captured_at ?? value.timestamp,
  };
}

function locationForReportPayload(locationSnapshot) {
  const snapshot = normalizeLocationSnapshot(locationSnapshot);
  return {
    longitude: snapshot.longitude,
    latitude: snapshot.latitude,
    accuracy_meters: snapshot.accuracy_meters,
    mock_suspected: snapshot.mock_suspected,
  };
}

/** Snapshot capture time as ISO 8601, or the current time when missing. */
function clientCreatedAtForReportPayload(locationSnapshot) {
  const snapshot = normalizeLocationSnapshot(locationSnapshot);
  if (typeof snapshot.captured_at === 'string' && snapshot.captured_at) {
    return new Date(snapshot.captured_at).toISOString();
  }
  return new Date().toISOString();
}

function textOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

function codePointLength(value) {
  return [...String(value ?? '')].length;
}

/** Parses a digits-only string within `[min, max]`; `null` otherwise. */
function integerFromText(value, { min = 1, max = 1000 } = {}) {
  const text = textOrEmpty(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

/** Maps `true`/`si`/`yes`/`true` and `false`/`no`/`false` to booleans; `null` otherwise. */
function booleanFromChoice(value) {
  if (value === true || value === 'si' || value === 'yes' || value === 'true') return true;
  if (value === false || value === 'no' || value === 'false') return false;
  return null;
}

/** Adds the trimmed `descripcion` or records a length error. */
function addDescription(details, form, errors) {
  const description = textOrEmpty(form?.descripcion).trim();
  if (codePointLength(description) > FIELD_MAX.descripcion) {
    errors.descripcion = { key: 'descriptionLength', values: { max: FIELD_MAX.descripcion } };
    return;
  }
  if (description) {
    details.descripcion = description;
  }
}

/** Adds a required trimmed text field or records a required/length error. */
function addRequiredText(details, form, key, errors) {
  const text = textOrEmpty(form?.[key]).trim();
  if (!text) {
    errors[key] = { key: 'required' };
    return;
  }
  if (codePointLength(text) > FIELD_MAX.tipo_animal) {
    errors[key] = { key: 'textLength', values: { max: FIELD_MAX.tipo_animal } };
    return;
  }
  details[key] = text;
}

function addOptionalBoolean(details, form, key) {
  const value = booleanFromChoice(form?.[key]);
  if (value !== null) details[key] = value;
}

/**
 * @returns {object} Initial report form values (simple sighting, single dog, collar unknown).
 */
export function createEmptyReportFormDraft() {
  return {
    incident_type: 'avistamiento_simple',
    sighting_type: 'solitario',
    descripcion: '',
    cantidad_aprox: '',
    hubo_mordida: null,
    tipo_animal: '',
    resulto_herido: null,
    cantidad_afectada: '',
    situacion: '',
    dog_size: '',
    dog_color: '',
    has_collar: 'no_se',
    honeypot_website: '',
    honeypot_contact: '',
  };
}

/**
 * @param {object} form
 * @returns {boolean} Whether either hidden honeypot field has a value.
 */
export function honeypotFilledFromForm(form) {
  return Boolean(
    textOrEmpty(form?.honeypot_website) ||
      textOrEmpty(form?.honeypot_contact),
  );
}

/**
 * @typedef {object} ReportFields
 * @property {string} incident_type
 * @property {string} sighting_type
 * @property {object} details - Keys allowed by {@link REPORT_DETAILS_CONTRACT}.
 * @property {{predominant_color: string | null, size: string | null, has_collar: boolean | null}} dog
 */
/**
 * Validates form values and builds the editable report fields.
 * @param {object} form
 * @returns {{reportFields: ReportFields | null, errors: Record<string, {key: string, values?: object}>}}
 * @throws {Error} `report_form_must_be_object`.
 */
export function validateReportFormDraft(form) {
  const value = requirePlainObject(form, 'report_form');
  const errors = {};
  const incidentType = INCIDENT_TYPES.includes(value.incident_type)
    ? value.incident_type
    : null;
  const sightingType = SIGHTING_TYPES.includes(value.sighting_type)
    ? value.sighting_type
    : null;
  const details = {};

  if (!incidentType) errors.incident_type = { key: 'required' };
  if (!sightingType) errors.sighting_type = { key: 'required' };
  addDescription(details, value, errors);

  if (incidentType === 'avistamiento_simple' && sightingType === 'manada') {
    const count = integerFromText(value.cantidad_aprox, { min: 2, max: 1000 });
    if (count === null) {
      errors.cantidad_aprox = { key: 'integerRange', values: { min: 2, max: 1000 } };
    } else {
      details.cantidad_aprox = count;
    }
  }

  if (incidentType === 'ataque_humano') {
    const bite = booleanFromChoice(value.hubo_mordida);
    if (bite === null) errors.hubo_mordida = { key: 'requiredChoice' };
    else details.hubo_mordida = bite;
  }

  if (incidentType === 'ataque_mascota') {
    addRequiredText(details, value, 'tipo_animal', errors);
    addOptionalBoolean(details, value, 'resulto_herido');
  }

  if (incidentType === 'ataque_ganado') {
    addRequiredText(details, value, 'tipo_animal', errors);
    const count = integerFromText(value.cantidad_afectada, { min: 1, max: 1000 });
    if (count === null) {
      errors.cantidad_afectada = { key: 'integerRange', values: { min: 1, max: 1000 } };
    } else {
      details.cantidad_afectada = count;
    }
  }

  if (incidentType === 'perro_lastimado') {
    if (!INJURED_DOG_SITUATIONS.includes(value.situacion)) {
      errors.situacion = { key: 'requiredChoice' };
    } else {
      details.situacion = value.situacion;
    }
  }

  const dogSize = DOG_SIZES.includes(value.dog_size) ? value.dog_size : null;
  if (value.dog_size && value.dog_size !== 'no_se' && !dogSize) {
    errors.dog_size = { key: 'requiredChoice' };
  }

  const collar = value.has_collar === 'no_se' || value.has_collar === ''
    ? null
    : booleanFromChoice(value.has_collar);
  if (collar === null && value.has_collar && value.has_collar !== 'no_se') {
    errors.has_collar = { key: 'requiredChoice' };
  }

  // '' = none/cleared. The form starts from the automatic detection; the user's
  // choice (including clearing it) always wins.
  const dogColor = textOrEmpty(value.dog_color);
  if (dogColor && !isDogColor(dogColor)) errors.dog_color = { key: 'requiredChoice' };

  if (Object.keys(errors).length) {
    return { reportFields: null, errors };
  }

  return {
    reportFields: {
      incident_type: incidentType,
      sighting_type: sightingType,
      details,
      dog: {
        predominant_color: dogColor || null,
        size: dogSize,
        has_collar: collar,
      },
    },
    errors: {},
  };
}

/** Throws for an unknown incident/sighting type or details keys outside the contract. */
function assertDetailsContract(reportFields) {
  const incidentType = reportFields.incident_type;
  const sightingType = reportFields.sighting_type;
  const details = reportFields.details ?? {};
  if (!INCIDENT_TYPES.includes(incidentType)) throw new Error('invalid_incident_type');
  if (!SIGHTING_TYPES.includes(sightingType)) throw new Error('invalid_sighting_type');
  requirePlainObject(details, 'details');
  const allowed = REPORT_DETAILS_CONTRACT[incidentType] ?? [];
  const unsupported = Object.keys(details).filter((key) => !allowed.includes(key));
  if (unsupported.length) {
    throw new Error(`unsupported_report_details:${unsupported.join(',')}`);
  }
}

/** Validates dog fields; throws `invalid_dog_fields`. */
function normalizeDog(dog = {}) {
  const value = requirePlainObject(dog, 'dog');
  const predominantColor = value.predominant_color ?? null;
  const size = value.size ?? null;
  const hasCollar = value.has_collar ?? null;
  if (
    (predominantColor !== null &&
      (typeof predominantColor !== 'string' ||
        codePointLength(predominantColor) < 1 ||
        codePointLength(predominantColor) > FIELD_MAX.predominant_color)) ||
    (size !== null && !DOG_SIZES.includes(size)) ||
    (hasCollar !== null && typeof hasCollar !== 'boolean')
  ) {
    throw new Error('invalid_dog_fields');
  }
  return {
    predominant_color: predominantColor,
    size,
    has_collar: hasCollar,
  };
}

// True only when on-device validation actually accepted the photo; null when it
// was skipped (Expo Go, web, model error) or there is no photo.
export function clientCheckPassedForPayload(draft) {
  if (!draft.photo_file_uri) return null;
  return draft.photo_validation?.status === 'accepted' ? true : null;
}

/**
 * Builds the `POST /reports` body from a draft and validated fields.
 * @param {object} options
 * @param {import('./reportDraft.js').ReportDraft} options.draft
 * @param {ReportFields} options.reportFields
 * @param {string} options.deviceFingerprint - At least 16 characters.
 * @param {boolean} [options.honeypotFilled=false]
 * @returns {object} Payload with `id`, `location`, types, `details`, `dog`, `photo`, `anti_abuse` and
 *   `client_created_at`.
 * @throws {Error} `draft_must_be_object`, `report_fields_must_be_object`, `unsupported_report_fields:<keys>`,
 *   `invalid_device_fingerprint`, `invalid_incident_type`, `invalid_sighting_type`,
 *   `unsupported_report_details:<keys>`, `invalid_report_draft_id`, location errors or `invalid_dog_fields`.
 */
export function buildReportPayload({
  draft,
  reportFields,
  deviceFingerprint,
  honeypotFilled = false,
}) {
  requirePlainObject(draft, 'draft');
  const fields = requirePlainObject(reportFields, 'report_fields');
  const unsupported = Object.keys(fields).filter(
    (key) => !EDITABLE_REPORT_FIELDS.includes(key),
  );
  if (unsupported.length) {
    throw new Error(`unsupported_report_fields:${unsupported.join(',')}`);
  }
  if (typeof deviceFingerprint !== 'string' || deviceFingerprint.length < 16) {
    throw new Error('invalid_device_fingerprint');
  }
  assertDetailsContract(fields);

  return {
    id: assertDraftId(draft.id),
    location: locationForReportPayload(draft.location_snapshot),
    incident_type: fields.incident_type,
    sighting_type: fields.sighting_type,
    details: fields.details ?? {},
    dog: normalizeDog(fields.dog ?? {
      predominant_color: null,
      size: null,
      has_collar: null,
    }),
    photo: {
      expected: Boolean(draft.photo_file_uri),
      client_check_passed: clientCheckPassedForPayload(draft),
    },
    anti_abuse: {
      device_fingerprint: deviceFingerprint,
      honeypot_filled: Boolean(honeypotFilled),
    },
    client_created_at: clientCreatedAtForReportPayload(draft.location_snapshot),
  };
}
