/**
 * @module presenters/photo
 * Shapes photo processing status, including the flags the mobile client uses to decide whether a local
 * photo copy may be cleaned up.
 */
/**
 * Derives `processing_complete`, `upload_succeeded`, and `local_cleanup_allowed` from the photo state.
 * Terminal states (`approved`, `rejected`, `purge_pending`, `purged`) and reports without an expected
 * photo allow local cleanup.
 */
function photoStatusFlags(state, photoExpected) {
  if (!photoExpected) {
    return {
      processing_complete: true,
      upload_succeeded: false,
      local_cleanup_allowed: true,
    };
  }
  if (state === "approved") {
    return {
      processing_complete: true,
      upload_succeeded: true,
      local_cleanup_allowed: true,
    };
  }
  if (["rejected", "purge_pending", "purged"].includes(state)) {
    return {
      processing_complete: true,
      upload_succeeded: false,
      local_cleanup_allowed: true,
    };
  }
  return {
    processing_complete: false,
    upload_succeeded: false,
    local_cleanup_allowed: false,
  };
}

/**
 * Responds with the photo status of a report.
 * @param {import('hono').Context} c - Hono request context.
 * @param {{reportId: string, photoExpected: boolean, state: string | null, rejectionCode: string | null}} status
 *   Photo status from the photo Service.
 * @param {number} [responseStatus=200] - HTTP status (201 after a newly approved upload).
 * @returns {Response} `{ data: { report_id, photo_expected, state, rejection_code, ...flags } }`.
 */
export function presentPhotoStatus(c, status, responseStatus = 200) {
  const flags = photoStatusFlags(status.state, status.photoExpected);
  return c.json(
    {
      data: {
        report_id: status.reportId,
        photo_expected: status.photoExpected,
        state: status.state,
        rejection_code: status.rejectionCode,
        ...flags,
      },
    },
    responseStatus,
  );
}
