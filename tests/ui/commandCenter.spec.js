import { test, expect } from '@playwright/test';

// RF19 / HU-19 (and the RF20 hide/restore/approve commands it opens): the
// Administrator Command Center renders the moderation queue served over
// intercepted HTTP. No real session, JWT or backend is involved.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const commandsFor = (status) => (status === 'hidden' ? ['approve', 'delete', 'restore'] : ['approve', 'hide', 'delete']);
const item = (n, overrides = {}) => ({
  id: id(n),
  location: { longitude: -107.6355, latitude: 27.7522 + n / 1000, accuracy_meters: 12.5, mock_suspected: false },
  incident_type: 'avistamiento_simple',
  sighting_type: 'solitario',
  details: { descripcion: `Reporte sintético ${n}` },
  dog: { predominant_color: 'café', size: 'mediano', has_collar: false },
  honeypot_suspected: false,
  status: 'pending_review',
  status_reason: 'low_trust',
  previous_status: null,
  trust: { tier: 'low', score: 0.3 },
  photo_expected: false,
  photo_available: false,
  photo_state: null,
  flags: [],
  pending_duplicate_candidates: [],
  active_group_id: null,
  active_member_role: null,
  allowed_commands: commandsFor(overrides.status ?? 'pending_review'),
  client_created_at: '2026-09-30T11:00:00.000Z',
  synced_at: '2026-09-30T12:00:00.000Z',
  ...overrides,
});
const firstPage = [
  item(1, { incident_type: 'ataque_humano', flags: [{ id: id(90), reason: 'foto_falsa' }] }),
  item(2, { incident_type: 'ataque_mascota', location: { longitude: -107.6, latitude: 27.7, accuracy_meters: 80, mock_suspected: true } }),
  item(3, { status: 'hidden', trust: { tier: 'medium', score: 0.6 } }),
];

