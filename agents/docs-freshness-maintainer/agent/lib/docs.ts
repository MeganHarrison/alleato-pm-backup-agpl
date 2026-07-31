import fs from "node:fs";
import path from "node:path";

import { runRepoCommand } from "./commands.js";
import { repoRoot } from "./repo.js";
import {
  type DocFinding,
  type DocReport,
  type DocStatus,
  nowIso,
  worstStatus,
} from "./result-schema.js";

/**
 * Documentation drift maintainer logic.
 *
 * This agent orchestrates and verifies the EXISTING doc-generation gates. It does
 * not author docs itself and it does not replace the generators. It proves drift
 * by re-running the canonical generator and diffing, then (under approval) leaves
 * the regenerated output staged for a human PR.
 *
 * Canonical generators (root package.json scripts):
 *   - npm run map:project   -> docs/architecture/PROJECT-MAP.md   (generate-project-map.mjs)
 *   - npm run db:inventory  -> docs/architecture/TABLE-LIST.md    (generate-db-inventory.mjs, from tables.yaml)
 *
 * Hand-verified doc whose freshness is gated by code change:
 *   - docs/architecture/AI-RAG-ARCHITECTURE.md ("Last verified: YYYY-MM-DD")
 *     Stale when RAG-touching code changed after the last verified date
 *     (the path set enforced by .husky/pre-commit-rag-docs / RAG-DOCS-GATE.md).
 */

const ARCH_DIR = "docs/architecture";
const PROJECT_MAP = `${ARCH_DIR}/PROJECT-MAP.md`;
const TABLE_LIST = `${ARCH_DIR}/TABLE-LIST.md`;
const TABLES_YAML = `${ARCH_DIR}/tables.yaml`;
const RAG_ARCHITECTURE = `${ARCH_DIR}/AI-RAG-ARCHITECTURE.md`;

// The RAG-DOCS-GATE path set. A commit touching any of these after the doc's
// "Last verified" date means AI-RAG-ARCHITECTURE.md may be stale.
const RAG_WATCH_PATHS = [
  "frontend/src/lib/ai",
  "backend/src/services/pipeline",
  "backend/src/services/integrations/microsoft_graph",
  "backend/src/services/intelligence",
  "alleato-ai/alleato_ai/tools",
];

type GeneratedTarget = {
  artifact: string;
  file: string;
  generator: string; // shell form, e.g. "npm run map:project"
  ownerFiles: string[];
};

export const GENERATED_TARGETS: GeneratedTarget[] = [
  {
    artifact: "PROJECT-MAP",
    file: PROJECT_MAP,
    generator: "npm run map:project",
    ownerFiles: ["scripts/dev-tools/generate-project-map.mjs", PROJECT_MAP],
  },
  {
    artifact: "TABLE-LIST",
    file: TABLE_LIST,
    generator: "npm run db:inventory",
    ownerFiles: ["scripts/dev-tools/generate-db-inventory.mjs", TABLES_YAML, TABLE_LIST],
  },
];

function absPath(relative: string): string {
  return path.join(repoRoot(), relative);
}

function parseGenerator(generator: string): { command: string; args: string[] } {
  const [command, ...args] = generator.split(" ");
  return { command, args };
}

async function isPathDirty(file: string): Promise<boolean> {
  const result = await runRepoCommand("git", ["status", "--porcelain", "--", file]);
  return result.stdout.trim().length > 0;
}

async function numstat(file: string): Promise<{ added: number; removed: number }> {
  const result = await runRepoCommand("git", ["diff", "--numstat", "--", file]);
  const line = result.stdout.split(/\r?\n/).find((entry) => entry.trim().length > 0);
  if (!line) return { added: 0, removed: 0 };
  const [added, removed] = line.split("\t");
  return {
    added: Number.parseInt(added, 10) || 0,
    removed: Number.parseInt(removed, 10) || 0,
  };
}

