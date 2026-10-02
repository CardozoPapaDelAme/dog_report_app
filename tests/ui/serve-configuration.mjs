import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const output = await mkdtemp(join(tmpdir(), 'admin-ui-'));
await build({
  entryPoints: ['tests/ui/configuration-entry.jsx'], bundle: true, outfile: join(output,'bundle.js'),
  resolveExtensions: ['.web.js', '.js', '.jsx', '.json'],
  loader: {'.js':'jsx','.ttf':'file'}, alias: {'react-native':'react-native-web','expo-location':resolve('tests/ui/expo-location-stub.js'),'expo-constants':resolve('tests/ui/expo-constants-stub.js')}, jsx:'automatic',
  define: {'process.env.NODE_ENV':'"development"','process.env.EXPO_PUBLIC_API_BASE_URL':'"http://127.0.0.1:4174"','__DEV__':'true'},
});
const html = '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>L4 / L5 / L7 isolated test</title><style>html,body,#root{margin:0;height:100%;}*{box-sizing:border-box}</style><div id="root"></div><script src="/bundle.js"></script></html>';
// Demo-only in-memory configuration for manual previews. Fictional data; resets
// when this process stops. Playwright tests intercept these routes before they
// reach the server.
let configuration = { id:'demo-config-1',environment:'staging',version:1,is_active:true,flag_auto_hide_threshold:5,duplicate_radius_meters:150,duplicate_time_window_minutes:120,trust_high_threshold:0.8,trust_medium_threshold:0.5,gps_accuracy_max_meters:50,report_rate_limit_per_hour:10,flag_rate_limit_per_hour:30,change_note:'Configuración ficticia inicial de demostración' };
const configurationFields = ['flag_auto_hide_threshold','duplicate_radius_meters','duplicate_time_window_minutes','trust_high_threshold','trust_medium_threshold','gps_accuracy_max_meters','report_rate_limit_per_hour','flag_rate_limit_per_hour'];
const json = (res, status, payload) => {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(payload));
};
async function handleDemoConfiguration(req, res) {
  if (!/^Bearer test-session-[a-zA-Z0-9_-]+$/.test(req.headers.authorization ?? '')) return json(res, 401, {error:{code:'authentication_required'}});
  if (req.method === 'GET') return json(res, 200, {data:{configuration, zone_set:null}});
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    if (!input || configurationFields.some((key) => typeof input[key] !== 'number' || !Number.isFinite(input[key])) || typeof input.change_note !== 'string' || input.change_note.length > 1000) {
      return json(res, 400, {error:{code:'validation_failed'}});
    }
    configuration = {...configuration, ...input, id:`demo-config-${configuration.version + 1}`, version:configuration.version + 1, is_active:true};
    return json(res, 201, {data:{configuration, zone_set:null}});
  } catch {
    return json(res, 400, {error:{code:'validation_failed'}});
  }
}
const server = createServer(async (req, res) => {
  if (req.url === '/bundle.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(await readFile(join(output, 'bundle.js')));
  } else if (/^\/[a-zA-Z0-9_-]+\.ttf$/.test(req.url ?? '')) {
    res.setHeader('Content-Type', 'font/ttf');
    res.end(await readFile(join(output, req.url.slice(1))));
  } else if (req.url === '/__shutdown') {
    res.end('ok');
    setTimeout(shutdown, 0).unref();
  } else if (req.url === '/admin/configuration' && ['GET', 'POST'].includes(req.method ?? '')) {
    await handleDemoConfiguration(req, res);
  } else if (req.url?.startsWith('/admin/') || req.url?.startsWith('/association/') || req.url?.startsWith('/public/')) {
    res.writeHead(500);
    res.end('Tests must intercept API calls');
  } else {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  }
});
function shutdown() {
  server.close(() => process.exit(0));
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 500).unref();
}

server.listen(4174, '127.0.0.1', () => {
  console.log('L4 / L5 / L7 test fixture: http://127.0.0.1:4174');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, shutdown);
}
