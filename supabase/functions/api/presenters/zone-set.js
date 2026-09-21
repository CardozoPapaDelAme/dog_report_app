function utc(value) {
  return value == null ? null : new Date(value).toISOString();
}

export function presentZoneSet(c, row, status = 200) {
  const zoneSet = {
    id: row.id, environment: row.environment, version: row.version, name: row.name,
    source_uri: row.source_uri, source_version: row.source_version, source_sha256: row.source_sha256,
    geometry: row.source_geojson, status: row.status,
    association_approval_reference: row.association_approval_reference,
    approved_at: utc(row.approved_at), activated_at: utc(row.activated_at), retired_at: utc(row.retired_at),
    created_by: row.created_by, created_at: utc(row.created_at),
  };
  c.header('X-Request-Id', c.get('requestId') ?? '');
  return c.json({ data: { zone_set: zoneSet } }, status);
}
