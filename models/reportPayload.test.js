import {
  REPORT_DETAILS_CONTRACT,
  buildReportPayload,
  createEmptyReportFormDraft,
  honeypotFilledFromForm,
  validateReportFormDraft,
} from './reportPayload.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

const draft = {
  id: '00000000-0000-4000-8000-000000000001',
  photo_file_uri: null,
  location_snapshot: {
    longitude: -107.63,
    latitude: 27.75,
    accuracy_meters: 12.5,
    mock_suspected: false,
    captured_at: '2026-09-28T20:00:00.000Z',
  },
};

Deno.test('L7 report payload contract exposes the exact DATA-MODEL incident keys', () => {
  assert(JSON.stringify(REPORT_DETAILS_CONTRACT) === JSON.stringify({
    avistamiento_simple: ['cantidad_aprox', 'descripcion'],
    ataque_humano: ['hubo_mordida', 'descripcion'],
    ataque_mascota: ['tipo_animal', 'resulto_herido', 'descripcion'],
    ataque_ganado: ['tipo_animal', 'cantidad_afectada', 'descripcion'],
    perro_lastimado: ['situacion', 'descripcion'],
    otro: ['descripcion'],
  }));
});

Deno.test('L7 form omits quantity for solitary sightings and never keeps stale conditional keys', () => {
  const form = {
    ...createEmptyReportFormDraft(),
    incident_type: 'avistamiento_simple',
    sighting_type: 'solitario',
    cantidad_aprox: '6',
    tipo_animal: 'gato',
    hubo_mordida: true,
    descripcion: 'Cerca de la plaza',
  };
  const { reportFields, errors } = validateReportFormDraft(form);
  assert(Object.keys(errors).length === 0);
  assert(reportFields.details.descripcion === 'Cerca de la plaza');
  assert(!Object.hasOwn(reportFields.details, 'cantidad_aprox'));
  assert(!Object.hasOwn(reportFields.details, 'tipo_animal'));
  assert(!Object.hasOwn(reportFields.details, 'hubo_mordida'));
});

Deno.test('L7 form requires pack quantity from 2 to 1000 only for avistamiento manada', () => {
  const invalid = validateReportFormDraft({
    ...createEmptyReportFormDraft(),
    sighting_type: 'manada',
    cantidad_aprox: '1',
  });
  assert(invalid.errors.cantidad_aprox.key === 'integerRange');

  const valid = validateReportFormDraft({
    ...createEmptyReportFormDraft(),
    sighting_type: 'manada',
    cantidad_aprox: '2',
  });
  assert(valid.reportFields.details.cantidad_aprox === 2);
});

Deno.test('L7 conditional incident sections build only their allowed details', () => {
  const cases = [
    [
      { incident_type: 'ataque_humano', hubo_mordida: 'si', cantidad_aprox: '9' },
      { hubo_mordida: true },
    ],
    [
      { incident_type: 'ataque_mascota', tipo_animal: 'gato', resulto_herido: 'no' },
      { tipo_animal: 'gato', resulto_herido: false },
    ],
    [
      { incident_type: 'ataque_ganado', tipo_animal: 'borrego', cantidad_afectada: '3' },
      { tipo_animal: 'borrego', cantidad_afectada: 3 },
    ],
    [
      { incident_type: 'perro_lastimado', situacion: 'atrapado' },
      { situacion: 'atrapado' },
    ],
    [
      { incident_type: 'otro', descripcion: 'Algo distinto', tipo_animal: 'caballo' },
      { descripcion: 'Algo distinto' },
    ],
  ];

  for (const [input, expected] of cases) {
    const result = validateReportFormDraft({
      ...createEmptyReportFormDraft(),
      ...input,
    });
    assert(Object.keys(result.errors).length === 0, JSON.stringify(result.errors));
    assert(JSON.stringify(result.reportFields.details) === JSON.stringify(expected));
  }
});

Deno.test('L7 dog fields stay nullable and honeypot is a boolean signal only', () => {
  const clean = validateReportFormDraft(createEmptyReportFormDraft());
  assert(clean.reportFields.dog.predominant_color === null);
  assert(clean.reportFields.dog.size === null);
  assert(clean.reportFields.dog.has_collar === null);
  assert(honeypotFilledFromForm(clean.reportFields) === false);
  assert(honeypotFilledFromForm({ honeypot_contact: 'bot@example.test' }) === true);
});

Deno.test('L7 buildReportPayload preserves raw fingerprint byte-for-byte and rejects extra fields', () => {
  const rawFingerprint = '  raw-device-fingerprint-001  ';
  const { reportFields } = validateReportFormDraft(createEmptyReportFormDraft());
  const payload = buildReportPayload({
    draft,
    reportFields,
    deviceFingerprint: rawFingerprint,
    honeypotFilled: true,
  });
  assert(payload.anti_abuse.device_fingerprint === rawFingerprint);
  assert(payload.anti_abuse.honeypot_filled === true);
  assert(payload.dog.predominant_color === null);

  let failed = false;
  try {
    buildReportPayload({
      draft,
      reportFields: { ...reportFields, status: 'visible' },
      deviceFingerprint: rawFingerprint,
    });
  } catch (error) {
    failed = error.message.includes('unsupported_report_fields');
  }
  assert(failed, 'server-owned fields must be rejected locally');
});

Deno.test('PV-1 client_check_passed is true only when validation actually accepted the photo', () => {
  const build = (extra) => buildReportPayload({
    draft: { ...draft, ...extra },
    reportFields: validateReportFormDraft(createEmptyReportFormDraft()).reportFields,
    deviceFingerprint: 'device-fingerprint-1234',
  }).photo;
  const withPhoto = { photo_file_uri: 'file:///p.jpg' };
  assert(build({ photo_file_uri: null }).client_check_passed === null);
  assert(build({ ...withPhoto, photo_validation: { status: 'accepted' } }).client_check_passed === true);
  assert(build({ ...withPhoto, photo_validation: { status: 'skipped', reason: 'expo_go' } }).client_check_passed === null);
  assert(build({ ...withPhoto, photo_validation: null }).client_check_passed === null);
  assert(build(withPhoto).expected === true);
});
