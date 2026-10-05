import {
  FLAG_DEFAULT_RETRY_MINUTES, FLAG_DETAIL_MAX, FLAG_REASONS, flagDetailLength, flagOutcome, validateFlagDraft,
} from './reportFlag.js';
import { parseFlagBody } from '../supabase/functions/api/controllers/flag-controller.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
const err = (status, code, extra = {}) => Object.assign(new Error(code), { status, code, ...extra });

Deno.test('ERI10 model: reasons are ordered and accepted/rejected exactly like the server parser', async () => {
  assert(FLAG_REASONS.length === 6 && FLAG_REASONS[0] === 'foto_falsa' && FLAG_REASONS[5] === 'otro');
  for (const reason of FLAG_REASONS) {
    const parsed = parseFlagBody(JSON.stringify({ reason, device_fingerprint: 'x'.repeat(16) }));
    assert(parsed.ok === true, `server accepts ${reason}`);
  }
  assert(parseFlagBody(JSON.stringify({ reason: 'spam', device_fingerprint: 'x'.repeat(16) })).ok === false);
  assert(FLAG_DETAIL_MAX === 1000);
  const longest = parseFlagBody(JSON.stringify({ reason: 'otro', detail: 'a'.repeat(FLAG_DETAIL_MAX), device_fingerprint: 'x'.repeat(16) }));
  assert(longest.ok === true);
  assert(parseFlagBody(JSON.stringify({ reason: 'otro', detail: 'a'.repeat(FLAG_DETAIL_MAX + 1), device_fingerprint: 'x'.repeat(16) })).ok === false);
});

Deno.test('ERI10 model: draft validation requires a reason and bounds the detail', () => {
  assert(validateFlagDraft({ reason: 'burla' }).ok);
  assert(validateFlagDraft({ reason: 'burla', detail: '' }).ok && validateFlagDraft({ reason: 'burla', detail: null }).ok);
  assert(validateFlagDraft({ reason: 'burla', detail: 'a'.repeat(1000) }).ok);
  assert(validateFlagDraft({ reason: 'burla', detail: `  ${'a'.repeat(1000)}  ` }).ok, 'trimmed length counts');
  assert(validateFlagDraft({ reason: 'burla', detail: 'a'.repeat(1001) }).errors.detail === 'too_long');
  assert(validateFlagDraft({ reason: 'burla', detail: 5 }).errors.detail === 'invalid');
  for (const reason of [undefined, '', 'spam', 3]) assert(validateFlagDraft({ reason }).errors.reason === 'required');
  assert(validateFlagDraft().ok === false);
  assert(flagDetailLength('ab') === 2 && flagDetailLength(undefined) === 0);
});

Deno.test('ERI10 model: outcomes map to neutral UI keys and never expose moderation state', () => {
  assert(flagOutcome({ flagId: 'f', reportStatus: 'visible' }).key === 'submitted');
  const hidden = flagOutcome({ flagId: 'f', reportStatus: 'hidden' });
  assert(hidden.key === 'submitted' && Object.keys(hidden).join() === 'key', 'hidden is not exposed');
  assert(flagOutcome(err(409, 'flag_already_submitted')).key === 'already_flagged');
  assert(flagOutcome(err(404, 'report_not_flaggable')).key === 'not_flaggable');
  assert(flagOutcome(err(null, 'network_unavailable')).key === 'offline');
  assert(flagOutcome(err(null, 'request_timeout')).key === 'offline');
  assert(flagOutcome(err(400, 'invalid_request')).key === 'invalid');
  assert(flagOutcome(err(503, 'dependency_unavailable')).key === 'unavailable');
  assert(flagOutcome(err(500, 'request_failed')).key === 'unavailable');
  assert(flagOutcome(new Error('boom')).key === 'unavailable');
});

Deno.test('ERI10 model: rate limit rounds Retry-After up to minutes with a 60 minute default', () => {
  assert(flagOutcome(err(429, 'flag_rate_limit_exceeded', { retryAfterSeconds: 1 })).retryAfterMinutes === 1);
  assert(flagOutcome(err(429, 'flag_rate_limit_exceeded', { retryAfterSeconds: 61 })).retryAfterMinutes === 2);
  assert(flagOutcome(err(429, 'flag_rate_limit_exceeded', { retryAfterSeconds: 3600 })).retryAfterMinutes === 60);
  const missing = flagOutcome(err(429, 'flag_rate_limit_exceeded'));
  assert(missing.key === 'rate_limited' && missing.retryAfterMinutes === FLAG_DEFAULT_RETRY_MINUTES);
});
