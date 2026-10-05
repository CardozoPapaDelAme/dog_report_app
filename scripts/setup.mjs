// One-time local setup: .env (publishable staging config) and dependencies.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { checkEnvFile, checkNode } from "./doctor.mjs";

const ENV_TEMPLATE = `# Publishable client configuration for the staging project (safe to share).
# Never put service keys, database passwords or access tokens in this file.
EXPO_PUBLIC_API_BASE_URL=https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api
EXPO_PUBLIC_SUPABASE_URL=https://dcvihomkxkutkckmjvmp.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_hYhQAozNGqGOOmtRfAV7Qg_tw0OUzre
`;

const node = checkNode(process.version);
if (!node.ok) {
  console.error(`✗ ${node.message}\n    → ${node.hint}`);
  process.exit(1);
}
console.log(`✓ ${node.message}`);

if (!fs.existsSync(".env")) {
  fs.writeFileSync(".env", ENV_TEMPLATE, { flag: "wx" });
  console.log("✓ Creé .env con la configuración pública de staging");
} else {
  const { missing } = checkEnvFile(fs.readFileSync(".env", "utf8"));
  if (missing.length === 0) {
    console.log("✓ .env ya existe y tiene las 3 variables (no lo toqué)");
  } else {
    console.log(`! .env ya existe y no lo toqué, pero faltan: ${missing.join(", ")}`);
    console.log("    → Agrégalas (valores en README, sección Team setup).");
  }
}

if (!fs.existsSync("node_modules")) {
  console.log("\nInstalando dependencias (npm install)...");
  const r = spawnSync("npm", ["install"], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error("✗ npm install falló. Corrige el error de arriba y vuelve a correr: npm run setup");
    process.exit(1);
  }
} else {
  console.log("✓ node_modules ya instalado");
}

console.log("\nSiguiente paso: npm run app:android   (iPhone en Mac: npm run app:ios)");
console.log("Para diagnosticar tu equipo: npm run doctor");
