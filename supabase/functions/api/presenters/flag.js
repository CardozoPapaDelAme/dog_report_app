/**
 * @module presenters/flag
 * Shapes the receipt of an anonymous report flag.
 */
/**
 * Responds 201 with the created flag id and the resulting report status.
 * @param {import('hono').Context} c - Hono request context.
 * @param {{flagId: string, reportStatus: string}} receipt - Result of `submitFlag`.
 * @returns {Response} `{ data: { flag_id, report_status } }` with the `X-Request-Id` header.
 */
export function presentFlagReceipt(c, receipt) {
  const requestId = c.get("requestId") ?? "";
  c.header("X-Request-Id", requestId);
  return c.json(
    {
      data: {
        flag_id: receipt.flagId,
        report_status: receipt.reportStatus,
      },
    },
    201,
  );
}
