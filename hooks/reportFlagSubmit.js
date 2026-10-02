import { flagOutcome, validateFlagDraft } from '../models/reportFlag.js';
import { submitReportFlag } from '../services/flagApi.js';

// Sends one flag and maps every result to a neutral outcome ({ key, retryAfterMinutes? }); never throws.
// `getFingerprint` is injected by the UI (native/web fingerprint modules cannot load in unit tests).
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
export const FINAL_FLAG_OUTCOMES = Object.freeze(['submitted', 'already_flagged', 'not_flaggable']);
