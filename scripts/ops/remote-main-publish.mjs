#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const COMMAND_OUTPUT_BUFFER = 64 * 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

function run(command, args, { input, encoding = "utf8" } = {}) {
  try {
    return execFileSync(command, args, {
      cwd: process.cwd(),
      encoding,
      input,
      maxBuffer: COMMAND_OUTPUT_BUFFER,
    });
  } catch (error) {
    fail(`${command} ${args.join(" ")} failed: ${error.stderr?.toString().trim() || error.message}`);
  }
}

function parseArgs(argv) {
  const options = { files: [], source: "HEAD", attempts: 3, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--message" || arg === "--source" || arg === "--attempts") options[arg.slice(2)] = argv[++index];
    else if (arg === "--files") {
      while (argv[index + 1] && !argv[index + 1].startsWith("--")) options.files.push(argv[++index]);
    } else fail(`Unknown argument: ${arg}`);
  }
  if (!options.message || !options.files.length) fail("Usage: node scripts/ops/remote-main-publish.mjs --message <message> --files <exact paths...> [--source HEAD] [--dry-run]");
  options.attempts = Number(options.attempts);
  if (!Number.isInteger(options.attempts) || options.attempts < 1 || options.attempts > 5) fail("--attempts must be an integer from 1 to 5.");
  return options;
}

function repository() {
  const remote = run("git", ["remote", "get-url", "origin"]).trim();
  const match = remote.match(/(?:github\.com[/:])([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!match) fail(`Cannot derive owner/repository from origin: ${remote}`);
  return `${match[1]}/${match[2]}`;
}

function api(endpoint, method = "GET", body) {
  const args = ["api", "--method", method, endpoint];
  if (body !== undefined) args.push("--input", "-");
  return JSON.parse(run("gh", args, body === undefined ? undefined : { input: JSON.stringify(body) }));
}

function sourceFiles(source, files) {
  return files.map((file) => ({
    path: file,
    ...(() => {
      const entry = run("git", ["ls-tree", "-r", "--name-only", source, "--", file]).trim();
      if (!entry) return { sha: null };
      return {
        content: run("git", ["show", `${source}:${file}`], { encoding: null }).toString("base64"),
        encoding: "base64",
      };
    })(),
  }));
}

function publish({ repo, message, files, attempts, dryRun }) {
  const source = sourceFiles(files.source, files.paths);
  if (dryRun) {
    console.log(JSON.stringify({ repo, message, files: source.map(({ path }) => path), mode: "compare-and-swap remote main publish" }, null, 2));
    return;
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const ref = api(`repos/${repo}/git/ref/heads/main`);
    const parent = ref.object.sha;
    const parentCommit = api(`repos/${repo}/git/commits/${parent}`);
    const blobs = source.map(({ path, content, encoding, sha }) => {
      if (sha === null) return { path, mode: "100644", type: "blob", sha: null };
      return {
        path,
        mode: "100644",
        type: "blob",
        sha: api(`repos/${repo}/git/blobs`, "POST", { content, encoding }).sha,
      };
    });
    const tree = api(`repos/${repo}/git/trees`, "POST", { base_tree: parentCommit.tree.sha, tree: blobs });
    const commit = api(`repos/${repo}/git/commits`, "POST", { message, tree: tree.sha, parents: [parent] });
    try {
      api(`repos/${repo}/git/refs/heads/main`, "PATCH", { sha: commit.sha, force: false });
      console.log(`Published ${source.length} exact file(s) to origin/main at ${commit.sha}.`);
      return commit.sha;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.error(`Remote main advanced during publish attempt ${attempt}; retrying without touching the local worktree.`);
    }
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  const repo = repository();
  publish({ repo, message: options.message, files: { source: options.source, paths: options.files }, attempts: options.attempts, dryRun: options.dryRun });
} catch (error) {
  console.error(`[remote-main-publish] ${error.message}`);
  process.exitCode = 1;
}