// The array fields carry zod `.default([])`, so they are required in the inferred
// DocFinding type but optional for callers — apply the defaults here.
type FindingInput = Omit<DocFinding, "checkedAt" | "offendingCommits" | "ownerFiles" | "nextActions"> &
  Partial<Pick<DocFinding, "offendingCommits" | "ownerFiles" | "nextActions">>;

function finding(partial: FindingInput): DocFinding {
  return {
    checkedAt: nowIso(),
    ...partial,
    offendingCommits: partial.offendingCommits ?? [],
    ownerFiles: partial.ownerFiles ?? [],
    nextActions: partial.nextActions ?? [],
  };
}

/**
 * Re-run a generator and report whether it changes the committed artifact.
 * Side-effect-free by default: restores the file with `git checkout` unless
 * `keepChanges` is set (the approval-gated regenerate path keeps them staged).
 */
async function checkGeneratedTarget(
  target: GeneratedTarget,
  options: { keepChanges?: boolean } = {},
): Promise<DocFinding> {
  if (!fs.existsSync(absPath(target.file))) {
    return finding({
      artifact: target.artifact,
      status: "fail",
      file: target.file,
      generator: target.generator,
      cause: `${target.file} does not exist.`,
      detectionGap: "A generated doc artifact is missing entirely.",
      prevention: `Run \`${target.generator}\` and commit the artifact; it is gated pre-commit.`,
      ownerFiles: target.ownerFiles,
      nextActions: [`Run \`${target.generator}\` from the repo root and commit the result.`],
    });
  }

  // Never clobber pre-existing uncommitted edits to the artifact.
  if (await isPathDirty(target.file)) {
    return finding({
      artifact: target.artifact,
      status: "blocked",
      file: target.file,
      generator: target.generator,
      cause: `${target.file} already has uncommitted changes; cannot safely regenerate-and-compare.`,
      detectionGap: "Working tree was dirty for the target before the check ran.",
      prevention: "Commit or stash the in-flight doc edit, then re-run the maintainer.",
      ownerFiles: target.ownerFiles,
      nextActions: ["Resolve the uncommitted change to the artifact, then re-run this check."],
    });
  }

  const { command, args } = parseGenerator(target.generator);
  const generated = await runRepoCommand(command, args, 240000);
  if (!generated.ok) {
    // Restore in case the generator wrote a partial file before failing.
    await runRepoCommand("git", ["checkout", "--", target.file]);
    return finding({
      artifact: target.artifact,
      status: "blocked",
      file: target.file,
      generator: target.generator,
      cause: `Generator failed (exit ${generated.code ?? "n/a"}). Likely missing credentials, env, or dependencies.`,
      detectionGap: "Maintainer could not prove freshness because the generator did not complete.",
      prevention:
        "Provide the generator's required env (e.g. Supabase URL/keys for db:inventory) to the maintainer runtime.",
      ownerFiles: target.ownerFiles,
      nextActions: [`stderr: ${generated.stderr || "(empty)"}`],
    });
  }

  const drift = await numstat(target.file);
  const hasDrift = drift.added > 0 || drift.removed > 0;

  if (!options.keepChanges) {
    await runRepoCommand("git", ["checkout", "--", target.file]);
  }

  if (!hasDrift) {
    return finding({
      artifact: target.artifact,
      status: "pass",
      file: target.file,
      generator: target.generator,
      driftAdded: 0,
      driftRemoved: 0,
      cause: "Regenerating the artifact produced no diff; it is current.",
      detectionGap: "",
      prevention: "",
      ownerFiles: target.ownerFiles,
    });
  }

  return finding({
    artifact: target.artifact,
    status: "warn",
    file: target.file,
    generator: target.generator,
    driftAdded: drift.added,
    driftRemoved: drift.removed,
    cause: `Regenerating ${target.file} changes it (+${drift.added}/-${drift.removed} lines); the committed copy is stale.`,
    detectionGap:
      "The committed artifact drifted from its source of truth without the generator being re-run.",
    prevention: `Re-run \`${target.generator}\` and commit, or let this maintainer open the regeneration PR.`,
    ownerFiles: target.ownerFiles,
    nextActions: [
      options.keepChanges
        ? `Regenerated output is staged in the working tree; review \`git diff ${target.file}\` and open a PR.`
        : `Run \`${target.generator}\` and commit, or run regenerate_generated_docs with dryRun=false.`,
    ],
  });
}

