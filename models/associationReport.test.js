import { readAssociationReportPage, validateAssociationDateRange } from './associationReport.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
const report = {
  id: '11111111-1111-4111-8111-111111111111',
  location: { longitude: -106.08, latitude: 28.63 },
  incident_type: 'avistamiento_simple', sighting_type: 'solitario',
  details: { observaciones: 'Cerca del hotel' },
  dog: { predominant_color: null, size: 'mediano', has_collar: false },
  has_sanitized_photo: true,
  occurred_at: '2026-09-01T08:00:00.000Z',
  accepted_at: '2026-09-02T08:00:00.000Z',
};

Deno.test('RIC-2 model: valid local dates become an inclusive RFC 3339 range', () => {
  const { range, errors } = validateAssociationDateRange('2026-09-01', '2026-09-02');
  assert(Object.keys(errors).length === 0 && range);
  assert(new Date(range.from).getTime() === new Date(2026, 8, 1).getTime());
  assert(new Date(range.to).getTime() === new Date(2026, 8, 3).getTime() - 1);
  assert(validateAssociationDateRange('2026-09-02', '2026-09-01').errors.to === 'before_from');
  assert(validateAssociationDateRange('2026-02-30', '2026-03-01').errors.from === 'invalid_date');
  assert(validateAssociationDateRange('', '2026-03-01').range === null);
});

Deno.test('RIC-2 model: reads the exact authorized projection and opaque cursor', () => {
  const page = readAssociationReportPage({ items: [{ ...report, trust_score: 0.9, dog: { ...report.dog, private_path: 'secret' } }], next_cursor: 'opaque-cursor' });
  assert(page.next_cursor === 'opaque-cursor' && page.items.length === 1);
  assert(!Object.hasOwn(page.items[0], 'trust_score'));
  assert(!Object.hasOwn(page.items[0].dog, 'private_path'));
  assert(readAssociationReportPage({ items: [], next_cursor: null }).items.length === 0);
});

Deno.test('RIC-2 model: rejects malformed pages instead of showing partial data', () => {
  for (const data of [null, {}, { items: [], next_cursor: 'cursor' },
    { items: [report], next_cursor: undefined },
    { items: [report, report], next_cursor: null },
    { items: [{ ...report, accepted_at: '2026-09-02' }], next_cursor: null },
    { items: [{ ...report, location: { longitude: 181, latitude: 28.63 } }], next_cursor: null },
    { items: [{ ...report, dog: null }], next_cursor: null }]) {
    let failed = false;
    try { readAssociationReportPage(data); } catch (error) { failed = error.code === 'invalid_response'; }
    assert(failed);
  }
});
