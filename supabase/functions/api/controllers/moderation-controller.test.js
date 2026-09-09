import { parseApproveBody, parseDeleteBody } from './moderation-controller.js';

function assertEquals(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test('approve accepts an omitted body or optional note', () => {
  assertEquals(parseApproveBody(''), { ok: true, note: null });
  assertEquals(parseApproveBody('{}'), { ok: true, note: null });
  assertEquals(parseApproveBody('{"note":""}'), { ok: true, note: '' });
  assertEquals(parseApproveBody('{"note":"Reviewed evidence"}'), {
    ok: true,
    note: 'Reviewed evidence',
  });
});

Deno.test('approve rejects malformed or undeclared body fields', () => {
  assertEquals(parseApproveBody('{'), { ok: false });
  assertEquals(parseApproveBody('[]'), { ok: false });
  assertEquals(parseApproveBody('{"status":"visible"}'), { ok: false });
});

Deno.test('approve enforces the audit note type and storage limit', () => {
  assertEquals(parseApproveBody('{"note":42}'), { ok: false });
  assertEquals(parseApproveBody(JSON.stringify({ note: 'x'.repeat(1001) })), { ok: false });
  assertEquals(parseApproveBody(JSON.stringify({ note: 'x'.repeat(1000) })), {
    ok: true,
    note: 'x'.repeat(1000),
  });
});

Deno.test('delete requires a non-empty audit note', () => {
  assertEquals(parseDeleteBody(''), { ok: false });
  assertEquals(parseDeleteBody('{}'), { ok: false });
  assertEquals(parseDeleteBody('{"note":"   "}'), { ok: false });
  assertEquals(parseDeleteBody('{"note":"Logical deletion requested"}'), {
    ok: true,
    note: 'Logical deletion requested',
  });
});
