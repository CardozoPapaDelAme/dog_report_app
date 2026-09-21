const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CREATION_FIELDS = new Set([
  'name', 'source_uri', 'source_version', 'source_sha256', 'geometry',
]);

export class ZoneSetError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ZoneSetError';
    this.code = code;
    this.details = details;
  }
}

function characterCount(value) {
  return [...value].length;
}

function meaningfulString(value, field, max) {
  if (typeof value !== 'string') return { error: `${field} must be a string.` };
  const normalized = value.trim();
  if (characterCount(normalized) === 0 || characterCount(normalized) > max) {
    return { error: `${field} must contain between 1 and ${max} characters and not be blank.` };
  }
  return { value: normalized };
}

function equalPosition(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function normalizePosition(value, field) {
  if (!Array.isArray(value) || value.length !== 2 ||
      !value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))) {
    throw new ZoneSetError('invalid_request', 'Zone geometry is invalid.', {
      fields: { geometry: `${field} must be a longitude/latitude pair.` },
    });
  }
  const [longitude, latitude] = value;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new ZoneSetError('invalid_request', 'Zone geometry is invalid.', {
      fields: { geometry: `${field} is outside WGS84 longitude/latitude bounds.` },
    });
  }
  return [longitude, latitude];
}

function normalizeRing(value, field) {
  if (!Array.isArray(value) || value.length < 4) {
    throw new ZoneSetError('invalid_request', 'Zone geometry is invalid.', {
      fields: { geometry: `${field} must contain at least four positions.` },
    });
  }
  const ring = value.map((position, index) => normalizePosition(position, `${field}[${index}]`));
  if (!equalPosition(ring[0], ring.at(-1))) {
    throw new ZoneSetError('invalid_request', 'Zone geometry is invalid.', {
      fields: { geometry: `${field} must be closed.` },
    });
  }
  return ring;
}

function normalizePolygon(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ZoneSetError('invalid_request', 'Zone geometry is invalid.', {
      fields: { geometry: `${field} must contain at least one linear ring.` },
    });
  }
  return value.map((ring, index) => normalizeRing(ring, `${field}[${index}]`));
}

// The API persists this exact normalized MultiPolygon representation. Its UTF-8
// JSON is the checksum payload, avoiding client-specific whitespace/key ordering.
export function normalizeZoneGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object' || Array.isArray(geometry)) {
    throw new ZoneSetError('invalid_request', 'Zone geometry is invalid.', {
      fields: { geometry: 'Must be a GeoJSON Polygon or MultiPolygon object.' },
    });
  }
  const keys = Object.keys(geometry);
  if (keys.length !== 2 || !keys.includes('type') || !keys.includes('coordinates')) {
    throw new ZoneSetError('invalid_request', 'Zone geometry is invalid.', {
      fields: { geometry: 'Must contain only type and coordinates.' },
    });
  }
  if (geometry.type === 'Polygon') {
    return { type: 'MultiPolygon', coordinates: [normalizePolygon(geometry.coordinates, 'geometry.coordinates')] };
  }
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new ZoneSetError('invalid_request', 'Zone geometry is invalid.', {
        fields: { geometry: 'MultiPolygon must contain at least one Polygon.' },
      });
    }
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon, index) => normalizePolygon(polygon, `geometry.coordinates[${index}]`)),
    };
  }
  throw new ZoneSetError('invalid_request', 'Zone geometry is invalid.', {
    fields: { geometry: 'type must be Polygon or MultiPolygon.' },
  });
}

export function canonicalZoneGeometry(geometry) {
  return JSON.stringify(normalizeZoneGeometry(geometry));
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function validateZoneSetCreation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ZoneSetError('invalid_request', 'Body must be a JSON object.');
  }

  const fields = Object.create(null);
  for (const field of Object.keys(input)) {
    if (!CREATION_FIELDS.has(field)) fields[field] = 'Unknown field.';
  }

  const nameResult = meaningfulString(input.name, 'name', 120);
  const sourceUriResult = meaningfulString(input.source_uri, 'source_uri', 1000);
  const sourceVersionResult = meaningfulString(input.source_version, 'source_version', 120);
  if (nameResult.error) fields.name = nameResult.error;
  if (sourceUriResult.error) fields.source_uri = sourceUriResult.error;
  if (sourceVersionResult.error) fields.source_version = sourceVersionResult.error;
  if (sourceUriResult.value) {
    try { new URL(sourceUriResult.value); } catch { fields.source_uri = 'source_uri must be an absolute URI.'; }
  }
  if (typeof input.source_sha256 !== 'string' || !SHA256_PATTERN.test(input.source_sha256)) {
    fields.source_sha256 = 'Must be a lowercase SHA-256 hexadecimal digest.';
  }
  if (Object.keys(fields).length) {
    throw new ZoneSetError('invalid_request', 'Zone set values are invalid.', { fields });
  }

  const geometry = normalizeZoneGeometry(input.geometry);
  const canonicalGeometry = JSON.stringify(geometry);
  const expectedChecksum = await sha256Hex(canonicalGeometry);
  if (input.source_sha256 !== expectedChecksum) {
    throw new ZoneSetError('invalid_request', 'Zone set values are invalid.', {
      fields: { source_sha256: 'Must match the canonical normalized GeoJSON geometry.' },
    });
  }

  return {
    name: nameResult.value, source_uri: sourceUriResult.value, source_version: sourceVersionResult.value,
    source_sha256: input.source_sha256, geometry, canonical_geometry: canonicalGeometry,
  };
}

export function validateZoneSetActivation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ZoneSetError('invalid_request', 'Body must be a JSON object.');
  }
  const fields = Object.create(null);
  for (const field of Object.keys(input)) {
    if (!['association_approval_reference', 'note'].includes(field)) fields[field] = 'Unknown field.';
  }
  const approvalResult = meaningfulString(input.association_approval_reference, 'association_approval_reference', 1000);
  if (approvalResult.error) fields.association_approval_reference = approvalResult.error;
  let note = null;
  if (Object.hasOwn(input, 'note')) {
    const noteResult = meaningfulString(input.note, 'note', 1000);
    if (noteResult.error) fields.note = noteResult.error;
    else note = noteResult.value;
  }
  if (Object.keys(fields).length) {
    throw new ZoneSetError('invalid_request', 'Zone set activation values are invalid.', { fields });
  }
  return { association_approval_reference: approvalResult.value, note };
}

// The partial unique index is the database backstop. This domain rule makes the
// application invariant explicit before replacement is attempted.
export function assertAtMostOneActiveZone(zoneSets) {
  if (!Array.isArray(zoneSets) || zoneSets.length > 1) {
    throw new ZoneSetError('zone_set_conflict', 'More than one active zone set is not allowed.');
  }
}

export async function assertActivatableZoneSet(zoneSet) {
  if (!zoneSet || zoneSet.status !== 'draft' || !zoneSet.source_geojson ||
      typeof zoneSet.source_sha256 !== 'string' || !SHA256_PATTERN.test(zoneSet.source_sha256)) {
    throw new ZoneSetError('zone_set_conflict', 'Zone set is not eligible for activation.');
  }
  let canonicalGeometry;
  try { canonicalGeometry = canonicalZoneGeometry(zoneSet.source_geojson); } catch {
    throw new ZoneSetError('zone_set_conflict', 'Zone set geometry is not eligible for activation.');
  }
  if (await sha256Hex(canonicalGeometry) !== zoneSet.source_sha256) {
    throw new ZoneSetError('zone_set_conflict', 'Zone set checksum does not match its stored geometry.');
  }
}
