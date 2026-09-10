import { CONFIGURATION_RULES, ConfigurationError, validateConfiguration } from './configuration.js';

export function validConfiguration(overrides = {}) {
  return {
    flag_auto_hide_threshold: 5,
    duplicate_radius_meters: 150,
    duplicate_time_window_minutes: 120,
    trust_high_threshold: 0.8,
    trust_medium_threshold: 0.5,
    gps_accuracy_max_meters: 50,
    report_rate_limit_per_hour: 10,
    flag_rate_limit_per_hour: 30,
    change_note: 'Adjust thresholds after review',
    ...overrides,
  };
}

function rejects(input, field) {
  try {
    validateConfiguration(input);
  } catch (error) {
    if (!(error instanceof ConfigurationError) || error.code !== 'invalid_request' ||
        (field && !error.details?.fields[field])) throw error;
    return;
  }
  throw new Error(`Expected invalid_request for ${field ?? 'body'}`);
}

Deno.test('FAB-1 VALIDATION: accepts complete configuration without mutating input', () => {
  const input = Object.freeze(validConfiguration());
  const output = validateConfiguration(input);
  if (JSON.stringify(input) !== JSON.stringify(output)) throw new Error('Values changed');
});

for (const [field, { min, max, decimals }] of Object.entries(CONFIGURATION_RULES)) {
  Deno.test(`FAB-1 VALIDATION: ${field} bounds, types and storage precision`, () => {
    for (const value of [undefined, null, '5', true, NaN, Infinity, min - 1, max + 1]) {
      rejects(validConfiguration({ [field]: value }), field);
    }
    const valid = validConfiguration({ trust_medium_threshold: 0, trust_high_threshold: 1 });
    // The two impossible endpoints fail the cross-field rule, not the numeric range.
    for (const value of [min, max]) {
      const input = { ...valid, [field]: value };
      if (input.trust_medium_threshold < input.trust_high_threshold) validateConfiguration(input);
      else rejects(input, 'trust_medium_threshold');
    }
    rejects(validConfiguration({ [field]: min + 10 ** -(decimals + 1) }), field);
  });
}

Deno.test('FAB-1 VALIDATION: rejects partial bodies, extra fields and inverted trust bands', () => {
  for (const input of [null, [], 1, 'text', {}]) rejects(input);
  for (const field of ['environment', 'version', 'is_active', 'created_by', 'public_retention_days', '__proto__']) {
    rejects({ ...validConfiguration(), [field]: 1 }, field);
  }
  rejects(validConfiguration({ trust_medium_threshold: 0.8 }), 'trust_medium_threshold');
  rejects(validConfiguration({ trust_medium_threshold: 0.9 }), 'trust_medium_threshold');
});

Deno.test('FAB-1 VALIDATION: requires bounded nonblank audit note', () => {
  for (const note of [undefined, null, 12, '', ' \n ', 'x'.repeat(1001)]) {
    rejects(validConfiguration({ change_note: note }), 'change_note');
  }
  validateConfiguration(validConfiguration({ change_note: 'x'.repeat(1000) }));
  validateConfiguration(validConfiguration({ change_note: '🐕'.repeat(1000) }));
});
