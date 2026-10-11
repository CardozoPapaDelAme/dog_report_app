/**
 * @module presenters/publicMap
 * Shapes anonymous public map reports and clusters. Only approximate locations reach this layer.
 */
/**
 * Responds 200 with public reports.
 * @param {import('hono').Context} c - Hono request context.
 * @param {object[]} reports - Camel-cased public reports from the public map Service.
 * @returns {Response} `{ data: [...] }` with the `X-Request-Id` header.
 */
export function presentPublicReports(c, reports) {
  const requestId = c.get("requestId") ?? "";
  c.header("X-Request-Id", requestId);

  return c.json({
    data: reports.map((report) => ({
      report_id: report.reportId,
      approximate_location: report.approximateLocation,
      incident_type: report.incidentType,
      sighting_type: report.sightingType,
      details: report.details,
      dog: {
        predominant_color: report.dog.predominantColor,
        size: report.dog.size,
        has_collar: report.dog.hasCollar,
      },
      has_sanitized_photo: report.hasSanitizedPhoto,
      occurred_at: report.occurredAt,
      has_flags: report.hasFlags,
    })),
  }, 200);
}

/**
 * Responds 200 with public report clusters.
 * @param {import('hono').Context} c - Hono request context.
 * @param {object[]} clusters - Camel-cased clusters from the public map Service.
 * @returns {Response} `{ data: [...] }` with the `X-Request-Id` header.
 */
export function presentPublicClusters(c, clusters) {
  const requestId = c.get("requestId") ?? "";
  c.header("X-Request-Id", requestId);

  return c.json({
    data: clusters.map((cluster) => ({
      cluster_id: cluster.clusterId,
      report_count: cluster.reportCount,
      approximate_location: cluster.approximateLocation,
      highest_severity: cluster.highestSeverity,
      type_counts: cluster.typeCounts,
    })),
  }, 200);
}
