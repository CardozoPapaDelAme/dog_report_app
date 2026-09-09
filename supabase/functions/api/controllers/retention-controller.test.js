import { validateRetentionBody } from './retention-controller.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test('retention accepts no body or an empty object', () => {
  assert(validateRetentionBody(''), 'missing body should be accepted');
  assert(validateRetentionBody('{}'), 'empty object should be accepted');
});

Deno.test('retention rejects caller clocks and malformed bodies', () => {
  assert(!validateRetentionBody('{'), 'malformed JSON should fail');
  assert(!validateRetentionBody('[]'), 'array body should fail');
  assert(!validateRetentionBody('{"now":"2026-09-09T00:00:00Z"}'), 'caller clock should fail');
});
