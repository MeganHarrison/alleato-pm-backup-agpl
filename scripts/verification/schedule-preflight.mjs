#!/usr/bin/env node

/**
 * The scheduling release entry point. It composes the complete scheduling
 * suite and canonical browser-auth verifier while retaining an explicit
 * fast-feedback option.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const canonicalOrigin = "https://projects.alleatogroup.com";

function usage() {
  return [
    "Usage: npm run schedule:preflight -- --project-id <positive-integer> [--base-url <origin>] [--session <name>] [--fast-tests] [--skip-tests]",
    "Example: npm run schedule:preflight -- --project-id 43 --session schedule-proof",
  ].join("\n");
}

export function parseArgs(argv) {
  const options = {
    projectId: "",
    baseUrl: canonicalOrigin,
    session: "schedule-proof",
    skipTests: false,
    fastTests: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--project-id") options.projectId = argv[++index] ?? "";
    else if (token === "--base-url") options.baseUrl = argv[++index] ?? "";
    else if (token === "--session") options.session = argv[++index] ?? "";
    else if (token === "--fast-tests") options.fastTests = true;
    else if (token === "--skip-tests") options.skipTests = true;
    else throw new Error(`Unknown argument: ${token}\n${usage()}`);
  }

  if (!options.projectId) throw new Error(`--project-id is required.\n${usage()}`);
  if (!/^\d+$/.test(options.projectId) || Number(options.projectId) <= 0) {
    throw new Error(`--project-id must be a positive integer; received '${options.projectId}'.`);
  }
  if (!options.session) throw new Error(`--session cannot be empty.\n${usage()}`);

  const baseUrl = new URL(options.baseUrl);
  if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
    throw new Error(`--base-url must use http or https; received '${options.baseUrl}'.`);
  }

  return { ...options, baseUrl: baseUrl.origin, route: `/${options.projectId}/schedule` };
}

function commandLabel(command, args) {
  return [command, ...args].join(" ");
}

export function buildNpmInvocation(
  args,
  {
    platform = process.platform,
    npmExecPath = process.env.npm_execpath,
    nodeExecPath = process.execPath,
  } = {},
) {
  if (platform !== "win32") return { command: "npm", args };
  if (!npmExecPath) {
    throw new Error(
      "Windows schedule preflight must be launched through `npm run schedule:preflight` so npm_execpath is available.",
    );
  }
  return { command: nodeExecPath, args: [npmExecPath, ...args] };
}

function runNpm(args) {
  const label = commandLabel("npm", args);
  console.log(`Running: ${label}`);
  if (process.env.SCHEDULE_PREFLIGHT_DRY_RUN === "1") return;

  const invocation = buildNpmInvocation(args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

export function main(argv = process.argv.slice(2)) {
  const { projectId, baseUrl, route, session, skipTests, fastTests } = parseArgs(argv);
  if (!skipTests) {
    runNpm(["run", fastTests ? "test:schedule" : "test:schedule:release"]);
  }
  runNpm(["run", "verify:browser-auth", "--", "--base-url", baseUrl, "--route", route, "--session", session]);
  console.log(`Schedule preflight ready: ${baseUrl}${route} (session=${session}, project=${projectId})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
