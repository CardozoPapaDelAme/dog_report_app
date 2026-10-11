/**
 * @module hooks/reportFlagSubmit
 * Container-side helper that validates and submits one public report flag and maps the result to a
 * neutral UI outcome. Used by `components/ReportFlagSheet.js`.
 */
import { flagOutcome, validateFlagDraft } from '../models/reportFlag.js';
import { submitReportFlag } from '../services/flagApi.js';

// Sends one flag and maps every result to a neutral outcome ({ key, retryAfterMinutes? }); never throws.
// `getFingerprint` is injected by the UI (native/web fingerprint modules cannot load in unit tests).
/**
 * @param {object} draft
 * @param {string} draft.reportId - Public report id.
 * @param {string} draft.reason - One of `FLAG_REASONS` from `models/reportFlag.js`.
 * @param {string} [draft.detail] - Optional free text.
 * @param {object} [dependencies]
 * @param {() => Promise<string>} dependencies.getFingerprint - Resolves the installation fingerprint.
 * @param {typeof submitReportFlag} [dependencies.submit=submitReportFlag] - Flag request (network call).
 * @returns {Promise<ReturnType<typeof flagOutcome>>} `{ key: 'invalid' }` when the draft is invalid;
 *   never rejects.
 */
export async function sendReportFlag({ reportId, reason, detail }, { getFingerprint, submit = submitReportFlag } = {}) {
  if (!validateFlagDraft({ reason, detail }).ok) return { key: 'invalid' };
  try {
    const deviceFingerprint = await getFingerprint();
    return flagOutcome(await submit({ reportId, reason, detail, deviceFingerprint }));
  } catch (error) {
    return flagOutcome(error);
  }
}

// Outcomes after which the report must not be flagged again from this sheet.
/** @type {ReadonlyArray<string>} */
export const FINAL_FLAG_OUTCOMES = Object.freeze(['submitted', 'already_flagged', 'not_flaggable']);
