import assert from "node:assert/strict";
import test from "node:test";

import {
  captureEntry,
  findMatches,
  intakeComment,
  inferEntryDraft,
  loadLedger,
  recordEntry,
  validateLedger,
} from "../ops/frontend-feedback-ledger.mjs";

const { data: ledger } = loadLedger();

test("the canonical frontend feedback ledger is structurally valid", () => {
  const result = validateLedger(ledger);
  assert.deepEqual(result.errors, []);
});

test("lookup ranks the seeded short view-all CTA rule for matching copy and path", () => {
  const matches = findMatches(ledger.entries, {
    text: "view all too wordy",
    files: ["frontend/src/app/(main)/[projectId]/home/project-command-center.tsx"],
  });
  assert.equal(matches[0].entry.id, "copy.short-view-all-cta");
  assert.ok(matches[0].score >= 30);
});

test("capture builds a valid new entry", () => {
  const next = captureEntry(ledger, {
    title: "Avoid redundant section helper copy",
    category: "copy",
    source: "codex",
    rule: "Do not add helper copy that simply restates the section title.",
    rationale: "Restated helper text spends attention without adding decision value.",
    comment: "This subtitle says the same thing as the heading.",
    bad: "Manage commitments",
    good: "Remove the subtitle",
    tags: "copy,subtitles,noise-gate",
    appliesTo: "frontend/src/app/**,frontend/src/components/**",
    evidence: "frontend/src/components/example.tsx:10",
  });
  const result = validateLedger(next);
  assert.deepEqual(result.errors, []);
  assert.ok(next.entries.some((entry) => entry.id === "copy.avoid-redundant-section-helper-copy"));
});

test("validation rejects duplicate ids", () => {
  const duplicate = structuredClone(ledger);
  duplicate.entries.push(structuredClone(duplicate.entries[0]));
  const result = validateLedger(duplicate);
  assert.ok(result.errors.some((error) => error.includes("duplicate entry id")));
});

test("record updates an existing entry without duplicating the rule", () => {
  const next = recordEntry(ledger, {
    id: "copy.short-view-all-cta",
    title: "Use short View all CTA copy",
    category: "copy",
    source: "codex",
    comment: "Still too wordy. Keep it to View all.",
    bad: "View all subcontractors and hidden rows",
    good: "View all",
    evidence: "frontend/src/components/example.tsx:12",
  });
  assert.equal(next.mode, "updated");
  const entry = next.data.entries.find((candidate) => candidate.id === "copy.short-view-all-cta");
  assert.ok(entry);
  assert.equal(next.data.entries.length, ledger.entries.length);
  assert.ok(entry.user_quotes.includes("Still too wordy. Keep it to View all."));
  assert.ok(entry.anti_patterns.includes("View all subcontractors and hidden rows"));
  assert.equal(entry.incidents.at(-1).evidence[0], "frontend/src/components/example.tsx:12");
});

test("record creates a new entry when no matching id exists", () => {
  const next = recordEntry(ledger, {
    title: "Avoid redundant section helper copy",
    category: "copy",
    source: "claude",
    rule: "Do not add helper copy that simply restates the section title.",
    rationale: "Restated helper text spends attention without adding decision value.",
    comment: "This subtitle says the same thing as the heading.",
    bad: "Manage commitments",
    good: "Remove the subtitle",
    tags: "copy,subtitles,noise-gate",
    appliesTo: "frontend/src/app/**,frontend/src/components/**",
    evidence: "frontend/src/components/example.tsx:10",
  });
  assert.equal(next.mode, "created");
  assert.ok(next.data.entries.some((entry) => entry.id === "copy.avoid-redundant-section-helper-copy"));
});

test("inferEntryDraft derives copy guidance from a raw comment", () => {
  const draft = inferEntryDraft({
    comment: 'This is way too wordy: "View all subcontractors 18 more" Change this to "View all".',
    files: ["frontend/src/app/(main)/[projectId]/home/project-command-center.tsx"],
  });
  assert.equal(draft.category, "copy");
  assert.equal(draft.good, "View all");
  assert.match(draft.rule, /Prefer concise direct UI copy/);
});

test("intakeComment suggests an existing matching rule", () => {
  const result = intakeComment(ledger, {
    comment: 'This is way too wordy: "View all subcontractors 18 more" Change this to "View all".',
    files: "frontend/src/app/(main)/[projectId]/home/project-command-center.tsx",
    source: "codex",
  });
  assert.equal(result.suggestedId, "copy.short-view-all-cta");
  assert.equal(result.matches[0].entry.id, "copy.short-view-all-cta");
  assert.equal(result.inferred.category, "copy");
});