export async function checkProjectMapDrift(): Promise<DocFinding> {
  return await checkGeneratedTarget(GENERATED_TARGETS[0]);
}

export async function checkTableInventoryDrift(): Promise<DocFinding> {
  return await checkGeneratedTarget(GENERATED_TARGETS[1]);
}

function readLastVerified(): { date: string; ageDays: number } | null {
  const file = absPath(RAG_ARCHITECTURE);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/Last verified:\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const date = match[1];
  const verifiedMs = Date.parse(`${date}T00:00:00Z`);
  const ageDays = Math.max(0, Math.round((Date.now() - verifiedMs) / 86_400_000));
  return { date, ageDays };
}

/**
 * AI-RAG-ARCHITECTURE.md is hand-verified. It is stale when RAG-touching code
 * changed after its "Last verified" date WITHOUT the doc being updated in the
 * same commit. We list commits since that date over the gate's path set and
 * subtract the commits that also touched the architecture doc.
 */
export async function checkRagDocsStaleness(maxCommits = 12): Promise<DocFinding> {
  const verified = readLastVerified();
  if (!verified) {
    return finding({
      artifact: "AI-RAG-ARCHITECTURE",
      status: "blocked",
      file: RAG_ARCHITECTURE,
      cause: `Could not find a "Last verified: YYYY-MM-DD" line in ${RAG_ARCHITECTURE}.`,
      detectionGap: "Freshness watermark is missing or malformed, so staleness cannot be computed.",
      prevention: 'Keep a top-of-file "Last verified: YYYY-MM-DD" line in the architecture doc.',
      ownerFiles: [RAG_ARCHITECTURE],
      nextActions: ['Add or repair the "Last verified" line.'],
    });
  }

  const since = `${verified.date} 00:00:00`;
  const ragCommits = await runRepoCommand("git", [
    "log",
    `--since=${since}`,
    "--format=%H",
    "--",
    ...RAG_WATCH_PATHS,
  ]);
  const docCommits = await runRepoCommand("git", [
    "log",
    `--since=${since}`,
    "--format=%H",
    "--",
    RAG_ARCHITECTURE,
    TABLES_YAML,
  ]);

  const ragSet = new Set(ragCommits.stdout.split(/\r?\n/).filter(Boolean));
  const docSet = new Set(docCommits.stdout.split(/\r?\n/).filter(Boolean));
  const offending = [...ragSet].filter((hash) => !docSet.has(hash));

  if (offending.length === 0) {
    return finding({
      artifact: "AI-RAG-ARCHITECTURE",
      status: "pass",
      file: RAG_ARCHITECTURE,
      staleSinceDays: verified.ageDays,
      cause: `No RAG-path commits since ${verified.date} lack a matching doc update.`,
      detectionGap: "",
      prevention: "",
      ownerFiles: [RAG_ARCHITECTURE],
    });
  }

  const subjects: string[] = [];
  for (const hash of offending.slice(0, maxCommits)) {
    const show = await runRepoCommand("git", ["show", "-s", "--format=%h %ad %s", "--date=short", hash]);
    subjects.push(show.stdout.trim());
  }

  return finding({
    artifact: "AI-RAG-ARCHITECTURE",
    status: "warn",
    file: RAG_ARCHITECTURE,
    staleSinceDays: verified.ageDays,
    offendingCommits: subjects,
    cause: `${offending.length} commit(s) touched RAG-gated paths after the ${verified.date} verification without updating the architecture doc or tables.yaml.`,
    detectionGap:
      "RAG-touching code merged without the architecture doc being re-verified (the pre-commit gate can be bypassed with [skip-rag-docs]).",
    prevention:
      'Review the offending commits; update AI-RAG-ARCHITECTURE.md if architecture/tools/flow changed and bump "Last verified", or confirm they were genuine no-ops.',
    ownerFiles: [RAG_ARCHITECTURE, ...RAG_WATCH_PATHS],
    nextActions: [
      "Inspect the listed commits and either re-verify the doc (new date) or confirm no architectural change.",
    ],
  });
}

