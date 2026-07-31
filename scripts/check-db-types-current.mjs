#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.join(import.meta.dirname, "..");
const TYPES_PATH = path.join(REPO_ROOT, "frontend", "src", "types", "database.types.ts");
const PROJECT_ID = "lgveqfnpkxvzbnnwuled";

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "alleato-db-types-"));
  const tempTypesPath = path.join(tempDir, "database.types.ts");

  try {
    const generated = execFileSync(
      "npx",
      ["supabase", "gen", "types", "typescript", "--project-id", PROJECT_ID, "--schema", "public"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    fs.writeFileSync(tempTypesPath, generated);

    const current = fs.readFileSync(TYPES_PATH, "utf8");
    if (current === generated) {
      console.log("database.types.ts matches the current linked Supabase schema.");
      return;
    }

    console.error("");
    console.error("ERROR: frontend/src/types/database.types.ts is stale.");
    console.error("The committed generated types do not match the current linked Supabase schema.");
    console.error("");
    console.error("Run `npm run db:types` from repo root and commit the updated file before merging.");
    console.error("");
    process.exit(1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
