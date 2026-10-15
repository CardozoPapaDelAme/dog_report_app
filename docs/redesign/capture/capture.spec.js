// Redesign "before" screenshots (web only). Mocks mirror tests/ui/*.spec.js.
// Each shot is saved as docs/redesign/before/web/<lang>/<name>.png.
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../before/web');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const json = (route, body, status = 200) => route.fulfill({ status, json: body });

// ---- mock data (copied from the specs) ----
const counts = (o = {}) => ({ avistamiento_simple: 0, ataque_mascota: 0, ataque_ganado: 0, ataque_humano: 0, perro_lastimado: 0, otro: 0, ...o });
const clusters = [
  { cluster_id: 'cluster-high', report_count: 7, approximate_location: { longitude: -107.64, latitude: 27.75 }, highest_severity: 'ataque_humano',
    type_counts: counts({ avistamiento_simple: 3, ataque_mascota: 1, ataque_ganado: 1, ataque_humano: 1, perro_lastimado: 1 }) },
  { cluster_id: 'cluster-low', report_count: 2, approximate_location: { longitude: -107.7, latitude: 27.8 }, highest_severity: 'avistamiento_simple',
    type_counts: counts({ avistamiento_simple: 2 }) },
];
const mapReports = [
  { report_id: id(0xa1), approximate_location: { longitude: -107.64, latitude: 27.75 }, incident_type: 'ataque_mascota', sighting_type: 'manada',
    details: { cantidad_aprox: 3, descripcion: 'Cerca del mercado' }, dog: { predominant_color: 'negro', size: 'grande', has_collar: true },
    has_sanitized_photo: false, occurred_at: '2026-09-27T14:30:00.000Z', has_flags: true },
  { report_id: id(0xa2), approximate_location: { longitude: -107.65, latitude: 27.76 }, incident_type: 'avistamiento_simple', sighting_type: 'solitario',
    details: {}, dog: { predominant_color: null, size: null, has_collar: null }, has_sanitized_photo: false, occurred_at: '2026-09-28T10:00:00.000Z', has_flags: false },
];
const assocRow = (n, incident = 'avistamiento_simple') => ({
  id: id(n), location: { longitude: -106.08, latitude: 28.63 }, incident_type: incident, sighting_type: 'solitario',
  details: { cantidad_aprox: 1 }, dog: { predominant_color: null, size: 'mediano', has_collar: false }, has_sanitized_photo: false,
  occurred_at: '2026-09-01T12:00:00.000Z', accepted_at: n % 2 ? '2026-09-28T12:00:00.000Z' : '2026-09-29T12:00:00.000Z',
});
const modItem = (n, o = {}) => ({
  id: id(n), location: { longitude: -107.6355, latitude: 27.7522 + n / 1000, accuracy_meters: 12.5, mock_suspected: false },
  incident_type: 'avistamiento_simple', sighting_type: 'solitario', details: { descripcion: `Reporte sintético ${n}` },
  dog: { predominant_color: 'café', size: 'mediano', has_collar: false }, honeypot_suspected: false, status: 'pending_review', status_reason: 'low_trust',
  previous_status: null, trust: { tier: 'low', score: 0.3 }, photo_expected: false, photo_available: false, photo_state: null, flags: [],
  pending_duplicate_candidates: [], active_group_id: null, active_member_role: null,
  allowed_commands: (o.status ?? 'pending_review') === 'hidden' ? ['approve', 'delete', 'restore'] : ['approve', 'hide', 'delete'],
  client_created_at: '2026-09-30T11:00:00.000Z', synced_at: '2026-09-30T12:00:00.000Z', ...o,
});
const queue = [
  modItem(1, { incident_type: 'ataque_humano', flags: [{ id: id(90), reason: 'foto_falsa' }] }),
  modItem(2, { incident_type: 'ataque_mascota', location: { longitude: -107.6, latitude: 27.7, accuracy_meters: 80, mock_suspected: true } }),
  modItem(3, { status: 'hidden', trust: { tier: 'medium', score: 0.6 } }),
];
const config = { id: 'config-1', environment: 'staging', version: 1, is_active: true, flag_auto_hide_threshold: 5, duplicate_radius_meters: 150,
  duplicate_time_window_minutes: 120, trust_high_threshold: 0.8, trust_medium_threshold: 0.5, gps_accuracy_max_meters: 50,
  report_rate_limit_per_hour: 10, flag_rate_limit_per_hour: 30, change_note: 'Configuración inicial' };
const geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
const canonical = { type: 'MultiPolygon', coordinates: [geometry.coordinates] };
const checksum = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
const zone = { id: id(5), environment: 'staging', version: 2, name: 'Zona de prueba', source_uri: 'https://example.test/zona.geojson', source_version: 'v2',
  source_sha256: checksum, geometry: canonical, status: 'draft' };
const dupReports = [1, 2, 3, 4, 5].map((n) => ({ id: id(n), status: n === 2 ? 'hidden' : 'visible', incident_type: 'avistamiento_simple', sighting_type: 'solitario',
  details: { descripcion: `Evidencia original ${n}` }, dog: { predominant_color: 'café', size: 'mediano', has_collar: false },
  location: { latitude: 27.73, longitude: -107.63 }, client_created_at: '2026-09-30T12:00:00Z' }));
const dupEdges = [[1, 2], [2, 3], [4, 5]].map(([a, b], i) => ({ id: id(10 + i), report_a: id(a), report_b: id(b), status: 'pending', distance_meters: 100, minutes_apart: 2, matched_signals: {} }));

async function freezeToday(page) {
  await page.addInitScript(() => {
    const R = Date;
    class F extends R { constructor(...a) { super(...(a.length ? a : ['2026-10-04T12:00:00'])); } static now() { return new R('2026-10-04T12:00:00').valueOf(); } }
    window.Date = F;
  });
}

async function shot(page, lang, name, { full = true, settle = 400 } = {}) {
  await page.waitForTimeout(settle);
  const dir = join(OUT, lang);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: full, animations: 'disabled' });
}
const tryClick = async (loc) => { try { await loc.first().click({ timeout: 2500 }); return true; } catch { return false; } };

async function mockPublic(page, { clusterH, reportH } = {}) {
  await page.route('**/public/clusters**', (r) => (clusterH ? clusterH(r) : json(r, { data: clusters })));
  await page.route('**/public/reports**', (r) => (reportH ? reportH(r) : json(r, { data: mapReports })));
}

