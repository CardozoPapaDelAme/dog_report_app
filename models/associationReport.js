/**
 * @module models/associationReport
 * Client-side model for association reports (RIC-2): date range helpers, response validation and CSV
 * export.
 */
// RIC-2 client model. Keep only fields exposed by AssociationReportView.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * @param {Date} date
 * @returns {string} Local calendar date as `YYYY-MM-DD`.
 */
export function associationDateText(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * @param {'last7Days' | 'last30Days' | 'thisMonth'} preset
 * @param {Date} [today=new Date()]
 * @returns {{fromDay: string, toDay: string}}
 * @throws {RangeError} For an unknown preset.
 */
export function getAssociationQuickRange(preset, today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  if (preset === 'last7Days') start.setDate(start.getDate() - 6);
  else if (preset === 'last30Days') start.setDate(start.getDate() - 29);
  else if (preset === 'thisMonth') start.setDate(1);
  else throw new RangeError('Unknown association date preset');
  return { fromDay: associationDateText(start), toDay: associationDateText(end) };
}

function invalidResponse() {
  throw Object.assign(new Error('Invalid association reports response'), { code: 'invalid_response' });
}

function validTimestamp(value) {
  return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

/** Parses `YYYY-MM-DD` as a local Date at the given time; `null` when invalid. */
function localDay(value, hour, minute, second, millisecond) {
  const match = typeof value === 'string' ? DAY.exec(value) : null;
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second, millisecond);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

// Date-only filters represent full local calendar days; RIC-2 receives UTC instants.
/**
 * @param {string} fromDay - `YYYY-MM-DD`.
 * @param {string} toDay - `YYYY-MM-DD`.
 * @returns {{errors: {from?: 'invalid_date', to?: 'invalid_date' | 'before_from'},
 *   range: {from: string, to: string} | null}} ISO instants covering whole local days.
 */
export function validateAssociationDateRange(fromDay, toDay) {
  const from = localDay(fromDay, 0, 0, 0, 0);
  const to = localDay(toDay, 23, 59, 59, 999);
  const errors = {};
  if (!from) errors.from = 'invalid_date';
  if (!to) errors.to = 'invalid_date';
  if (from && to && from > to) errors.to = 'before_from';
  return { errors, range: Object.keys(errors).length ? null : { from: from.toISOString(), to: to.toISOString() } };
}

/**
 * @typedef {object} AssociationReport
 * @property {string} id
 * @property {{longitude: number, latitude: number}} location
 * @property {string} incident_type
 * @property {string} sighting_type
 * @property {object} details
 * @property {{predominant_color: string | null, size: string | null, has_collar: boolean | null}} dog
 * @property {boolean} has_sanitized_photo
 * @property {string} occurred_at
 * @property {string} accepted_at
 */
/**
 * @typedef {object} AssociationReportPage
 * @property {AssociationReport[]} items
 * @property {string | null} next_cursor
 */
/**
 * Validates one response page and keeps only the fields of AssociationReportView.
 * @param {unknown} data
 * @returns {AssociationReportPage}
 * @throws {Error} `invalid_response` for a malformed page or item.
 */
export function readAssociationReportPage(data) {
  if (!data || !Array.isArray(data.items) ||
      !(data.next_cursor === null || (typeof data.next_cursor === 'string' && data.next_cursor.length > 0)) ||
      (data.next_cursor && data.items.length === 0)) invalidResponse();

  const ids = new Set();
  const items = data.items.map((item) => {
    if (!UUID.test(item?.id) || ids.has(item.id) ||
        !Number.isFinite(item.location?.longitude) || item.location.longitude < -180 || item.location.longitude > 180 ||
        !Number.isFinite(item.location?.latitude) || item.location.latitude < -90 || item.location.latitude > 90 ||
        typeof item.incident_type !== 'string' || !item.incident_type ||
        typeof item.sighting_type !== 'string' || !item.sighting_type ||
        !item.details || typeof item.details !== 'object' || Array.isArray(item.details) ||
        !item.dog || typeof item.dog !== 'object' || Array.isArray(item.dog) ||
        !(item.dog.predominant_color === null || typeof item.dog.predominant_color === 'string') ||
        !(item.dog.size === null || typeof item.dog.size === 'string') ||
        !(item.dog.has_collar === null || typeof item.dog.has_collar === 'boolean') ||
        typeof item.has_sanitized_photo !== 'boolean' ||
        !validTimestamp(item.occurred_at) || !validTimestamp(item.accepted_at)) invalidResponse();
    ids.add(item.id);
    return {
      id: item.id,
      location: { longitude: item.location.longitude, latitude: item.location.latitude },
      incident_type: item.incident_type,
      sighting_type: item.sighting_type,
      details: item.details,
      dog: {
        predominant_color: item.dog.predominant_color,
        size: item.dog.size,
        has_collar: item.dog.has_collar,
      },
      has_sanitized_photo: item.has_sanitized_photo,
      occurred_at: item.occurred_at,
      accepted_at: item.accepted_at,
    };
  });
  return { items, next_cursor: data.next_cursor };
}

export const ASSOCIATION_REPORT_COLUMNS = Object.freeze([
  'id', 'accepted_at', 'occurred_at', 'incident_type', 'sighting_type', 'details',
  'predominant_color', 'size', 'has_collar', 'longitude', 'latitude', 'has_sanitized_photo',
]);

/**
 * @param {AssociationReport} report
 * @returns {Array<*>} Values in {@link ASSOCIATION_REPORT_COLUMNS} order; `details` as JSON.
 */
export function associationReportValues(report) {
  return [report.id, report.accepted_at, report.occurred_at, report.incident_type,
    report.sighting_type, JSON.stringify(report.details), report.dog.predominant_color,
    report.dog.size, report.dog.has_collar, report.location.longitude,
    report.location.latitude, report.has_sanitized_photo];
}

/** Quotes a CSV cell and neutralizes spreadsheet formula prefixes. */
function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Spreadsheet programs may interpret user-provided details as formulas.
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * @param {AssociationReport[]} rows
 * @returns {string} CSV with a UTF-8 BOM, a header row and CRLF line endings.
 */
export function createAssociationCsv(rows) {
  const lines = [ASSOCIATION_REPORT_COLUMNS.map(csvCell).join(',')];
  for (const row of rows) lines.push(associationReportValues(row).map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
