import {
  applyModerationResult,
  normalizeModerationReport,
  summarizeModerationPage,
} from './moderation.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test('moderation model derives display and page summary fields', () => {
  const reports = [
    normalizeModerationReport({
      incident_type: 'ataque_humano',
      details: { descripcion: 'Near the plaza' },
      flags: [{ id: 'flag' }],
      pending_duplicate_candidates: [],
    }),
    normalizeModerationReport({ incident_type: 'avistamiento_simple', details: {}, flags: [] }),
  ];
  assert(reports[0].description === 'Near the plaza', 'description should be normalized');
  assert(reports[0].isHighSeverity, 'human attack should be urgent');
  const summary = summarizeModerationPage(reports);
  assert(summary.total === 2, 'summary should count the loaded page');
  assert(summary.flagged === 1, 'summary should count flagged reports');
  assert(summary.urgent === 1, 'summary should count urgent reports');
});

Deno.test('moderation results remove published/deleted cards but retain queue states', () => {
  const reports = [normalizeModerationReport({ id: 'report', incident_type: 'otro' })];
  assert(
    applyModerationResult(reports, 'report', { status: 'visible' }).length === 0,
    'approved report should leave the queue',
  );
  assert(
    applyModerationResult(reports, 'report', { status: 'deleted' }).length === 0,
    'deleted report should leave the queue',
  );
  const restored = applyModerationResult(reports, 'report', {
    status: 'pending_review',
    allowed_commands: ['approve', 'hide', 'delete'],
  });
  assert(restored[0].status === 'pending_review', 'restored report should remain in the queue');
});

Deno.test('hiding keeps the card in the queue and swaps hide for restore', () => {
  const reports = [
    normalizeModerationReport({
      id: 'report',
      incident_type: 'otro',
      status: 'pending_review',
      allowed_commands: ['approve', 'hide', 'delete'],
    }),
  ];
  const hidden = applyModerationResult(reports, 'report', {
    report_id: 'report',
    status: 'hidden',
    allowed_commands: ['approve', 'delete', 'restore'],
  });
  assert(hidden.length === 1, 'hidden report should stay in the queue');
  assert(hidden[0].status === 'hidden', 'hidden report should show the hidden status');
  assert(!hidden[0].allowed_commands.includes('hide'), 'hidden report cannot be hidden again');
  assert(hidden[0].allowed_commands.includes('restore'), 'hidden report can be restored');
});
