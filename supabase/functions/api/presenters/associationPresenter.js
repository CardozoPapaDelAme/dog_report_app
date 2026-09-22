function encodeCursor(row) {
  const raw = `${new Date(row.accepted_at).toISOString()}|${row.id}`;
  return btoa(raw).replaceAll("+", "-").replaceAll("/", "_").replaceAll(
    "=",
    "",
  );
}

export function presentAssociationReports(c, { rows, hasMore }) {
  const requestId = c.get("requestId") ?? "";
  c.header("X-Request-Id", requestId);

  return c.json({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        location: {
          longitude: Number(row.longitude),
          latitude: Number(row.latitude),
        },
        incident_type: row.incident_type,
        sighting_type: row.sighting_type,
        details: row.details,
        dog: {
          predominant_color: row.color_predominante,
          size: row.tamano,
          has_collar: row.tiene_collar,
        },
        has_sanitized_photo: row.has_sanitized_photo,
        occurred_at: row.client_created_at,
        accepted_at: row.accepted_at,
      })),
      next_cursor: hasMore ? encodeCursor(rows[rows.length - 1]) : null,
    },
  }, 200);
}
