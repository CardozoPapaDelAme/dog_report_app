import { getSql } from "../infrastructure/db.js";
import {
  autoHideReportByFlags,
  consumeFlagRateLimit,
  countDistinctActiveFlagOrigins,
  findExistingFlagByOrigin,
  getActiveFlagConfig,
  insertFlag,
  insertFlagAudit,
  lockReportForFlag,
} from "../repositories/flag-repository.js";
import { secondsUntilNextHour, sha256Hex } from "./reportService.js";

function flagError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function moderationValues(report) {
  return {
    status: report.status,
    status_reason: report.status_reason,
    previous_status: report.previous_status,
    accepted_at: report.accepted_at,
    published_at: report.published_at,
    public_until: report.public_until,
    hidden_at: report.hidden_at,
    deleted_at: report.deleted_at,
  };
}

function isReportFlaggable(report) {
  return Boolean(
    report &&
      report.status === "visible" &&
      report.publicly_available === true &&
      report.noncanonical !== true,
  );
}

function mapPersistenceError(error) {
  if (error?.code === "23505") {
    return flagError(
      "flag_already_submitted",
      "This device has already flagged this report.",
    );
  }
  if (
    [
      "CONNECTION_CLOSED",
      "CONNECTION_ENDED",
      "CONNECT_TIMEOUT",
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
      "57P01",
      "57P02",
      "57P03",
    ].includes(error?.code) || error?.code?.startsWith("08")
  ) {
    return flagError(
      "dependency_unavailable",
      "Flag storage is unavailable.",
    );
  }
  return error;
}

const productionDependencies = {
  getSql,
  lockReportForFlag,
  getActiveFlagConfig,
  findExistingFlagByOrigin,
  consumeFlagRateLimit,
  insertFlag,
  countDistinctActiveFlagOrigins,
  autoHideReportByFlags,
  insertFlagAudit,
};

export async function submitFlag(
  { reportId, command, deviceFingerprint },
  dependencies = productionDependencies,
) {
  const originHash = await sha256Hex(deviceFingerprint);
  const sql = dependencies.getSql();

  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', '', true)`;
      await tx`SELECT set_config('app.role', 'anonymous', true)`;
      await tx`SELECT set_config('app.origin_hash', ${originHash}, true)`;
      await tx`SELECT set_config('app.report_id', ${reportId}, true)`;

      const report = await dependencies.lockReportForFlag(tx, reportId);
      if (!isReportFlaggable(report)) {
        throw flagError(
          "report_not_flaggable",
          "Report is not public, has expired, was not found, or is not canonical.",
        );
      }

      const existing = await dependencies.findExistingFlagByOrigin(tx, {
        reportId,
        originHash,
      });
      if (existing) {
        throw flagError(
          "flag_already_submitted",
          "This device has already flagged this report.",
        );
      }

      const config = await dependencies.getActiveFlagConfig(tx);
      if (!config) {
        throw flagError(
          "configuration_unavailable",
          "Active flag configuration is missing.",
        );
      }

      const allowed = await dependencies.consumeFlagRateLimit(tx, {
        originHash,
        limit: config.flag_rate_limit_per_hour,
      });
      if (!allowed) {
        throw flagError(
          "flag_rate_limit_exceeded",
          "Hourly flag limit exceeded.",
          {
            retryAfterSeconds: secondsUntilNextHour(config.server_now),
          },
        );
      }

      const flag = await dependencies.insertFlag(tx, {
        reportId,
        reason: command.reason,
        detail: command.detail,
        originHash,
        fingerprintRetentionDays: config.fingerprint_retention_days,
      });
      const distinctOrigins = await dependencies.countDistinctActiveFlagOrigins(
        tx,
        reportId,
      );

      if (distinctOrigins >= config.flag_auto_hide_threshold) {
        const hidden = await dependencies.autoHideReportByFlags(tx, reportId);
        if (hidden) {
          await dependencies.insertFlagAudit(tx, {
            action: "report_auto_hidden",
            reportId,
            previousValues: moderationValues(report),
            newValues: moderationValues(hidden),
          });
          return { flagId: flag.id, reportStatus: hidden.status };
        }
      }

      return { flagId: flag.id, reportStatus: report.status };
    });
  } catch (error) {
    throw mapPersistenceError(error);
  }
}