for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(`captures ${lang}`, () => {
    test.use({ locale });

    test(`login ${lang}`, async ({ page }) => {
      await page.goto('/?login'); await shot(page, lang, 'login_default');
      await page.goto('/?login&pending'); await shot(page, lang, 'login_pending');
      await page.goto('/?login&loading'); await shot(page, lang, 'login_loading');
      await page.goto('/?login&no-back'); await shot(page, lang, 'login_no_back');
    });

    test(`camera ${lang}`, async ({ page }) => {
      await page.goto('/?camera'); await shot(page, lang, 'camera_stub_preview');
    });

    test(`report form ${lang}`, async ({ page }) => {
      await page.route('**/reports', (r) => r.fulfill({ status: 500 }));
      await page.goto('/?report'); await shot(page, lang, 'report_form_no_photo');
      await tryClick(page.getByTestId('report-incident_type-select'));
      await shot(page, lang, 'report_form_incident_select_open', { full: false });
      await tryClick(page.getByTestId('report-incident_type-ataque_mascota'));
      await shot(page, lang, 'report_form_ataque_mascota');
      await page.getByTestId('report-submit').click(); await shot(page, lang, 'report_form_submit_error_500');
      await page.goto('/?report&photo&color'); await shot(page, lang, 'report_form_photo_color_detected');
    });

    test(`report form error + queued ${lang}`, async ({ page }) => {
      await page.route('**/reports', (r) => json(r, { error: { code: 'invalid_details', message: 'x', request_id: 'r1' } }, 400));
      await page.goto('/?report'); await page.getByTestId('report-submit').click(); await shot(page, lang, 'report_form_error_400');
      let n = 0;
      await page.unroute('**/reports');
      await page.route('**/reports', (r) => {
        n++;
        const p = r.request().postDataJSON();
        return n === 1 ? json(r, { error: { code: 'network_unavailable', message: 'offline' } }, 503)
          : json(r, { data: { report_id: p.id, moderation_status: 'pending_review', photo_expected: false, photo_status_url: '/x' } }, 201);
      });
      await page.goto('/?offline-queue');
      await page.getByTestId('report-submit').click();
      await shot(page, lang, 'report_form_queued_for_sync');
      await page.getByTestId('report-queued-back').click();
      await shot(page, lang, 'draft_queue_banner_pending');
      await page.getByTestId('draft-queue-retry').click();
      await shot(page, lang, 'draft_queue_banner_synced');
      await page.goto('/?offline-queue&terminal'); await shot(page, lang, 'draft_queue_banner_terminal');
    });

    test(`public map ${lang}`, async ({ page }) => {
      await mockPublic(page);
      await page.goto('/?map'); await shot(page, lang, 'map_clusters', { full: false, settle: 800 });
      await tryClick(page.getByRole('button', { name: /^7 / }));
      await shot(page, lang, 'map_cluster_modal', { full: false });
      await tryClick(page.getByTestId('cluster-modal').getByRole('button', { name: /Ver reportes|View area/ }));
      await shot(page, lang, 'map_zone_sheet', { full: false });
      await tryClick(page.getByTestId('zone-sheet').getByRole('button', { name: /mascota|pet/i }));
      await shot(page, lang, 'map_pin_sheet', { full: false });
      await tryClick(page.getByTestId('pin-sheet').getByRole('button', { name: /^(Denunciar|Report)$/ }));
      await shot(page, lang, 'map_flag_sheet', { full: false });
    });

    test(`public map states ${lang}`, async ({ page }) => {
      await mockPublic(page, { clusterH: (r) => json(r, { data: [] }) });
      await page.goto('/?map'); await shot(page, lang, 'map_empty', { full: false });
      await page.unroute('**/public/clusters**');
      await page.route('**/public/clusters**', (r) => json(r, { error: { code: 'internal_error', message: 'x' } }, 500));
      await page.goto('/?map'); await shot(page, lang, 'map_error_500', { full: false });
      await page.unroute('**/public/clusters**');
      await page.route('**/public/clusters**', (r) => r.abort('internetdisconnected'));
      await page.goto('/?map'); await shot(page, lang, 'map_offline', { full: false });
    });

    test(`public map zone states ${lang}`, async ({ page }) => {
      await page.route('**/public/clusters**', (r) => json(r, { data: clusters }));
      await page.route('**/public/reports**', (r) => json(r, { error: { code: 'internal_error', message: 'x' } }, 500));
      await page.goto('/?map');
      await tryClick(page.getByRole('button', { name: /^2 / }));
      await tryClick(page.getByTestId('cluster-modal').getByRole('button', { name: /Ver reportes|View area/ }));
      await shot(page, lang, 'map_zone_sheet_error', { full: false });
    });

    test(`expo go fallback ${lang}`, async ({ page }) => {
      await mockPublic(page);
      await page.goto('/?map&expo-go'); await shot(page, lang, 'map_expo_go_fallback');
      await tryClick(page.getByTestId('recent-reports').getByRole('button', { name: /mascota|pet/i }));
      await shot(page, lang, 'map_expo_go_pin_sheet', { full: false });
      await mockPublic(page, { reportH: (r) => json(r, { error: { code: 'internal_error', message: 'x' } }, 500) });
      await page.unroute('**/public/reports**');
      await page.route('**/public/reports**', (r) => json(r, { error: { code: 'internal_error', message: 'x' } }, 500));
      await page.goto('/?map&expo-go'); await shot(page, lang, 'map_expo_go_error');
      await page.unroute('**/public/reports**');
      await page.route('**/public/reports**', (r) => json(r, { data: [] }));
      await page.goto('/?map&expo-go'); await shot(page, lang, 'map_expo_go_empty');
    });

    test(`native cluster sizes ${lang}`, async ({ page }) => {
      await page.goto('/?native-map-clusters'); await shot(page, lang, 'map_native_cluster_sizes_stub');
    });

    test(`association dashboard ${lang}`, async ({ page }) => {
      await freezeToday(page);
      await page.route('**/association/reports?**', (r) => {
        if (new URL(r.request().url()).searchParams.get('cursor')) return json(r, { data: { items: [assocRow(2, 'ataque_mascota')], next_cursor: null } });
        return json(r, { data: { items: [assocRow(1), assocRow(3, 'perro_lastimado')], next_cursor: 'next' } });
      });
      await page.goto('/?association'); await shot(page, lang, 'association_mobile_cards', { settle: 800 });
      await tryClick(page.getByRole('button', { name: /Personalizado|Custom/ }));
      await shot(page, lang, 'association_custom_range');
      await tryClick(page.getByRole('button', { name: /^(Desde|From)/ }));
      await shot(page, lang, 'association_date_picker', { full: false });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/?association'); await shot(page, lang, 'association_desktop_table', { settle: 800 });
    });

    test(`association states ${lang}`, async ({ page }) => {
      await page.route('**/association/reports?**', (r) => json(r, { data: { items: [], next_cursor: null } }));
      await page.goto('/?association'); await shot(page, lang, 'association_empty');
      await page.unroute('**/association/reports?**');
      await page.route('**/association/reports?**', async (r) => {
        if (new URL(r.request().url()).searchParams.has('cursor')) return new Promise(() => {});
        return json(r, { data: { items: [assocRow(1)], next_cursor: 'next' } });
      });
      await page.goto('/?association'); await shot(page, lang, 'association_loading');
      await page.unroute('**/association/reports?**');
      await page.route('**/association/reports?**', (r) => json(r, { error: { code: 'internal_error', message: 'x' } }, 500));
      await page.goto('/?association'); await shot(page, lang, 'association_error_500');
      await page.goto('/?association-preview'); await shot(page, lang, 'association_preview_demo');
    });

    test(`command center ${lang}`, async ({ page }) => {
      await page.route('**/admin/moderation-queue**', (r) => json(r, { data: { items: queue, next_cursor: 'c2' } }));
      await page.goto('/?command-center'); await shot(page, lang, 'command_center_queue', { settle: 800 });
      await page.unroute('**/admin/moderation-queue**');
      await page.route('**/admin/moderation-queue**', (r) => json(r, { data: { items: [], next_cursor: null } }));
      await page.goto('/?command-center'); await shot(page, lang, 'command_center_empty');
      await page.unroute('**/admin/moderation-queue**');
      await page.route('**/admin/moderation-queue**', (r) => json(r, { error: { code: 'internal_error', message: 'x' } }, 500));
      await page.goto('/?command-center'); await shot(page, lang, 'command_center_error_500');
      await page.unroute('**/admin/moderation-queue**');
      await page.route('**/admin/moderation-queue**', (r) => json(r, { error: { code: 'forbidden' } }, 403));
      await page.goto('/?command-center'); await shot(page, lang, 'command_center_forbidden_403');
      await page.goto('/?command-center&no-session'); await shot(page, lang, 'command_center_no_session');
    });

    test(`command center hide flow ${lang}`, async ({ page }) => {
      await page.route('**/admin/moderation-queue**', (r) => json(r, { data: { items: queue, next_cursor: null } }));
      await page.goto('/?command-center');
      await tryClick(page.getByRole('button', { name: /^(Ocultar|Hide)$/ }));
      await shot(page, lang, 'command_center_hide_note');
    });

    test(`configuration ${lang}`, async ({ page }) => {
      await page.route('**/admin/configuration', (r) => json(r, { data: { configuration: config, zone_set: null } }));
      await page.goto('/'); await shot(page, lang, 'configuration_loaded', { settle: 800 });
      await page.getByTestId('configuration-gps_accuracy_max_meters').fill('501');
      await page.getByTestId('configuration-change_note').fill('Ajuste');
      await page.getByTestId('configuration-save').click(); await shot(page, lang, 'configuration_field_error');
      await page.setViewportSize({ width: 1200, height: 900 }); await shot(page, lang, 'configuration_desktop');
    });

    test(`configuration states ${lang}`, async ({ page }) => {
      await page.route('**/admin/configuration', (r) => json(r, { error: { code: 'internal_error', message: 'x' } }, 500));
      await page.goto('/'); await shot(page, lang, 'configuration_load_error');
      await page.unroute('**/admin/configuration');
      await page.route('**/admin/configuration', (r) => json(r, { error: { code: 'forbidden' } }, 403));
      await page.goto('/'); await shot(page, lang, 'configuration_forbidden_403');
      await page.goto('/?no-session'); await shot(page, lang, 'configuration_no_session');
    });

    test(`zone sets ${lang}`, async ({ page }) => {
      await page.route('**/admin/configuration', (r) => json(r, { data: { configuration: config, zone_set: null } }));
      await page.route('**/admin/zone-sets**', (r) => json(r, { data: { zone_set: r.request().url().endsWith('/activate') ? { ...zone, status: 'active' } : zone } }, 201));
      await page.goto('/?zones'); await shot(page, lang, 'zones_empty_form');
      await page.getByTestId('zone-content').fill(JSON.stringify(geometry));
      await tryClick(page.getByRole('button', { name: /Calcular checksum|checksum/i }));
      await page.getByTestId('zone-name').fill(zone.name);
      await page.getByTestId('zone-source_uri').fill(zone.source_uri);
      await page.getByTestId('zone-source_version').fill(zone.source_version);
      await shot(page, lang, 'zones_prepared');
      await page.getByTestId('zone-create').click();
      await shot(page, lang, 'zones_draft_created');
      await page.getByTestId('zone-association_approval_reference').fill('AHC-TEST-5');
      await page.getByTestId('zone-activate').click();
      await shot(page, lang, 'zones_activated');
    });

    test(`zone sets states ${lang}`, async ({ page }) => {
      await page.route('**/admin/configuration', (r) => json(r, { data: { configuration: config, zone_set: { ...zone, status: 'active' } } }));
      await page.goto('/?zones'); await shot(page, lang, 'zones_active_existing');
      await page.unroute('**/admin/configuration');
      await page.route('**/admin/configuration', (r) => json(r, { error: { code: 'forbidden' } }, 403));
      await page.goto('/?zones'); await shot(page, lang, 'zones_forbidden_403');
    });

    test(`duplicates ${lang}`, async ({ page }) => {
      let groups = [];
      await page.route('**/admin/duplicate-candidates', (r) => {
        const occ = new Set(groups.flatMap((g) => g.report_ids));
        return json(r, { data: { reports: dupReports.filter((x) => !occ.has(x.id)), candidates: dupEdges.filter((e) => !occ.has(e.report_a) && !occ.has(e.report_b)) } });
      });
      await page.route('**/admin/duplicate-groups**', (r) => {
        if (r.request().method() === 'GET') return json(r, { data: { duplicate_groups: groups } });
        const body = r.request().postDataJSON();
        if (r.request().url().endsWith('/reverse')) { groups = []; return json(r, { data: { duplicate_group: { status: 'reversed' } } }); }
        groups = [{ id: id(200), canonical_report_id: body.canonical_report_id, report_ids: body.report_ids, status: 'active', resolution_version: 1, resolved_at: '2026-09-30T12:00:00Z', reversed_at: null }];
        return json(r, { data: { duplicate_group: groups[0] } }, 201);
      });
      await page.goto('/?duplicates'); await shot(page, lang, 'duplicates_candidates', { settle: 800 });
      for (const n of [1, 3]) await page.getByTestId(`duplicate-select-${id(n)}`).click();
      await page.getByTestId(`duplicate-canonical-${id(1)}`).click();
      await tryClick(page.getByRole('button', { name: /Revisar selección|Review selection/ }));
      await shot(page, lang, 'duplicates_disconnected_warning');
      await page.getByTestId(`duplicate-select-${id(2)}`).click();
      await page.getByTestId(`duplicate-canonical-${id(2)}`).click();
      await page.getByTestId('duplicate-resolution-note').fill('Mismo caso');
      await page.getByTestId('duplicate-resolve').click();
      await shot(page, lang, 'duplicates_resolved_group');
      await page.getByTestId(`duplicate-reverse-${id(200)}`).click();
      await page.getByTestId('duplicate-confirm-reverse').click();
      await shot(page, lang, 'duplicates_reverse_note_required');
    });

    test(`duplicates states ${lang}`, async ({ page }) => {
      await page.route('**/admin/duplicate-groups**', (r) => json(r, { data: { duplicate_groups: [] } }));
      await page.route('**/admin/duplicate-candidates', (r) => json(r, { error: { code: 'forbidden' } }, 403));
      await page.goto('/?duplicates'); await shot(page, lang, 'duplicates_forbidden_403');
      await page.unroute('**/admin/duplicate-candidates');
      await page.route('**/admin/duplicate-candidates', (r) => json(r, { error: { code: 'internal_error' } }, 503));
      await page.goto('/?duplicates'); await shot(page, lang, 'duplicates_unavailable_503');
      await page.unroute('**/admin/duplicate-candidates');
      await page.route('**/admin/duplicate-candidates', (r) => json(r, { data: { reports: [], candidates: [] } }));
      await page.goto('/?duplicates'); await shot(page, lang, 'duplicates_empty');
    });
  });
}
