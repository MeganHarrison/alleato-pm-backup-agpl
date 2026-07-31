import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let current = here;
  while (current !== path.dirname(current)) {
    if (
      fs.existsSync(path.join(current, "package.json")) &&
      fs.existsSync(path.join(current, "scripts")) &&
      fs.existsSync(path.join(current, "docs", "architecture")) &&
      fs.existsSync(path.join(current, "frontend"))
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  throw new Error(
    "Docs freshness repository root not found: expected package.json, scripts/, docs/architecture/, and frontend/ in one ancestor.",
  );
}

export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}
