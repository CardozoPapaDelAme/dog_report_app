import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { createAssociationXlsx } from './associationWorkbook.js';

test('RIC-5 XLSX exports the accepted projection as values, not executable formulas', () => {
  const report = {
    id: '00000000-0000-4000-8000-000000000001',
    accepted_at: '2026-09-28T12:00:00.000Z',
    occurred_at: '2026-09-27T12:00:00.000Z',
    incident_type: '=HYPERLINK("bad")',
    sighting_type: 'solitario',
    details: { note: 'accepted' },
    dog: { predominant_color: null, size: 'mediano', has_collar: false },
    location: { longitude: -106.08, latitude: 28.63 },
    has_sanitized_photo: false,
  };
  const bytes = createAssociationXlsx([report]);
  const workbook = XLSX.read(bytes, { type: 'array' });
  const sheet = workbook.Sheets.Reportes;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], report.id);
  assert.equal(rows[1][3], report.incident_type);
  assert.equal(sheet.D2.f, undefined);
  assert.equal(rows[1][9], report.location.longitude);
});
