import {
  checkAdbDevices,
  checkEnvFile,
  checkIosTools,
  checkJava,
  checkNode,
  parseAdbDevices,
  parseJavaVersion,
  resolveAndroidSdk,
  runDoctor,
  withDirOnPath,
} from './doctor.mjs';

function eq(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message} expected ${b}, got ${a}`);
}

Deno.test('parseJavaVersion reads Temurin/OpenJDK 17 and 21', () => {
  eq(parseJavaVersion('openjdk version "17.0.9" 2023-10-17\nOpenJDK Runtime Environment Temurin-17.0.9+9 (build 17.0.9+9)'), 17);
  eq(parseJavaVersion('openjdk version "21" 2023-09-19\nOpenJDK Runtime Environment (build 21+35)'), 21);
  eq(parseJavaVersion('openjdk version "21.0.2" 2024-01-16 LTS'), 21);
});

Deno.test('parseJavaVersion reads old Java 11 and legacy 1.8', () => {
  eq(parseJavaVersion('openjdk version "11.0.21" 2023-10-17'), 11);
  eq(parseJavaVersion('java version "1.8.0_292"'), 8);
});

Deno.test('parseJavaVersion returns null for garbage', () => {
  eq(parseJavaVersion(''), null);
  eq(parseJavaVersion('bash: java: command not found'), null);
  eq(parseJavaVersion(undefined), null);
});

Deno.test('checkJava enforces 17+', () => {
  eq(checkJava('openjdk version "17.0.9"').ok, true);
  eq(checkJava('openjdk version "11.0.21"').ok, false);
  eq(checkJava('').ok, false);
});

Deno.test('parseAdbDevices handles device, unauthorized, offline and empty', () => {
  const ok = 'List of devices attached\nR58M123ABC\tdevice\n\n';
  eq(parseAdbDevices(ok), [{ serial: 'R58M123ABC', state: 'device' }]);
  eq(parseAdbDevices('List of devices attached\nABC\tunauthorized\n')[0].state, 'unauthorized');
  eq(parseAdbDevices('List of devices attached\nABC\toffline\n')[0].state, 'offline');
  eq(parseAdbDevices('List of devices attached\n\n'), []);
  eq(parseAdbDevices('* daemon not running; starting now\n* daemon started successfully\nList of devices attached\nABC\tdevice\n').length, 1);
  eq(parseAdbDevices(''), []);
});

Deno.test('checkAdbDevices explains each state', () => {
  eq(checkAdbDevices([{ serial: 'a', state: 'device' }]).ok, true);
  const unauthorized = checkAdbDevices([{ serial: 'a', state: 'unauthorized' }]);
  eq(unauthorized.ok, false);
  eq(unauthorized.hint.includes('acepta'), true);
  eq(checkAdbDevices([{ serial: 'a', state: 'offline' }]).ok, false);
  eq(checkAdbDevices([]).hint.includes('Depuración USB'), true);
  // unauthorized + a good device still passes
  eq(checkAdbDevices([{ serial: 'a', state: 'unauthorized' }, { serial: 'b', state: 'device' }]).ok, true);
});

Deno.test('checkEnvFile handles complete, commented and missing keys', () => {
  const full = [
    '# staging',
    'EXPO_PUBLIC_API_BASE_URL=https://x/functions/v1/api',
    'EXPO_PUBLIC_SUPABASE_URL="https://x"',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_abc',
  ].join('\n');
  const full_r = checkEnvFile(full);
  eq(full_r.ok, true);
  eq(full_r.missing, []);

  const partial = checkEnvFile('EXPO_PUBLIC_API_BASE_URL=a\r\n# EXPO_PUBLIC_SUPABASE_URL=commented\r\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\r\n');
  eq(partial.ok, false);
  eq(partial.missing, ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']);

  eq(checkEnvFile('').missing.length, 3);
  eq(checkEnvFile(undefined).ok, false);
});

Deno.test('checkEnvFile never returns values', () => {
  const r = checkEnvFile('EXPO_PUBLIC_API_BASE_URL=secret-value-123');
  eq(JSON.stringify(r).includes('secret-value-123'), false);
});

Deno.test('checkNode requires 20+', () => {
  eq(checkNode('v20.0.0').ok, true);
  eq(checkNode('v24.1.0').ok, true);
  eq(checkNode('v18.19.0').ok, false);
  eq(checkNode(undefined).ok, false);
});

Deno.test('resolveAndroidSdk prefers env, then OS defaults', () => {
  eq(resolveAndroidSdk({ ANDROID_HOME: '/opt/sdk' }, 'linux', '/home/u'), { path: '/opt/sdk', fromEnv: true });
  eq(resolveAndroidSdk({ ANDROID_SDK_ROOT: '/opt/root' }, 'darwin', '/Users/u'), { path: '/opt/root', fromEnv: true });
  eq(resolveAndroidSdk({}, 'darwin', '/Users/u'), { path: '/Users/u/Library/Android/sdk', fromEnv: false });
  eq(resolveAndroidSdk({}, 'linux', '/home/u'), { path: '/home/u/Android/Sdk', fromEnv: false });
  eq(
    resolveAndroidSdk({ LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' }, 'win32', 'C:\\Users\\u'),
    { path: 'C:\\Users\\u\\AppData\\Local\\Android\\Sdk', fromEnv: false },
  );
  eq(resolveAndroidSdk({}, 'win32', 'C:\\Users\\u').path, 'C:\\Users\\u\\AppData\\Local\\Android\\Sdk');
});

Deno.test('checkIosTools needs a Mac and each tool', async () => {
  const linux = await checkIosTools({ platform: 'linux', exec: () => { throw new Error('should not run'); } });
  eq(linux.length, 1);
  eq(linux[0].ok, false);

  const allOk = await checkIosTools({ platform: 'darwin', exec: async () => ({ code: 0, stdout: '', stderr: '' }) });
  eq(allOk.every((r) => r.ok), true);

  const noPod = await checkIosTools({
    platform: 'darwin',
    exec: async (cmd) => ({ code: cmd === 'pod' ? 127 : 0, stdout: '', stderr: '' }),
  });
  eq(noPod.filter((r) => !r.ok).map((r) => r.id), ['pod']);
});

Deno.test('runDoctor android passes with injected tools', async () => {
  const exec = async (cmd, args) => {
    if (cmd === 'java') return { code: 0, stdout: '', stderr: 'openjdk version "17.0.9"' };
    if (cmd === 'adb' && args[0] === 'version') return { code: 0, stdout: 'ok', stderr: '' };
    if (cmd === 'adb') return { code: 0, stdout: 'List of devices attached\nA\tdevice\n', stderr: '' };
    return { code: 1, stdout: '', stderr: '' };
  };
  const fsApi = {
    existsSync: () => true,
    readFileSync: () => 'EXPO_PUBLIC_API_BASE_URL=a\nEXPO_PUBLIC_SUPABASE_URL=b\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=c\n',
  };
  const r = await runDoctor({
    target: 'android', exec, fs: fsApi, env: {}, platform: 'linux', homedir: '/home/u', cwd: '/app', nodeVersion: 'v22.0.0',
  });
  eq(r.ok, true);
  eq(r.sdk.fromEnv, false);
});

Deno.test('runDoctor android reports everything missing without throwing', async () => {
  const exec = async () => ({ code: null, stdout: '', stderr: 'ENOENT' });
  const fsApi = { existsSync: () => false, readFileSync: () => { throw new Error('nope'); } };
  const r = await runDoctor({
    target: 'android', exec, fs: fsApi, env: {}, platform: 'linux', homedir: '/home/u', cwd: '/app', nodeVersion: 'v18.0.0',
  });
  eq(r.ok, false);
  eq(r.results.filter((x) => !x.ok).map((x) => x.id), ['node', 'deps', 'env', 'java', 'sdk', 'adb']);
});

Deno.test('withDirOnPath keeps the Windows "Path" key and prepends the tools dir', () => {
  const env = withDirOnPath({ Path: 'C:\\Windows;C:\\nodejs', OTHER: '1' }, 'C:\\sdk\\platform-tools', ';');
  const pathKeys = Object.keys(env).filter((k) => k.toUpperCase() === 'PATH');
  if (pathKeys.length !== 1 || pathKeys[0] !== 'Path') throw new Error(JSON.stringify(pathKeys));
  if (env.Path !== 'C:\\sdk\\platform-tools;C:\\Windows;C:\\nodejs') throw new Error(env.Path);
  if (env.OTHER !== '1') throw new Error('lost other keys');
});

Deno.test('withDirOnPath works with a POSIX PATH and with no path at all', () => {
  const posix = withDirOnPath({ PATH: '/usr/bin' }, '/sdk/platform-tools', ':');
  if (posix.PATH !== '/sdk/platform-tools:/usr/bin') throw new Error(posix.PATH);
  const empty = withDirOnPath({}, '/sdk/platform-tools', ':');
  if (empty.PATH !== '/sdk/platform-tools') throw new Error(empty.PATH);
});
