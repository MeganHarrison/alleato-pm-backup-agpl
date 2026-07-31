#!/usr/bin/env node

import { readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultFrontendRoot = path.join(repoRoot, "frontend");
const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const supplementalScheduleTests = [
  "tests/helpers/__tests__/db-disposable-schedule-project.test.ts",
];
export const releaseTestTimeoutMs = 15_000;
export const scheduleTestTimeZone = "America/Indianapolis";

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function isScheduleOwnedTest(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!testFilePattern.test(normalized)) return false;
  return (
    normalized.startsWith("src/lib/scheduling/__tests__/") ||
    normalized.startsWith("src/components/scheduling/__tests__/") ||
    /^src\/app\/api\/projects\/\[projectId\]\/scheduling\/.*\/__tests__\//.test(normalized) ||
    /^src\/lib\/services\/__tests__\/schedul(?:e|ing)[^/]*\.(?:test|spec)\./.test(normalized) ||
    normalized === "src/hooks/__tests__/use-schedule-resources.test.tsx" ||
    supplementalScheduleTests.includes(normalized)
  );
}

export function discoverScheduleTests(frontendRoot = defaultFrontendRoot) {
  const sourceRoot = path.join(frontendRoot, "src");
  return [
    ...walk(sourceRoot),
    ...supplementalScheduleTests.map((relative) => path.join(frontendRoot, relative)),
  ]
    .map((absolute) => path.relative(frontendRoot, absolute).replaceAll("\\", "/"))
    .filter(isScheduleOwnedTest)
    .sort();
}

export function buildJestArgs(testPaths) {
  if (testPaths.length === 0) {
    throw new Error("No scheduling-owned tests were discovered.");
  }
  return [
    "exec",
    "jest",
    "--runInBand",
    `--testTimeout=${releaseTestTimeoutMs}`,
    "--roots",
    "src",
    "tests",
    "--runTestsByPath",
    ...testPaths,
  ];
}

export function containsUnexpectedReactActWarning(output) {
  return output.includes("not wrapped in act");
}

export function main(argv = process.argv.slice(2)) {
  const allowed = new Set(["--list"]);
  const unknown = argv.find((argument) => !allowed.has(argument));
  if (unknown) throw new Error(`Unknown argument: ${unknown}`);

  const tests = discoverScheduleTests();
  if (argv.includes("--list")) {
    process.stdout.write(`${tests.join("\n")}\n`);
    return;
  }

  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const args = buildJestArgs(tests);
  console.log(`Running ${tests.length} scheduling-owned test files.`);
  const result = spawnSync(command, args, {
    cwd: defaultFrontendRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      TZ: scheduleTestTimeZone,
    },
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Scheduling release suite failed with exit code ${result.status}.`);
  }
  const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (containsUnexpectedReactActWarning(combinedOutput)) {
    throw new Error(
      "Scheduling release suite emitted an unexpected React act warning.",
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
