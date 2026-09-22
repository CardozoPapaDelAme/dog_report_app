import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const output = await mkdtemp(join(tmpdir(), 'fab4-ui-'));
await build({
  entryPoints: ['tests/ui/configuration-entry.jsx'], bundle: true, outfile: join(output,'bundle.js'),
  resolveExtensions: ['.web.js', '.js', '.jsx', '.json'],
  loader: {'.js':'jsx','.ttf':'file'}, alias: {'react-native':'react-native-web'}, jsx:'automatic',
  define: {'process.env.NODE_ENV':'"development"','process.env.EXPO_PUBLIC_API_BASE_URL':'"http://127.0.0.1:4174"','__DEV__':'true'},
});
const html = '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>L4 isolated test</title><style>html,body,#root{margin:0;height:100%;}*{box-sizing:border-box}</style><div id="root"></div><script src="/bundle.js"></script></html>';
createServer(async(req,res)=>{
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(join(output,'bundle.js')));}
  else if(/^\/[a-zA-Z0-9_-]+\.ttf$/.test(req.url ?? '')) {res.setHeader('Content-Type','font/ttf');res.end(await readFile(join(output,req.url.slice(1))));}
  else if(req.url?.startsWith('/admin/')) {res.writeHead(500);res.end('Tests must intercept API calls');}
  else {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}
}).listen(4174,'127.0.0.1',()=>console.log('L4 test fixture: http://127.0.0.1:4174'));
