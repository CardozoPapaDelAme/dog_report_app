// Local development build doctor (README option C).
// Pure check functions are exported for tests; command execution and file
// access are injected into runDoctor.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { pathToFileURL } from "node:url";

export const REQUIRED_ENV_KEYS = [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

const pass = (id, message) => ({ id, ok: true, message });
const fail = (id, message, hint) => ({ id, ok: false, message, hint });

/** Parse a Node version string such as "v20.11.1" into its major number. */
export function checkNode(version, minMajor = 20) {
  const major = Number.parseInt(String(version ?? "").replace(/^v/, ""), 10);
  if (Number.isFinite(major) && major >= minMajor) {
    return pass("node", `Node ${version}`);
  }
  return fail(
    "node",
    `Node ${version || "desconocido"} es muy viejo (se necesita ${minMajor} o superior)`,
    `Instala Node ${minMajor}+ desde https://nodejs.org (o con nvm) y vuelve a intentar.`,
  );
}

/** Check that an .env file's text defines every required key (values never returned). */
export function checkEnvFile(text) {
  if (typeof text !== "string") {
    return { ...fail("env", "No existe el archivo .env", "Ejecuta: npm run setup"), missing: [...REQUIRED_ENV_KEYS] };
  }
  const defined = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    if (value !== "") defined.add(match[1]);
  }
  const missing = REQUIRED_ENV_KEYS.filter((key) => !defined.has(key));
  if (missing.length === 0) return { ...pass("env", ".env con las 3 variables"), missing };
  return {
    ...fail(
      "env",
      `Faltan en .env: ${missing.join(", ")}`,
      "Agrega esas variables (valores publicables en README, sección Team setup) o borra .env y ejecuta: npm run setup",
    ),
    missing,
  };
}

/** Extract the Java major version from `java -version` output (stderr), or null. */
export function parseJavaVersion(output) {
  const match = /version "(\d+)(?:\.(\d+))?[^"]*"/.exec(String(output ?? ""));
  if (!match) return null;
  const first = Number.parseInt(match[1], 10);
  // Legacy scheme: "1.8.0_292" means Java 8.
  return first === 1 && match[2] !== undefined ? Number.parseInt(match[2], 10) : first;
}

export function checkJava(output, minMajor = 17) {
  const major = parseJavaVersion(output);
  if (major === null) {
    return fail(
      "java",
      "No se encontró Java",
      "Instala JDK 17 (Temurin): https://adoptium.net/temurin/releases/?version=17 y abre una terminal nueva.",
    );
  }
  if (major < minMajor) {
    return fail(
      "java",
      `Java ${major} es muy viejo (se necesita ${minMajor} o superior)`,
      "Instala JDK 17 (Temurin): https://adoptium.net/temurin/releases/?version=17 y abre una terminal nueva.",
    );
  }
  return pass("java", `Java ${major}`);
}

/** Parse `adb devices` output into [{ serial, state }]. */
export function parseAdbDevices(output) {
  const devices = [];
  for (const raw of String(output ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("List of devices") || line.startsWith("*")) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 2) devices.push({ serial: parts[0], state: parts[1] });
  }
  return devices;
}

export function checkAdbDevices(devices) {
  if (devices.some((d) => d.state === "device")) {
    const n = devices.filter((d) => d.state === "device").length;
    return pass("device", `${n} dispositivo(s) Android conectado(s)`);
  }
  if (devices.some((d) => d.state === "unauthorized")) {
    return fail(
      "device",
      "El teléfono está conectado pero sin autorizar",
      "Desbloquea el teléfono y acepta el aviso «¿Permitir depuración USB?».",
    );
  }
  if (devices.some((d) => d.state === "offline")) {
    return fail(
      "device",
      "El teléfono aparece offline",
      "Reconecta el cable, o apaga y vuelve a activar la depuración USB; luego corre: adb kill-server",
    );
  }
  return fail(
    "device",
    "No hay ningún teléfono Android conectado",
    "Activa Opciones de desarrollador → Depuración USB, conecta el cable y acepta el aviso en el teléfono.",
  );
}

/**
 * Locate the Android SDK folder. Environment variables win; otherwise use the
 * OS default. `fromEnv` tells the caller whether it must export ANDROID_HOME.
 */
export function resolveAndroidSdk(env, platform, homedir) {
  const fromVar = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (fromVar) return { path: fromVar, fromEnv: true };
  if (platform === "darwin") return { path: `${homedir}/Library/Android/sdk`, fromEnv: false };
  if (platform === "win32") {
    const base = env.LOCALAPPDATA || `${homedir}\\AppData\\Local`;
    return { path: `${base}\\Android\\Sdk`, fromEnv: false };
  }
  return { path: `${homedir}/Android/Sdk`, fromEnv: false };
}

export function platformToolsDir(sdkPath, platform) {
  return platform === "win32" ? `${sdkPath}\\platform-tools` : `${sdkPath}/platform-tools`;
}

