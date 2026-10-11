/**
 * @module presenters/report
 * Shapes the receipt of an anonymous report submission.
 */
/**
 * Responds 201 for a new report, or 200 when an idempotent replay returned an existing report.
 * @param {import('hono').Context} c - Hono request context.
 * @param {{reportId: string, moderationStatus: string, photoExpected: boolean, replayed: boolean}} receipt
 *   Result of the report Service.
 * @returns {Response} `{ data: { report_id, moderation_status, photo_expected, photo_status_url } }`.
 */
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
