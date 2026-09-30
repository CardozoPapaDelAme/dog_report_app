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
