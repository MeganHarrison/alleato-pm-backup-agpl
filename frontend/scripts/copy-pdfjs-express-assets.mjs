import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "..");
const sourceDir = resolve(
  frontendRoot,
  "node_modules",
  "@pdftron",
  "pdfjs-express-viewer",
  "public",
);
const targetDir = resolve(frontendRoot, "public", "webviewer", "lib");

if (!existsSync(sourceDir)) {
  console.warn(
    "[pdfjs-express] Source assets not found. Skipping copy because the package is not installed yet.",
  );
  process.exit(0);
}

mkdirSync(resolve(frontendRoot, "public", "webviewer"), { recursive: true });
rmSync(resolve(frontendRoot, "public", "webviewer"), {
  recursive: true,
  force: true,
});
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`[pdfjs-express] Copied viewer assets to ${targetDir}`);
