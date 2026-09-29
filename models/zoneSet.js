// Client contract mirrors FAB-2. No server modules are bundled into the app.
export const MAX_ZONE_FILE_BYTES = 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/;
export const emptyZoneDraft = () => ({ name: '', source_uri: '', source_version: '', content: '' });
export function zoneValidation(key) {
  return Object.assign(new Error(key), { code: 'invalid_zone_file', validationKey: key });
}
export function checkZoneTextSize(text) {
  if (typeof text !== 'string' || !text.trim()) throw zoneValidation('empty');
  let bytes = 0;
  for (const character of text) {
    const cp = character.codePointAt(0);
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (bytes > MAX_ZONE_FILE_BYTES) throw zoneValidation('size');
  }
}
export function normalizeZoneGeometry(geometry) {
  if (!geometry || Array.isArray(geometry) || typeof geometry !== 'object' ||
      Object.keys(geometry).length !== 2 || !Object.hasOwn(geometry, 'coordinates') ||
      !['Polygon', 'MultiPolygon'].includes(geometry.type)) throw zoneValidation('geometry');
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!Array.isArray(polygons) || !polygons.length) throw zoneValidation('geometry');
  const coordinates = polygons.map((polygon) => {
    if (!Array.isArray(polygon) || !polygon.length) throw zoneValidation('geometry');
    return polygon.map((ring) => {
      if (!Array.isArray(ring) || ring.length < 4) throw zoneValidation('ring');
      const positions = ring.map((position) => {
        if (!Array.isArray(position) || position.length !== 2 ||
            !position.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
            Math.abs(position[0]) > 180 || Math.abs(position[1]) > 90) throw zoneValidation('position');
        return [...position];
      });
      if (positions[0][0] !== positions.at(-1)[0] || positions[0][1] !== positions.at(-1)[1]) throw zoneValidation('ring');
      return positions;
    });
  });
  return { type: 'MultiPolygon', coordinates };
}
export async function prepareZoneText(content, digest) {
  checkZoneTextSize(content);
  let parsed;
  try { parsed = JSON.parse(content.replace(/^\uFEFF/, '')); } catch { throw zoneValidation('json'); }
  const geometry = normalizeZoneGeometry(parsed);
  const canonical = JSON.stringify(geometry);
  const checksum = await digest(canonical);
  if (!SHA.test(checksum)) throw Object.assign(new Error('Invalid digest'), { code: 'checksum_unavailable' });
  return { geometry, checksum, polygons: geometry.coordinates.length };
}
function textField(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && [...value.trim()].length <= max;
}
export function validateZoneDraft(draft, preview) {
  const errors = {};
  for (const [field, max] of [['name', 120], ['source_uri', 1000], ['source_version', 120]]) {
    if (!textField(draft[field], max)) errors[field] = { key: 'required', values: { max } };
  }
  if (!errors.source_uri) {
    try { new URL(draft.source_uri.trim()); } catch { errors.source_uri = { key: 'uri' }; }
  }
  if (!preview) errors.content = { key: 'prepare' };
  return { errors, input: Object.keys(errors).length ? null : {
    name: draft.name.trim(), source_uri: draft.source_uri.trim(), source_version: draft.source_version.trim(),
    geometry: preview.geometry, source_sha256: preview.checksum,
  } };
}
export function validateZoneApproval(reference) {
  return textField(reference, 1000) ? null : { key: 'approval' };
}
export function zoneFieldErrors(error) {
  const fields = error?.details?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
  const allowed = ['name', 'source_uri', 'source_version', 'source_sha256', 'geometry', 'association_approval_reference'];
  return Object.fromEntries(Object.entries(fields).filter(([key, value]) => allowed.includes(key) && typeof value === 'string' && value.trim()));
}
export function readZoneSet(data, { status, id, checksum, environment } = {}) {
  const zone = data?.zone_set;
  if (!zone || !UUID.test(zone.id) || !Number.isInteger(zone.version) || zone.version < 1 ||
      !['staging', 'production'].includes(zone.environment) || !['draft', 'active'].includes(zone.status) ||
      !SHA.test(zone.source_sha256) || !textField(zone.name, 120) || !textField(zone.source_version, 120) ||
      (status && zone.status !== status) || (id && zone.id !== id) ||
      (checksum && zone.source_sha256 !== checksum) || (environment && zone.environment !== environment) ||
      (zone.status === 'active' && !textField(zone.association_approval_reference, 1000))) {
    throw Object.assign(new Error('Invalid zone response'), { code: 'invalid_response' });
  }
  return zone;
}
