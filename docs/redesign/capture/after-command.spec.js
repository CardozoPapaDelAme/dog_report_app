import { test } from '@playwright/test';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cmds = (s) => (s === 'hidden' ? ['approve', 'delete', 'restore'] : ['approve', 'hide', 'delete']);
const item = (n, o = {}) => ({ id: id(n), location: { longitude: -107.6355, latitude: 27.7522 + n / 1000, accuracy_meters: 12.5, mock_suspected: false }, incident_type: 'avistamiento_simple', sighting_type: 'solitario', details: { descripcion: `Reporte sintético ${n}` }, dog: { predominant_color: 'café', size: 'mediano', has_collar: false }, honeypot_suspected: false, status: 'pending_review', status_reason: 'low_trust', previous_status: null, trust: { tier: 'low', score: 0.3 }, photo_expected: false, photo_available: false, photo_state: null, flags: [], pending_duplicate_candidates: [], active_group_id: null, active_member_role: null, allowed_commands: cmds(o.status ?? 'pending_review'), client_created_at: '2026-09-30T11:00:00.000Z', synced_at: '2026-09-30T12:00:00.000Z', ...o });
const page1 = [item(1, { incident_type: 'ataque_humano', flags: [{ id: id(90), reason: 'foto_falsa' }] }), item(2, { incident_type: 'ataque_mascota', location: { longitude: -107.6, latitude: 27.7, accuracy_meters: 80, mock_suspected: true } }), item(3, { status: 'hidden', trust: { tier: 'medium', score: 0.6 } })];
for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(lang, () => {
    test.use({ viewport: { width: 390, height: 844 }, locale });
    test(`${lang} command`, async ({ page }) => {
      await page.route('**/admin/moderation-queue**', (r) => r.fulfill({ json: { data: { items: page1, next_cursor: null } } }));
      await page.goto('/?command-center&tools');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_command_start.png` });
      await page.getByText('Reporte sintético 1', { exact: true }).scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_command_queue.png` });
      if (lang === 'es') {
        await page.getByRole('button', { name: 'Ocultar', exact: true }).first().click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `docs/redesign/after/web/${lang}_command_note.png` });
      }
    });
  });
}
