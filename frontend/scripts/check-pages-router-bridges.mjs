import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "src/pages/_app.tsx",
  "src/pages/_document.tsx",
];

const missing = requiredFiles.filter((relativePath) => !existsSync(path.join(frontendRoot, relativePath)));

if (missing.length > 0) {
  console.error("[build] Missing required Pages Router bridge files.");
  console.error(
    "[build] This app builds primarily through the App Router, but production page-data collection can still require /_app and /_document modules.",
  );
  console.error(missing.map((relativePath) => `- ${relativePath}`).join("\n"));
  process.exit(1);
}

console.log(`[build] Pages Router bridge files are present (${requiredFiles.length} files)`);
