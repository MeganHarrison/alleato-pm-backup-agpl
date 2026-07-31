import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function buildDevTsconfig(base, distDir) {
  if (!/^\.next-dev-[0-9]+$/.test(distDir)) {
    throw new Error(
      `[frontend-dev] Refusing unsafe dev dist directory "${distDir}"; expected .next-dev-<port>.`,
    );
  }
  const include = (base.include ?? []).filter((entry) => !entry.startsWith(".next-dev-"));
  include.push(`${distDir}/types/**/*.ts`);
  return {
    extends: "./tsconfig.json",
    include,
    exclude: base.exclude ?? [],
  };
}

export function writeDevTsconfig(basePath, devPath, distDir) {
  const base = JSON.parse(readFileSync(basePath, "utf8"));
  const config = buildDevTsconfig(base, distDir);
  writeFileSync(devPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [basePath, devPath, distDir] = process.argv.slice(2);
  if (!basePath || !devPath || !distDir) {
    throw new Error("Usage: write-dev-tsconfig.mjs <base-tsconfig> <dev-tsconfig> <dist-dir>");
  }
  writeDevTsconfig(basePath, devPath, distDir);
}
