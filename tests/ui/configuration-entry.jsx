// Isolated UI test entry. This file is never imported by index.js or App.js.
import React, { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from '../../i18n/index.js';
import DraftQueueBanner from '../../components/DraftQueueBanner.js';
import DuplicateManagementScreen from '../../screens/DuplicateManagementScreen.js';
import ZoneSetScreen from '../../screens/ZoneSetScreen.js';
import ConfigurationScreen from '../../screens/ConfigurationScreen.js';
import PublicMapScreen from '../../screens/PublicMapScreen.js';
import CommandCenterScreen from '../../screens/CommandCenterScreen.js';
import CameraScreen from '../../screens/CameraScreen.js';
// Device map component (MapLibre is aliased to tests/ui/maplibre-stub.js) to measure cluster size.
import NativePublicMapView from '../../components/PublicMapView.js';
import ReportFormScreen from '../../screens/ReportFormScreen.js';
import AssociationDashboardScreen from '../../screens/associationDashboardScreen.js';
import AdminDataExportScreen from '../../screens/AdminDataExportScreen.js';
import LoginScreen from '../../screens/loginScreen.js';
import { summarizeReportDraftQueue } from '../../models/reportDraft.js';
import { buildReportPayload } from '../../models/reportPayload.js';
import regular from '@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf';
import bold from '@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf';
import semibold from '@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf';
import workMedium from '@expo-google-fonts/work-sans/500Medium/WorkSans_500Medium.ttf';
import workSemibold from '@expo-google-fonts/work-sans/600SemiBold/WorkSans_600SemiBold.ttf';
import workBold from '@expo-google-fonts/work-sans/700Bold/WorkSans_700Bold.ttf';
import fredokaMedium from '@expo-google-fonts/fredoka/500Medium/Fredoka_500Medium.ttf';
import fredokaSemibold from '@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf';
import UiKitFixture from './ui-kit-fixture.jsx';

if (new URLSearchParams(location.search).has('association-preview')) i18n.changeLanguage('es');

const fonts = document.createElement('style');
fonts.textContent = `@font-face{font-family:PlusJakartaSans_400Regular;src:url(${regular})} @font-face{font-family:PlusJakartaSans_700Bold;src:url(${bold})} @font-face{font-family:PlusJakartaSans_600SemiBold;src:url(${semibold})} @font-face{font-family:WorkSans_500Medium;src:url(${workMedium})} @font-face{font-family:WorkSans_600SemiBold;src:url(${workSemibold})} @font-face{font-family:WorkSans_700Bold;src:url(${workBold})} @font-face{font-family:Fredoka_500Medium;src:url(${fredokaMedium})} @font-face{font-family:Fredoka_600SemiBold;src:url(${fredokaSemibold})}`;
document.head.appendChild(fonts);

// `?report&photo=sample` loads this picture so the preview and full-photo viewer can be seen on the web fixture.
const sampleDogPhoto = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9a441'; ctx.fillRect(0, 0, 480, 640);
  ctx.fillStyle = '#6b4226'; ctx.beginPath(); ctx.arc(240, 260, 150, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(190, 230, 22, 0, Math.PI * 2); ctx.arc(290, 230, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(240, 320, 46, 32, 0, 0, Math.PI * 2); ctx.fill();
  return canvas.toDataURL('image/png');
})();

const previewReport = (id, incident, sighting, details, color, size, collar, acceptedAt) => ({
  id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  location: { longitude: Number((-106.0802 - id * 0.004).toFixed(4)), latitude: Number((28.6304 + id * 0.003).toFixed(4)) },
  incident_type: incident,
  sighting_type: sighting,
  details,
  dog: { predominant_color: color, size, has_collar: collar },
  has_sanitized_photo: id !== 2,
  occurred_at: '2026-09-27T14:30:00.000Z',
  accepted_at: acceptedAt,
});
const previewRows = [
  previewReport(1, 'avistamiento_simple', 'solitario', { cantidad_aprox: 1 }, 'café', 'mediano', false, '2026-09-30T10:15:00.000Z'),
  previewReport(2, 'perro_lastimado', 'solitario', { descripcion: 'Cerca de la plaza' }, 'blanco', 'chico', null, '2026-09-29T18:42:00.000Z'),
  previewReport(3, 'ataque_mascota', 'manada', { cantidad_aprox: 3 }, 'negro', 'grande', true, '2026-09-28T09:20:00.000Z'),
];
async function previewAssociationPage({ from, to }) {
  return { items: previewRows.filter((row) => row.accepted_at >= from && row.accepted_at <= to), next_cursor: null };
}

const reportDraft = {
  id: '00000000-0000-4000-8000-000000000006',
  local_state: 'draft',
  created_at: '2026-09-28T20:01:00.000Z',
  updated_at: '2026-09-28T20:01:00.000Z',
  queued_at: null,
  payload_json: null,
  photo_file_uri: new URLSearchParams(location.search).has('photo') ? (new URLSearchParams(location.search).get('photo') === 'sample' ? sampleDogPhoto : 'file:///private/report.jpg') : null,
  photo_validation: {
    dogProbability: 0.91,
    blurVariance: 200,
    ...(new URLSearchParams(location.search).has('color') ? { dog_color: { color: 'negro', confidence: 0.9 } } : {}),
  },
  location_snapshot: {
    longitude: -107.63,
    latitude: 27.75,
    accuracy_meters: 12.5,
    mock_suspected: false,
    captured_at: '2026-09-28T20:00:00.000Z',
  },
  client_created_at: '2026-09-28T20:00:00.000Z',
  retry_count: 0,
  next_retry_at: null,
  last_error: null,
  receipt: null,
  photo_status: null,
};

function ReportFixture() {
  const [draft, setDraft] = useState(reportDraft);
  const draftRef = useRef(reportDraft);
  function commit(next) {
    draftRef.current = next;
    setDraft(next);
    return next;
  }
  async function queueDraft(id, options) {
    const current = draftRef.current;
    const payload = buildReportPayload({
      draft: current,
      reportFields: options.reportFields,
      deviceFingerprint: options.deviceFingerprint,
      honeypotFilled: options.honeypotFilled,
    });
    return commit({
      ...current,
      local_state: 'queued',
      updated_at: '2026-09-28T20:02:00.000Z',
      queued_at: '2026-09-28T20:02:00.000Z',
      payload_json: JSON.stringify(payload),
      last_error: null,
    });
  }
  async function syncDraft() {
    const current = draftRef.current;
    if (current.local_state === 'synced') return current;
    const payload = JSON.parse(current.payload_json);
    const response = await fetch('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const failed = {
        ...current,
        local_state: response.status >= 500 || response.status === 429 ? 'retry_wait' : 'terminal_error',
        last_error: {
          code: body?.error?.code ?? 'request_failed',
          message: body?.error?.message ?? 'Request failed',
          status: response.status,
          request_id: body?.error?.request_id ?? null,
        },
      };
      return commit(failed);
    }
    const accepted = {
      ...current,
      local_state: payload.photo.expected ? 'awaiting_processing' : 'synced',
      updated_at: '2026-09-28T20:03:00.000Z',
      receipt: body.data,
      last_error: null,
      photo_status: payload.photo.expected
        ? {
          report_id: payload.id,
          photo_expected: true,
          state: 'processing',
          rejection_code: null,
          processing_complete: false,
          upload_succeeded: false,
          local_cleanup_allowed: false,
        }
        : null,
    };
    return commit(accepted);
  }
  return <ReportFormScreen
    draft={draft}
    loading={false}
    error={null}
    queueDraft={queueDraft}
    syncDraft={syncDraft}
    onBackToCamera={() => {}}
    submitDependencies={{getDeviceFingerprint: async () => '  raw-device-fingerprint-001  '}}
  />;
}

