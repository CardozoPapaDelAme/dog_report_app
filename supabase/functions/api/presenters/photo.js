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
