// One-command local development build: doctor, then `expo run:<platform>`.
import { spawn } from "node:child_process";
import { delimiter } from "node:path";
import { printResults, runDoctorWithDefaults } from "./doctor.mjs";

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

const env = { ...process.env };
if (target === "android" && sdk && !sdk.fromEnv) {
  env.ANDROID_HOME = sdk.path;
  const tools = adbDir ?? (process.platform === "win32" ? `${sdk.path}\\platform-tools` : `${sdk.path}/platform-tools`);
  env.PATH = `${tools}${delimiter}${env.PATH ?? ""}`;
}

const args = target === "ios" ? ["expo", "run:ios", "--device"] : ["expo", "run:android"];
console.log(`\nCompilando e instalando en tu teléfono (la primera vez tarda 10-20 min)...\n`);
const child = spawn("npx", args, { stdio: "inherit", env, shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error(`No se pudo lanzar npx: ${err.message}`);
  process.exit(1);
});
