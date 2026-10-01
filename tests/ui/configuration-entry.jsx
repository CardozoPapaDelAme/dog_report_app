// Isolated UI test entry. This file is never imported by index.js or App.js.
import React, { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../../i18n/index.js';
import DuplicateManagementScreen from '../../screens/DuplicateManagementScreen.js';
import ZoneSetScreen from '../../screens/ZoneSetScreen.js';
import ConfigurationScreen from '../../screens/ConfigurationScreen.js';
import ReportFormScreen from '../../screens/ReportFormScreen.js';
import AssociationDashboardScreen from '../../screens/associationDashboardScreen.js';
import { buildReportPayload } from '../../models/reportPayload.js';
import regular from '@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf';
import bold from '@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf';

const fonts = document.createElement('style');
fonts.textContent = `@font-face{font-family:PlusJakartaSans_400Regular;src:url(${regular})} @font-face{font-family:PlusJakartaSans_700Bold;src:url(${bold})}`;
document.head.appendChild(fonts);

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
  photo_file_uri: new URLSearchParams(location.search).has('photo') ? 'file:///private/report.jpg' : null,
  photo_validation: { dogProbability: 0.91, blurVariance: 200 },
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

function Fixture() {
  const params = new URLSearchParams(location.search);
  if (params.has('association-preview')) return <div style={{height:'100dvh'}}>
    <SafeAreaProvider><AssociationDashboardScreen accessToken="preview-session" displayName="Vista de demostración"
      onLogout={() => { window.location.href = 'http://localhost:8081/'; }} getPage={previewAssociationPage} /></SafeAreaProvider>
  </div>;
  const Screen = params.has('report')
    ? ReportFixture
    : params.has('association') || params.has('association-preview')
      ? AssociationDashboardScreen
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
      {...(params.has('association-preview') ? { getPage: previewAssociationPage, displayName: 'Vista de demostración' } : {})} /> : <p>Formulario cerrado</p>}</SafeAreaProvider>
  </div>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture /></StrictMode>);
