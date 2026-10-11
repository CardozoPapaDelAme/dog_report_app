/**
 * @module services/trustService
 * Pure trust scoring for new reports: combines GPS accuracy and origin submission frequency into a
 * score and tier, and decides whether a report auto-publishes or waits for moderation.
 */
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value) {
  return Number(clamp01(value).toFixed(3));
}

/** Rounded mean of the non-null values. */
function average(values) {
  const present = values.filter((value) =>
    value !== null && value !== undefined
  );
  return roundScore(
    present.reduce((sum, value) => sum + value, 0) / present.length,
  );
}

/** Maps a score to `high`, `medium`, or `low` using the configured thresholds. */
function trustTier(score, config) {
  if (score >= Number(config.trust_high_threshold)) {
    return "high";
  }
  if (score >= Number(config.trust_medium_threshold)) {
    return "medium";
  }
  return "low";
}

/** 1 within the accuracy limit; otherwise `maxMeters / accuracyMeters`, rounded. */
function gpsTrustScore(accuracyMeters, maxMeters) {
  if (accuracyMeters <= maxMeters) {
    return 1;
  }
  return roundScore(maxMeters / accuracyMeters);
}

/** 1 for the first submission in the hourly bucket, decreasing linearly with further submissions. */
function fingerprintTrustScore(rateBucketCount, limit) {
  const count = Number.isInteger(rateBucketCount) && rateBucketCount > 0
    ? rateBucketCount
    : 1;
  const numericLimit = Number(limit);
  const configuredLimit = Number.isInteger(numericLimit) && numericLimit > 0
    ? numericLimit
    : 1;
  if (count <= 1) {
    return 1;
  }
  return roundScore(1 - ((count - 1) / configuredLimit));
}

/**
 * Scores a report and chooses its initial status. Only a high-trust report without honeypot, mock
 * location, or imprecise GPS signals is published immediately (`visible`); everything else is
 * `pending_review` with the reason recorded in `statusReason`.
 * @param {object} options
 * @param {import('./reportService.js').ReportCommand} options.command - Validated report command.
 * @param {import('../repositories/reportRepository.js').ActiveReportConfig} options.config - Active configuration.
 * @param {number | undefined} options.rateBucketCount - Submissions from this origin in the current hour.
 * @returns {{status: 'visible' | 'pending_review', statusReason: string, trustTier: 'high' | 'medium' | 'low',
 *   trustScore: number, gpsTrustScore: number, fingerprintTrustScore: number}}
 */
export function assessReportTrust({ command, config, rateBucketCount }) {
  const gpsScore = gpsTrustScore(
    command.location.accuracyMeters,
    Number(config.gps_accuracy_max_meters),
  );
  const originScore = fingerprintTrustScore(
    rateBucketCount,
    Number(config.report_rate_limit_per_hour),
  );
  const score = average([gpsScore, originScore]);
  const tier = trustTier(score, config);

  let status = "pending_review";
  let statusReason = "medium_or_low_trust";
  if (command.antiAbuse.honeypotFilled) {
    statusReason = "honeypot_signal";
  } else if (command.location.mockSuspected) {
    statusReason = "mock_location";
  } else if (
    command.location.accuracyMeters > Number(config.gps_accuracy_max_meters)
  ) {
    statusReason = "imprecise_gps";
  } else if (tier === "high") {
    status = "visible";
    statusReason = "high_trust_auto_publish";
  }

  return {
    status,
    statusReason,
    trustTier: tier,
    trustScore: score,
    gpsTrustScore: gpsScore,
    fingerprintTrustScore: originScore,
  };
}
