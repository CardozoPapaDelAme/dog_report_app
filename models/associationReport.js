// RIC-2 client model. Keep only fields exposed by AssociationReportView.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function invalidResponse() {
  throw Object.assign(new Error('Invalid association reports response'), { code: 'invalid_response' });
}

function validTimestamp(value) {
  return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function localDay(value, hour, minute, second, millisecond) {
  const match = typeof value === 'string' ? DAY.exec(value) : null;
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second, millisecond);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

// Date-only filters represent full local calendar days; RIC-2 receives UTC instants.
export function validateAssociationDateRange(fromDay, toDay) {
  const from = localDay(fromDay, 0, 0, 0, 0);
  const to = localDay(toDay, 23, 59, 59, 999);
  const errors = {};
  if (!from) errors.from = 'invalid_date';
  if (!to) errors.to = 'invalid_date';
  if (from && to && from > to) errors.to = 'before_from';
  return { errors, range: Object.keys(errors).length ? null : { from: from.toISOString(), to: to.toISOString() } };
}

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
