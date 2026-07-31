#!/usr/bin/env node

/**
 * Bridge a verified Alleato PM tutorial packet into the canonical Alleato docs
 * repository. The docs repo owns final MDX, navigation, and deployment; this
 * command deliberately reuses its promotion script instead of creating a
 * parallel docs renderer in project-management.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const DEFAULT_DOCS_ROOT = "/Users/meganharrison/Documents/alleato-os";
const args = process.argv.slice(2);

function take(flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return args[index + 1];
}

function optional(flag, fallback) {
  return args.includes(flag) ? take(flag) : fallback;
}

function help() {
  console.log(`Usage:
  node scripts/tutorials/promote-to-alleato-docs-site.mjs <manifest.json> \\
    --title "Create a Prime Contract" \\
    --description "..." \\
    --module prime-contracts \\
    --image-slug create-a-prime-contract \\
    --route "/[projectId]/prime-contracts/new" [--docs-root <path>] [--out <path>] [--force]

This creates a docs-repository MDX draft and copies verified screenshots into
the docs site's canonical image tree. The Alleato docs repo owns the editorial
review, visibility change, navigation check, commit, and deployment proof.`);
}

if (args.includes("--help") || args.includes("-h")) {
  help();
  process.exit(0);
}

const manifest = args.find((value) => !value.startsWith("--") && value.endsWith(".json"));
if (!manifest) {
  help();
  process.exit(1);
}

try {
  const manifestPath = resolve(manifest);
  const docsRoot = resolve(optional("--docs-root", process.env.ALLEATO_DOCS_ROOT || DEFAULT_DOCS_ROOT));
  const title = take("--title");
  const description = take("--description");
  const moduleName = take("--module");
  const imageSlug = take("--image-slug");
  const route = take("--route");
  const promotionScript = resolve(docsRoot, "apps/docs/scripts/promote-training-doc.mjs");
  const output = resolve(
    optional("--out", `${docsRoot}/apps/docs/${moduleName}/${imageSlug}.mdx`),
  );

  if (!existsSync(manifestPath)) {
    throw new Error(`Tutorial manifest was not found: ${manifestPath}`);
  }
  if (!existsSync(promotionScript)) {
    throw new Error(
      `Alleato docs promotion script was not found: ${promotionScript}. Set --docs-root or ALLEATO_DOCS_ROOT to the canonical alleato-os checkout.`,
    );
  }
  if (!output.startsWith(`${docsRoot}/apps/docs/`)) {
    throw new Error(`Docs output must stay under ${docsRoot}/apps/docs: ${output}`);
  }

  const commandArgs = [
    promotionScript,
    "--manifest", manifestPath,
    "--out", output,
    "--title", title,
    "--description", description,
    "--module", moduleName,
    "--image-slug", imageSlug,
    "--route", route,
  ];
  if (args.includes("--force")) commandArgs.push("--force");

  const result = spawnSync(process.execPath, commandArgs, {
    cwd: docsRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Alleato docs promotion failed with exit code ${result.status ?? "unknown"}.`);
  }

  console.log(`Docs-site draft created: ${output}`);
  console.log(
    "Next required docs-site stage: editorial review, set visibility: published, run screenshots/nav checks, then deploy and verify the production URL.",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
