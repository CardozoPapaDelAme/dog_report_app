/**
 * Local development build launcher.
 *
 * Invoked as `npm run app:android` / `npm run app:ios` (`node scripts/app.mjs <android|ios>`).
 * Runs the doctor checks for the target, then `npx expo run:android` or
 * `npx expo run:ios --device`. Exits with code 2 on a missing/invalid target and 1 when
 * a check fails or `npx` cannot be launched; otherwise exits with the child's code.
 * For Android, when the SDK path was not taken from the environment, it sets
 * `ANDROID_HOME` and prepends `platform-tools` to `PATH` for the child process.
 *
 * @module scripts/app
 */
// One-command local development build: doctor, then `expo run:<platform>`.
import { spawn } from "node:child_process";
import { delimiter } from "node:path";
import { printResults, runDoctorWithDefaults, withDirOnPath } from "./doctor.mjs";

const target = process.argv[2];
if (target !== "android" && target !== "ios") {
  console.error("Uso: node scripts/app.mjs <android|ios>");
  process.exit(2);
}

console.log(`Revisando tu equipo para ${target === "ios" ? "iPhone" : "Android"}...\n`);
const { ok, results, sdk, adbDir } = await runDoctorWithDefaults(target);
printResults(results);
if (!ok) {
  console.log("\nCorrige lo marcado con ✗ y vuelve a correr el mismo comando.");
  process.exit(1);
}

let env = { ...process.env };
if (target === "android" && sdk && !sdk.fromEnv) {
  const tools = adbDir ?? (process.platform === "win32" ? `${sdk.path}\\platform-tools` : `${sdk.path}/platform-tools`);
  env = withDirOnPath(env, tools, delimiter);
  env.ANDROID_HOME = sdk.path;
}

const args = target === "ios" ? ["expo", "run:ios", "--device"] : ["expo", "run:android"];
console.log(`\nCompilando e instalando en tu teléfono (la primera vez tarda 10-20 min)...\n`);
const child = spawn("npx", args, { stdio: "inherit", env, shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error(`No se pudo lanzar npx: ${err.message}`);
  process.exit(1);
});
