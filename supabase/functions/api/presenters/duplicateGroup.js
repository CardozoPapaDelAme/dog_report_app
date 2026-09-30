function view(row) {
  return {
    id: row.id,
    canonical_report_id: row.canonical_report_id,
    report_ids: row.report_ids,
    status: row.status,
    resolution_version: row.resolution_version,
    resolved_at: new Date(row.resolved_at).toISOString(),
    reversed_at: row.reversed_at == null
      ? null
      : new Date(row.reversed_at).toISOString(),
  };
}
export function presentDuplicateGroup(c, row, status = 200) {
  c.header("X-Request-Id", c.get("requestId") ?? "");
  return c.json({ data: { duplicate_group: view(row) } }, status);
}
export function presentDuplicateGroups(c, rows) {
  c.header("X-Request-Id", c.get("requestId") ?? "");
  return c.json({ data: { duplicate_groups: rows.map(view) } });
}

export function presentDuplicateCandidates(c, snapshot) {
  c.header("X-Request-Id", c.get("requestId") ?? "");
  return c.json({ data: {
    reports: snapshot.reports.map((report) => ({
      id: report.id, status: report.status, incident_type: report.incident_type,
      sighting_type: report.sighting_type, details: report.details,
      dog: { predominant_color: report.dog?.predominant_color, size: report.dog?.size, has_collar: report.dog?.has_collar },
      location: { longitude: report.location?.longitude, latitude: report.location?.latitude },
      client_created_at: report.client_created_at,
    })),
    candidates: snapshot.candidates.map((edge) => ({
      id: edge.id, report_a: edge.report_a, report_b: edge.report_b, status: edge.status,
      distance_meters: Number(edge.distance_meters), minutes_apart: Number(edge.minutes_apart),
      matched_signals: edge.matched_signals,
    })),
  } });
}
