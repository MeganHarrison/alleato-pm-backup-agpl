import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let current = here;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, "package.json")) && fs.existsSync(path.join(current, "scripts"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(here, "../../..");
}

export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}