export async function inspectDocTargets(): Promise<DocReport> {
  const checkedAt = nowIso();
  const findings: DocFinding[] = [];

  for (const target of GENERATED_TARGETS) {
    const exists = fs.existsSync(absPath(target.file));
    const last = await runRepoCommand("git", [
      "log",
      "-1",
      "--format=%ad",
      "--date=short",
      "--",
      target.file,
    ]);
    findings.push(
      finding({
        artifact: target.artifact,
        status: exists ? "pass" : "fail",
        file: target.file,
        generator: target.generator,
        cause: exists
          ? `Generated by \`${target.generator}\`; last committed ${last.stdout.trim() || "unknown"}.`
          : `${target.file} is missing.`,
        detectionGap: exists ? "" : "Generated artifact absent.",
        prevention: exists ? "" : `Run \`${target.generator}\`.`,
        ownerFiles: target.ownerFiles,
      }),
    );
  }

  const verified = readLastVerified();
  findings.push(
    finding({
      artifact: "AI-RAG-ARCHITECTURE",
      status: verified ? "pass" : "blocked",
      file: RAG_ARCHITECTURE,
      staleSinceDays: verified?.ageDays ?? null,
      cause: verified
        ? `Hand-verified doc; last verified ${verified.date} (${verified.ageDays}d ago). Freshness gated by RAG-path code changes.`
        : 'Missing "Last verified" watermark.',
      detectionGap: verified ? "" : "No watermark to compute staleness.",
      prevention: verified ? "" : 'Add a "Last verified: YYYY-MM-DD" line.',
      ownerFiles: [RAG_ARCHITECTURE],
    }),
  );

  return {
    status: worstStatus(findings.map((entry) => entry.status)),
    checkedAt,
    command: "inspect_doc_targets",
    findings,
    summary: `Tracking ${findings.length} doc artifact(s): ${GENERATED_TARGETS.map((t) => t.artifact).join(", ")}, AI-RAG-ARCHITECTURE.`,
  };
}

export async function regenerateGeneratedDocs(input: { dryRun: boolean }): Promise<DocReport> {
  const checkedAt = nowIso();
  const findings: DocFinding[] = [];
  for (const target of GENERATED_TARGETS) {
    findings.push(await checkGeneratedTarget(target, { keepChanges: !input.dryRun }));
  }

  const status = worstStatus(findings.map((entry) => entry.status));
  const changed = findings.filter((entry) => entry.status === "warn");
  const summary = input.dryRun
    ? `Dry run: ${changed.length} of ${findings.length} generated docs would change. No files left modified.`
    : `Regenerated ${findings.length} docs; ${changed.length} now differ and are left staged in the working tree for review + PR.`;

  return {
    status,
    checkedAt,
    command: `regenerate_generated_docs(dryRun=${input.dryRun})`,
    findings,
    summary,
  };
}

export async function summarizeDocFindings(input: { includeHealthy: boolean }): Promise<DocReport> {
  const checkedAt = nowIso();
  const all: DocFinding[] = [
    await checkProjectMapDrift(),
    await checkTableInventoryDrift(),
    await checkRagDocsStaleness(),
  ];

  const findings = input.includeHealthy ? all : all.filter((entry) => entry.status !== "pass");
  const status: DocStatus = worstStatus(all.map((entry) => entry.status));
  const problems = all.filter((entry) => entry.status !== "pass");

  const summary =
    problems.length === 0
      ? "All tracked docs are fresh: generated artifacts match their generators and the RAG architecture doc has no un-reviewed code drift."
      : `${problems.length} doc artifact(s) need attention: ${problems.map((entry) => `${entry.artifact} (${entry.status})`).join(", ")}.`;

  return {
    status,
    checkedAt,
    command: "summarize_doc_findings",
    findings: findings.length > 0 ? findings : all,
    summary,
  };
}
