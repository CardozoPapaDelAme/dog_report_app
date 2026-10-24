import { createSqlClient } from './db.js';

function assertEquals(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message} expected ${b}, got ${a}`);
}

async function assertRejects(fn) {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected the operation to reject');
}

/**
 * Fake postgres.js client: a tagged-template function with `begin` and `end`.
 * Each operation records its start/finish in `log` and resolves when `release()` is called
 * (or immediately when `autoRelease` is set).
 */
function fakeConnect({ autoRelease = true } = {}) {
  const clients = [];
  const log = [];
  const pending = [];

  function settle(label, result) {
    log.push(`start ${label}`);
    return new Promise((resolve) => {
      const finish = () => {
        log.push(`end ${label}`);
        resolve(result);
      };
      if (autoRelease) queueMicrotask(finish);
      else pending.push(finish);
    });
  }

  const connect = () => {
    const id = clients.length + 1;
    const client = (strings, ...values) => settle(`c${id}:${strings.join('?')}`, { strings: [...strings], values });
    client.begin = (fn) => {
      log.push(`begin c${id}`);
      return fn((strings, ...values) => settle(`c${id}:tx:${strings.join('?')}`, values));
    };
    client.ended = false;
    client.end = () => {
      client.ended = true;
      return Promise.resolve();
    };
    clients.push(client);
    return client;
  };
  return { connect, clients, log, releaseNext: () => pending.shift()?.() };
}

Deno.test('createSqlClient runs transactions one at a time on the shared connection', async () => {
  const fake = fakeConnect();
  const sql = createSqlClient({ connect: fake.connect, timeoutMs: 1000 });

  const first = sql.begin(async (tx) => {
    await tx`SELECT 1`;
    await tx`SELECT 2`;
    return 'first';
  });
  const second = sql.begin(async (tx) => {
    await tx`SELECT 3`;
    return 'second';
  });

  assertEquals(await Promise.all([first, second]), ['first', 'second']);
  assertEquals(fake.log, [
    'begin c1',
    'start c1:tx:SELECT 1', 'end c1:tx:SELECT 1',
    'start c1:tx:SELECT 2', 'end c1:tx:SELECT 2',
    'begin c1',
    'start c1:tx:SELECT 3', 'end c1:tx:SELECT 3',
  ]);
  assertEquals(fake.clients.length, 1);
});

Deno.test('createSqlClient keeps tagged-template queries working and serialized with transactions', async () => {
  const fake = fakeConnect();
  const sql = createSqlClient({ connect: fake.connect, timeoutMs: 1000 });

  const tx = sql.begin(async (t) => t`SELECT ${1}`);
  const query = sql`SELECT ${2} AS ok`;

  const [txValues, queryResult] = await Promise.all([tx, query]);
  assertEquals(txValues, [1]);
  assertEquals(queryResult, { strings: ['SELECT ', ' AS ok'], values: [2] });
  assertEquals(fake.log.indexOf('start c1:SELECT ? AS ok') > fake.log.indexOf('end c1:tx:SELECT ?'), true);
});

Deno.test('createSqlClient releases the queue after a failed operation', async () => {
  const fake = fakeConnect();
  const sql = createSqlClient({ connect: fake.connect, timeoutMs: 1000 });

  const failing = sql.begin(() => Promise.reject(Object.assign(new Error('boom'), { code: '23505' })));
  const next = sql.begin(async (tx) => tx`SELECT 1`);

  const error = await assertRejects(() => failing);
  assertEquals(error.code, '23505');
  assertEquals(await next, []);
  assertEquals(fake.clients.length, 1);
  assertEquals(fake.clients[0].ended, false);
});

Deno.test('createSqlClient fails a hung operation with CONNECTION_CLOSED, discards the client and reconnects', async () => {
  const fake = fakeConnect({ autoRelease: false });
  const sql = createSqlClient({ connect: fake.connect, timeoutMs: 20 });

  const hung = sql.begin(async (tx) => tx`SELECT pg_sleep(60)`);
  const queued = sql.begin(async (tx) => tx`SELECT 1`);

  const error = await assertRejects(() => hung);
  assertEquals(error.code, 'CONNECTION_CLOSED');
  assertEquals(fake.clients[0].ended, true);

  // The queued operation runs on a fresh client instead of waiting behind the hung one.
  fake.releaseNext(); // the abandoned query on the old client settles late; it must not matter
  await new Promise((resolve) => setTimeout(resolve, 0));
  fake.releaseNext();
  assertEquals(await queued, []);
  assertEquals(fake.clients.length, 2);
  assertEquals(fake.clients[1].ended, false);
});

Deno.test('createSqlClient creates the connection lazily', () => {
  const fake = fakeConnect();
  createSqlClient({ connect: fake.connect, timeoutMs: 1000 });
  assertEquals(fake.clients.length, 0);
});