/** iOS toolchain checks. `exec(cmd, args)` resolves to { code, stdout, stderr }. */
export async function checkIosTools({ platform, exec }) {
  if (platform !== "darwin") {
    return [
      fail(
        "macos",
        "Las builds de iPhone solo se pueden hacer en una Mac",
        "Sin Mac usa Expo Go (opción A del README, docs/REVIEWING.md ruta B) o pide un build de equipo (opción B).",
      ),
    ];
  }
  const tools = [
    ["xcode-select", ["-p"], "xcode-select", "Instala Xcode desde la App Store y corre: xcode-select --install"],
    ["xcodebuild", ["-version"], "Xcode", "Abre Xcode una vez y acepta la licencia (sudo xcodebuild -license accept)."],
    ["pod", ["--version"], "CocoaPods", "Instálalo con: brew install cocoapods (https://cocoapods.org)"],
  ];
  const results = [];
  for (const [cmd, args, label, hint] of tools) {
    const r = await exec(cmd, args);
    if (r.code === 0) results.push(pass(cmd, `${label} listo`));
    else results.push(fail(cmd, `${label} no disponible`, hint));
  }
  return results;
}

const combined = (r) => `${r.stdout ?? ""}\n${r.stderr ?? ""}`;

/**
 * Run every check for a target ("android" | "ios"). Returns
 * { ok, results, sdk, adbDir } where sdk/adbDir help the caller build the child env.
 */
export async function runDoctor({ target, exec, fs: fsApi, env, platform, homedir, cwd, nodeVersion }) {
  const results = [checkNode(nodeVersion)];
  results.push(
    fsApi.existsSync(`${cwd}/node_modules`)
      ? pass("deps", "node_modules instalado")
      : fail("deps", "Faltan las dependencias", "Ejecuta: npm run setup (o npm install)"),
  );
  let envText;
  try {
    envText = fsApi.readFileSync(`${cwd}/.env`, "utf8");
  } catch {
    envText = undefined;
  }
  results.push(checkEnvFile(envText));

  let sdk = null;
  let adbDir = null;
  if (target === "ios") {
    results.push(...(await checkIosTools({ platform, exec })));
  } else {
    const java = await exec("java", ["-version"]);
    results.push(checkJava(java.code === null ? "" : combined(java)));

    sdk = resolveAndroidSdk(env, platform, homedir);
    if (fsApi.existsSync(sdk.path)) {
      results.push(pass("sdk", `Android SDK en ${sdk.path}`));
    } else {
      results.push(
        fail(
          "sdk",
          `No se encontró el Android SDK (buscado en ${sdk.path})`,
          "Instala Android Studio (https://developer.android.com/studio), ábrelo una vez para bajar el SDK; o define ANDROID_HOME con su ruta.",
        ),
      );
    }

    let adbCmd = "adb";
    let adbVersion = await exec("adb", ["version"]);
    if (adbVersion.code !== 0) {
      const dir = platformToolsDir(sdk.path, platform);
      const candidate = `${dir}${platform === "win32" ? "\\adb.exe" : "/adb"}`;
      if (fsApi.existsSync(candidate)) {
        adbCmd = candidate;
        adbDir = dir;
        adbVersion = await exec(adbCmd, ["version"]);
      }
    }
    if (adbVersion.code === 0) {
      results.push(pass("adb", "adb disponible"));
      const list = await exec(adbCmd, ["devices"]);
      results.push(checkAdbDevices(parseAdbDevices(list.stdout)));
    } else {
      results.push(
        fail(
          "adb",
          "No se encontró adb",
          "Instala «Android SDK Platform-Tools» desde Android Studio (SDK Manager → SDK Tools) y revisa ANDROID_HOME.",
        ),
      );
    }
  }
  return { ok: results.every((r) => r.ok), results, sdk, adbDir };
}

export function defaultExec(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" && cmd === "npx" });
  if (r.error) return { code: null, stdout: "", stderr: String(r.error.message) };
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

export function printResults(results, log = console.log) {
  for (const r of results) {
    log(`${r.ok ? "✓" : "✗"} ${r.message}`);
    if (!r.ok && r.hint) log(`    → ${r.hint}`);
  }
}

export function runDoctorWithDefaults(target) {
  return runDoctor({
    target,
    exec: async (cmd, args) => defaultExec(cmd, args),
    fs,
    env: process.env,
    platform: process.platform,
    homedir: os.homedir(),
    cwd: process.cwd(),
    nodeVersion: process.version,
  });
}

const isMain = typeof process !== "undefined" && process.argv?.[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const target = process.argv[2] === "ios" ? "ios" : "android";
  console.log(`Revisando tu equipo para ${target === "ios" ? "iPhone" : "Android"}...\n`);
  const { ok, results } = await runDoctorWithDefaults(target);
  printResults(results);
  console.log(ok ? "\nTodo listo." : "\nCorrige lo marcado con ✗ y vuelve a correr: npm run doctor" + (target === "ios" ? " -- ios" : ""));
  process.exit(ok ? 0 : 1);
}
