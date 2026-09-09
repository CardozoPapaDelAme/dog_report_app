import { getModerationQueue, runModerationCommand } from './moderationApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test('moderation API requests the queue with bearer authorization', async () => {
  let captured;
  const data = await getModerationQueue({ accessToken: 'token', cursor: 'next', limit: 10 }, (path, options) => {
    captured = { path, options };
    return Promise.resolve(Response.json({ data: { items: [], next_cursor: null } }));
  });
  assert(captured.path === '/admin/moderation-queue?limit=10&cursor=next', 'queue path should be exact');
  assert(captured.options.headers.Authorization === 'Bearer token', 'token should authorize the request');
  assert(data.items.length === 0, 'queue data should be unwrapped');
});

Deno.test('moderation API keeps commands generic for hide and restore extensions', async () => {
  let captured;
  await runModerationCommand(
    { accessToken: 'token', reportId: 'report-id', command: 'delete', note: 'Reason' },
    (path, options) => {
      captured = { path, options };
      return Promise.resolve(Response.json({ data: { status: 'deleted' } }));
    },
  );
  assert(captured.path === '/admin/reports/report-id/delete', 'command path should be composed generically');
  assert(captured.options.body === JSON.stringify({ note: 'Reason' }), 'command note should be serialized');
});

Deno.test('moderation API exposes typed server failures', async () => {
  try {
    await getModerationQueue({ accessToken: 'expired' }, () =>
      Promise.resolve(Response.json({ error: { code: 'invalid_token', message: 'Invalid' } }, { status: 401 }))
    );
    throw new Error('server failure was accepted');
  } catch (error) {
    assert(error.code === 'invalid_token', 'server code should be preserved');
    assert(error.status === 401, 'HTTP status should be preserved');
  }
});
