export function presentReportReceipt(c, receipt) {
  const requestId = c.get("requestId") ?? "";
  c.header("X-Request-Id", requestId);
  return c.json(
    {
      data: {
        report_id: receipt.reportId,
        moderation_status: receipt.moderationStatus,
        photo_expected: receipt.photoExpected,
        photo_status_url: `/reports/${receipt.reportId}/photo-status`,
      },
    },
    receipt.replayed ? 200 : 201,
  );
}
