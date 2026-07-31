#!/usr/bin/env node
/**
 * pr-unstall — pushes every stalled open PR into the automated lane.
 *
 * The stall this fixes: `autofix-pr-manager.yml` already owns the whole PR
 * lifecycle (mark ready -> review -> fix -> approve -> enable auto-merge ->
 * merge), but it only triggers on branch `autofix/*` or label `automated-pr`.
 * Agent PRs land on `codex/*` and `claude/*` branches, so they never entered
 * the lane -- they just sat as drafts with auto-merge off, forever, waiting for
 * a human who was never notified.
 *
 * This script finds those PRs and does the two things that start the lane:
 *   1. adds the `automated-pr` label (the workflow's trigger), and
 *   2. marks the PR ready for review if it is a draft.
 *
 * The workflow takes over from there and merges once required checks pass.
 * Ownership of the merge decision stays with CI and the risk gate -- this only
 * removes the "nobody pressed start" failure.
 *
 * Usage:
 *   node scripts/git/pr-unstall.mjs             # unstall agent-authored PRs
 *   node scripts/git/pr-unstall.mjs --dry-run   # report only
 *   node scripts/git/pr-unstall.mjs --all       # include human feat/ fix/ PRs
 */

import { execFileSync } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");
const INCLUDE_ALL = process.argv.includes("--all");

/** Branch prefixes whose PRs are agent-authored and safe to automate. */
const AGENT_PREFIXES = ["codex/", "claude/", "autofix/"];

const TRIGGER_LABEL = "automated-pr";

/** Label that means a human deliberately took this PR out of the lane. */
const HOLD_LABELS = new Set(["autofix:needs-human", "needs-megan", "do-not-merge", "wip"]);

function gh(args, options = {}) {
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch (error) {
    if (options.tolerant) return "";
    throw error;
  }
}

function isAgentBranch(branch) {
  return AGENT_PREFIXES.some((prefix) => branch.startsWith(prefix));
}

function main() {
  const json = gh([
    "pr",
    "list",
    "--state",
    "open",
    "--limit",
    "200",
    "--json",
    "number,headRefName,isDraft,labels,autoMergeRequest,title",
  ]);

  if (!json) {
    console.error("pr-unstall: could not reach GitHub (is `gh` authenticated?)");
    process.exit(1);
  }

  const prs = JSON.parse(json);
  const acted = [];
  const skipped = [];

  for (const pr of prs) {
    const labels = new Set((pr.labels ?? []).map((label) => label.name));

    const hold = [...labels].find((label) => HOLD_LABELS.has(label));
    if (hold) {
      skipped.push({ pr, reason: `held by label \`${hold}\`` });
      continue;
    }

    if (!isAgentBranch(pr.headRefName) && !INCLUDE_ALL) {
      skipped.push({ pr, reason: "human-authored branch (use --all to include)" });
      continue;
    }

    const needsLabel = !labels.has(TRIGGER_LABEL);
    const needsReady = pr.isDraft;

    if (!needsLabel && !needsReady) {
      skipped.push({ pr, reason: "already in the automated lane" });
      continue;
    }

    const actions = [];
    if (needsLabel) actions.push(`label:${TRIGGER_LABEL}`);
    if (needsReady) actions.push("ready-for-review");

    if (!DRY_RUN) {
      if (needsLabel) {
        gh(["pr", "edit", String(pr.number), "--add-label", TRIGGER_LABEL], { tolerant: true });
      }
      if (needsReady) {
        gh(["pr", "ready", String(pr.number)], { tolerant: true });
      }
    }

    acted.push({ pr, actions });
  }

  const verb = DRY_RUN ? "Would unstall" : "Unstalled";
  console.log("");
  if (acted.length > 0) {
    console.log(`  ${verb} ${acted.length} PR(s) -- autofix-pr-manager takes over from here:`);
    for (const { pr, actions } of acted) {
      console.log(`    #${pr.number} ${pr.headRefName}`);
      console.log(`        ${actions.join(", ")}`);
    }
  } else {
    console.log("  No stalled PRs -- every open PR is already in the automated lane.");
  }

  const notable = skipped.filter((item) => !item.reason.startsWith("already"));
  if (notable.length > 0) {
    console.log("");
    console.log("  Skipped:");
    for (const { pr, reason } of notable) {
      console.log(`    #${pr.number} ${pr.headRefName} - ${reason}`);
    }
  }
  console.log("");
}

main();