function OfflineQueueFixture() {
  const params = new URLSearchParams(location.search);
  const initialDraft = params.has('terminal')
    ? {
      ...reportDraft,
      local_state: 'terminal_error',
      last_error: { code: 'invalid_coordinates', status: 400, message: 'outside geofence' },
    }
    : reportDraft;
  const [screen, setScreen] = useState(params.has('terminal') ? 'camera' : 'form');
  const [draft, setDraft] = useState(initialDraft);
  const [syncing, setSyncing] = useState(false);
  const [syncedNotice, setSyncedNotice] = useState(false);
  const draftRef = useRef(initialDraft);
  const syncingRef = useRef(false);
  const now = new Date('2026-09-28T20:05:00.000Z');
  const summary = useMemo(
    () => summarizeReportDraftQueue([draft], { now, isSyncing: syncing }),
    [draft, syncing],
  );

  function commit(next) {
    draftRef.current = next;
    setDraft(next);
    return next;
  }

  async function queueDraft(id, options) {
    const current = draftRef.current;
    const payload = buildReportPayload({
      draft: current,
      reportFields: options.reportFields,
      deviceFingerprint: options.deviceFingerprint,
      honeypotFilled: options.honeypotFilled,
    });
    setSyncedNotice(false);
    return commit({
      ...current,
      local_state: 'queued',
      updated_at: '2026-09-28T20:02:00.000Z',
      queued_at: '2026-09-28T20:02:00.000Z',
      payload_json: JSON.stringify(payload),
      next_retry_at: null,
      last_error: null,
    });
  }

  async function syncDraft() {
    const current = draftRef.current;
    if (current.local_state === 'synced' || current.local_state === 'terminal_error') return current;
    const payload = JSON.parse(current.payload_json);
    const response = await fetch('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return commit({
        ...current,
        local_state: response.status >= 500 || response.status === 429 ? 'retry_wait' : 'terminal_error',
        next_retry_at: null,
        last_error: {
          code: body?.error?.code ?? 'request_failed',
          message: body?.error?.message ?? 'Request failed',
          status: response.status,
          request_id: body?.error?.request_id ?? null,
        },
      });
    }
    const accepted = commit({
      ...current,
      local_state: 'synced',
      updated_at: '2026-09-28T20:03:00.000Z',
      receipt: body.data,
      next_retry_at: null,
      last_error: null,
      photo_status: null,
    });
    setSyncedNotice(true);
    return accepted;
  }

  async function syncDueDrafts() {
    if (syncingRef.current) return [];
    if (!summarizeReportDraftQueue([draftRef.current], { now }).canRetryNow) return [];
    syncingRef.current = true;
    setSyncing(true);
    try {
      return [await syncDraft()];
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  if (screen === 'camera') {
    return <div style={{ minHeight: '100%', background: '#101510', padding: 16, paddingTop: 80 }}>
      <DraftQueueBanner
        summary={summary}
        synced={syncedNotice}
        onRetry={() => { void syncDueDrafts(); }}
      />
    </div>;
  }

  return <ReportFormScreen
    draft={draft}
    loading={false}
    error={null}
    queueDraft={queueDraft}
    syncDraft={syncDraft}
    onBackToCamera={() => setScreen('camera')}
    submitDependencies={{getDeviceFingerprint: async () => '  raw-device-fingerprint-001  '}}
  />;
}

function LoginFixture() {
  const params = new URLSearchParams(location.search);
  const [screen, setScreen] = useState('login');
  if (screen === 'camera') return <p>Cámara de prueba</p>;
  return <LoginScreen
    loading={params.has('loading')}
    pending={params.has('pending')}
    error={null}
    onLogin={async () => {}}
    onBack={params.has('no-back') ? undefined : () => setScreen('camera')}
  />;
}

function CameraFixture() {
  const [screen, setScreen] = useState('camera');
  if (screen === 'report') return <ReportFixture />;
  return <CameraScreen
    onOpenLogin={() => {}}
    onOpenMap={() => {}}
    onReportWithoutPhoto={() => setScreen('report')}
    onPhotoAccepted={() => setScreen('report')}
  />;
}

// RF12: one cluster per synthetic report_count, rendered by the device map component.
const nativeClusterCounts = [1, 2, 7, 100, 1000, 5000];
function NativeClusterFixture() {
  const clusters = nativeClusterCounts.map((count) => ({
    cluster_id: `count-${count}`,
    report_count: count,
    approximate_location: { longitude: -107.6355, latitude: 27.7522 },
    highest_severity: 'avistamiento_simple',
    type_counts: { avistamiento_simple: count, ataque_mascota: 0, ataque_ganado: 0, ataque_humano: 0, perro_lastimado: 0, otro: 0 },
  }));
  return <NativePublicMapView mode="clusters" clusters={clusters} reports={[]}
    initialCenter={{ longitude: -107.6355, latitude: 27.7522 }} initialZoom={13} />;
}

// `?native-map-pins` renders the device pin marker for each severity (and a flagged one) for visual review.
function NativePinFixture() {
  const incidents = ['ataque_humano', 'ataque_ganado', 'ataque_mascota', 'perro_lastimado', 'otro', 'avistamiento_simple'];
  const reports = incidents.map((incident, index) => ({
    report_id: `pin-${incident}`,
    approximate_location: { longitude: -107.6355 + index * 0.001, latitude: 27.7522 },
    incident_type: incident, sighting_type: 'solitario', details: {}, dog: { predominant_color: null, size: null, has_collar: null },
    has_sanitized_photo: false, occurred_at: '2026-09-27T14:30:00.000Z', has_flags: index % 3 === 0,
  }));
  return <NativePublicMapView mode="pins" clusters={[]} reports={reports}
    initialCenter={{ longitude: -107.6355, latitude: 27.7522 }} initialZoom={17} />;
}

function Fixture() {
  const params = new URLSearchParams(location.search);
  if (params.has('native-map-pins')) return <div style={{height:'100dvh',overflow:'auto'}}><NativePinFixture /></div>;
  if (params.has('ui-kit')) return <UiKitFixture />;
  if (params.has('native-map-clusters')) return <div style={{height:'100dvh',overflow:'auto'}}><NativeClusterFixture /></div>;
  if (params.has('camera')) return <div style={{height:'100dvh',display:'flex'}}>
    <SafeAreaProvider style={{flex:1}}><CameraFixture /></SafeAreaProvider>
  </div>;
  if (params.has('login')) return <div style={{height:'100dvh'}}>
    <SafeAreaProvider><LoginFixture /></SafeAreaProvider>
  </div>;
  if (params.has('offline-queue')) return <div style={{height:'100dvh'}}>
    <SafeAreaProvider><OfflineQueueFixture /></SafeAreaProvider>
  </div>;
  if (params.has('map')) return <div style={{height:'100dvh',display:'flex'}}>
    <SafeAreaProvider><PublicMapScreen onBack={() => {}} mapAvailable={params.has('expo-go') ? false : undefined} /></SafeAreaProvider>
  </div>;
  if (params.has('association-preview')) return <div style={{height:'100dvh'}}>
    <SafeAreaProvider><AssociationDashboardScreen accessToken="preview-session" displayName="Vista de demostración"
      onLogout={() => { window.location.href = 'http://localhost:8081/'; }} getPage={previewAssociationPage} /></SafeAreaProvider>
  </div>;
  const Screen = params.has('report')
    ? ReportFixture
    : params.has('association') || params.has('association-preview')
      ? AssociationDashboardScreen
    : params.has('admin-export')
      ? AdminDataExportScreen
    : params.has('command-center')
      ? CommandCenterScreen
    : params.has('duplicates')
      ? DuplicateManagementScreen
      : params.has('zones')
        ? ZoneSetScreen
        : ConfigurationScreen;

  const [token, setToken] = useState(params.has('no-session') ? null : 'test-session-a');
  const [visible, setVisible] = useState(true);
  return <div style={{height:'100dvh',display:'flex',flexDirection:'column'}}>
    <aside role="note" style={{padding:'8px 12px',background:'#fff3cd',color:'#493b08',font:'13px sans-serif',borderBottom:'1px solid #e2cf83'}}>
      Demo local: todos los datos son ficticios. Los cambios son temporales y solo se guardan en memoria; se restablecen al reiniciar el proceso de demostración. No se usa ningún backend ni base de datos real.
    </aside>
    <div style={{display:'flex',gap:8,padding:4,background:'#eee',font:'11px sans-serif'}}>
      <button onClick={()=>setToken(null)}>Cerrar sesión de prueba</button>
      <button onClick={()=>setToken('test-session-b')}>Otra sesión de prueba</button>
      <button onClick={()=>setVisible(true)}>Abrir formulario de prueba</button>
    </div>
    <SafeAreaProvider>{visible ? <Screen accessToken={token} onBack={()=>setVisible(false)} onLogout={()=>setToken(null)}
      {...(params.has('tools') ? { onOpenDuplicates: () => {}, onOpenZoneSets: () => {}, onOpenConfiguration: () => {}, onOpenDataExport: () => {} } : {})}
      {...(params.has('association-preview') ? { getPage: previewAssociationPage, displayName: 'Vista de demostración' } : {})} /> : <p>Formulario cerrado</p>}</SafeAreaProvider>
  </div>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture /></StrictMode>);
