import {
  PHOTO_TERMINAL_STATES,
  PHOTO_UPLOAD_STATE,
  photoStatusAllowsLocalCompletion,
  photoStatusIsPending,
  photoStatusIsTerminal,
  photoStatusSucceeded,
} from './photoState.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

function status(overrides = {}) {
  return {
    report_id: '00000000-0000-4000-8000-000000000001',
    photo_expected: true,
    state: PHOTO_UPLOAD_STATE.PROCESSING,
    rejection_code: null,
    processing_complete: false,
    upload_succeeded: false,
    local_cleanup_allowed: false,
    ...overrides,
  };
}

Deno.test('L8 photo state treats only documented upload states as final', () => {
  for (const state of PHOTO_TERMINAL_STATES) {
    const terminal = status({
      state,
      processing_complete: true,
      local_cleanup_allowed: true,
      upload_succeeded: state === PHOTO_UPLOAD_STATE.APPROVED,
    });
    assert(photoStatusIsTerminal(terminal), `${state} should be terminal`);
    assert(!photoStatusIsPending(terminal), `${state} should not be pending`);
    assert(photoStatusAllowsLocalCompletion(terminal), `${state} should allow cleanup`);
  }

  const processing = status();
  assert(!photoStatusIsTerminal(processing));
  assert(photoStatusIsPending(processing));
  assert(!photoStatusAllowsLocalCompletion(processing));
});

Deno.test('L8 photo cleanup is tied to a terminal status, not a loose flag', () => {
  assert(!photoStatusAllowsLocalCompletion(status({
    state: PHOTO_UPLOAD_STATE.PROCESSING,
    processing_complete: false,
    local_cleanup_allowed: true,
  })));
  assert(!photoStatusAllowsLocalCompletion(status({
    state: 'unexpected_final',
    processing_complete: true,
    local_cleanup_allowed: true,
  })));
});

Deno.test('L8 approved is the only successful terminal upload state', () => {
  assert(photoStatusSucceeded(status({
    state: PHOTO_UPLOAD_STATE.APPROVED,
    processing_complete: true,
    upload_succeeded: true,
    local_cleanup_allowed: true,
  })));
  assert(!photoStatusSucceeded(status({
    state: PHOTO_UPLOAD_STATE.REJECTED,
    processing_complete: true,
    upload_succeeded: false,
    local_cleanup_allowed: true,
  })));
});