const errors = new WeakMap();
test.beforeEach(({ page }) => {
  const list = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

// `queue(url)` returns { status, body } for each GET; commands echo the new status.
async function setup(page, { queue = () => ({ status: 200, body: { data: { items: firstPage, next_cursor: null } } }), path = '/?command-center' } = {}) {
  const state = { reads: [], commands: [] };
  await page.route('**/admin/moderation-queue**', async (route) => {
    const url = new URL(route.request().url());
    state.reads.push({ url, authorization: route.request().headers().authorization });
    const { status, body } = queue(url, state);
    await route.fulfill({ status, json: body });
  });
  await page.route('**/admin/reports/*/*', async (route) => {
    const request = route.request();
    const [, reportId, command] = new URL(request.url()).pathname.match(/\/admin\/reports\/([^/]+)\/([a-z]+)$/);
    state.commands.push({ reportId, command, body: request.postDataJSON(), authorization: request.headers().authorization });
    const status = { approve: 'visible', hide: 'hidden', restore: 'pending_review', delete: 'deleted' }[command];
    await route.fulfill({ json: { data: { report_id: reportId, status, status_reason: `administrator_${command}`, allowed_commands: status === 'hidden' ? commandsFor('hidden') : status === 'pending_review' ? commandsFor('pending_review') : [] } } });
  });
  await page.goto(path);
  return state;
}

const metric = (page, label, value) => page.locator('div', { has: page.getByText(label, { exact: true }) })
  .filter({ hasText: new RegExp(`^${value}${label}$`) }).first();
const card = (page, n) => page.locator('div', { has: page.getByText(`Reporte sintético ${n}`, { exact: true }) })
  .filter({ has: page.getByRole('button', { name: 'Eliminar', exact: true }) }).last();

test('renders the moderation queue with its context and page summary from the protected endpoint', async ({ page }, info) => {
  const state = await setup(page);
  await expect(page.getByText('Cola de moderación', { exact: true })).toBeVisible();
  await expect(card(page, 1)).toBeVisible();
  for (const read of state.reads) {
    expect(read.authorization).toMatch(/^Bearer test-session-/);
    expect(read.url.searchParams.get('limit')).toBe('20');
    expect(read.url.searchParams.has('cursor')).toBe(false);
  }
  await expect(metric(page, 'En esta página', 3)).toBeVisible();
  await expect(metric(page, 'Con banderas', 1)).toBeVisible();
  await expect(metric(page, 'Prioridad alta', 2)).toBeVisible();
  await expect(card(page, 1).getByText('Ataque a persona', { exact: true })).toBeVisible();
  await expect(card(page, 1).getByText('Banderas: 1', { exact: true })).toBeVisible();
  await expect(card(page, 1).getByText('27.75320, -107.63550', { exact: true })).toBeVisible();
  await expect(card(page, 2).getByText('Requiere atención: se detectaron señales sospechosas.', { exact: true })).toBeVisible();
  await expect(card(page, 3).getByText('Oculto', { exact: true })).toBeVisible();
  await expect(card(page, 3).getByRole('button', { name: 'Restaurar', exact: true })).toBeVisible();
  await expect(card(page, 3).getByRole('button', { name: 'Ocultar', exact: true })).toHaveCount(0);
  await expect(card(page, 1).getByRole('button', { name: 'Restaurar', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('command-center-queue.png'), fullPage: true, animations: 'disabled' });
});

test('hide requires a note, keeps the card as hidden, restore returns it to pending and approve removes it', async ({ page }) => {
  const state = await setup(page);
  await card(page, 1).getByRole('button', { name: 'Ocultar', exact: true }).click();
  const confirmHide = page.getByRole('button', { name: 'Confirmar ocultar', exact: true });
  await expect(page.getByLabel('Motivo para ocultar')).toBeVisible();
  await page.getByLabel('Motivo para ocultar').fill('   ');
  await confirmHide.click({ force: true });
  expect(state.commands).toHaveLength(0);
  await page.getByLabel('Motivo para ocultar').fill('  Foto no corresponde  ');
  await confirmHide.click();
  await expect(card(page, 1).getByText('Oculto', { exact: true })).toBeVisible();
  expect(state.commands[0]).toMatchObject({ reportId: id(1), command: 'hide', body: { note: 'Foto no corresponde' } });
  expect(state.commands[0].authorization).toMatch(/^Bearer test-session-/);
  await expect(metric(page, 'En esta página', 3)).toBeVisible();

  await card(page, 1).getByRole('button', { name: 'Restaurar', exact: true }).click();
  await page.getByLabel('Motivo para restaurar').fill('Revisión adicional');
  await page.getByRole('button', { name: 'Confirmar restaurar', exact: true }).click();
  await expect(card(page, 1).getByText('Pendiente', { exact: true })).toBeVisible();
  expect(state.commands[1]).toMatchObject({ command: 'restore', body: { note: 'Revisión adicional' } });

  await card(page, 2).getByRole('button', { name: 'Aprobar', exact: true }).click();
  await expect(page.getByText('Reporte sintético 2', { exact: true })).toHaveCount(0);
  expect(state.commands[2]).toMatchObject({ reportId: id(2), command: 'approve', body: {} });
  await expect(metric(page, 'En esta página', 2)).toBeVisible();
  await expect(metric(page, 'Prioridad alta', 1)).toBeVisible();
});

test('load more sends the next_cursor and appends the following page', async ({ page }) => {
  const state = await setup(page, {
    queue: (url) => (url.searchParams.get('cursor') === 'cursor-page-2'
      ? { status: 200, body: { data: { items: [item(4)], next_cursor: null } } }
      : { status: 200, body: { data: { items: firstPage, next_cursor: 'cursor-page-2' } } }),
  });
  await page.getByRole('button', { name: 'Cargar más', exact: true }).click();
  await expect(card(page, 4)).toBeVisible();
  await expect(metric(page, 'En esta página', 4)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cargar más', exact: true })).toHaveCount(0);
  const paged = state.reads.filter((read) => read.url.searchParams.get('cursor') === 'cursor-page-2');
  expect(paged.length).toBeGreaterThan(0);
  expect(paged[0].url.searchParams.get('limit')).toBe('20');
});

test('an empty queue shows the empty state with zero metrics', async ({ page }) => {
  await setup(page, { queue: () => ({ status: 200, body: { data: { items: [], next_cursor: null } } }) });
  await expect(page.getByText('No hay reportes pendientes en esta página.', { exact: true })).toBeVisible();
  await expect(metric(page, 'En esta página', 0)).toBeVisible();
  await expect(metric(page, 'Con banderas', 0)).toBeVisible();
});

for (const [status, code] of [[403, 'forbidden'], [503, 'database_unavailable']]) {
  test(`a ${status} ${code} response shows the error banner and recovers on retry`, async ({ page }) => {
    let broken = true; // StrictMode loads twice in dev, so fail by state, not by call count
    await setup(page, {
      queue: () => (broken
        ? { status, body: { error: { code, message: 'x' } } }
        : { status: 200, body: { data: { items: firstPage, next_cursor: null } } }),
    });
    await expect(page.getByText('No pudimos actualizar la cola', { exact: true })).toBeVisible();
    await expect(page.getByText('Reporte sintético 1', { exact: true })).toHaveCount(0);
    broken = false;
    await page.getByText('Toca para intentar nuevamente.', { exact: true }).click();
    await expect(card(page, 1)).toBeVisible();
    await expect(page.getByText('No pudimos actualizar la cola', { exact: true })).toHaveCount(0);
  });
}

test('without an Administrator session the queue is not requested', async ({ page }) => {
  const state = await setup(page, { path: '/?command-center&no-session' });
  await expect(page.getByText('Sesión de administrador requerida', { exact: true })).toBeVisible();
  expect(state.reads).toHaveLength(0);
});
