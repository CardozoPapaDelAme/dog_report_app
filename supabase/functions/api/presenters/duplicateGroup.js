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
