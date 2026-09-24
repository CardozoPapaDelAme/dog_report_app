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
