#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_LEDGER = "docs/ops/design-feedback/frontend-conversation-feedback.json";
const EMPTY_VALUES = new Set(["", "n/a", "na", "none", "pending", "todo", "tbd"]);
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "app",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "components",
  "copy",
  "design",
  "features",
  "for",
  "from",
  "frontend",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "page",
  "pages",
  "that",
  "the",
  "this",
  "to",
  "ui",
  "use",
  "with",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isMeaningfulString(value) {
  if (!isNonEmptyString(value)) return false;
  const normalized = value.trim().toLowerCase();
  return !EMPTY_VALUES.has(normalized) && !/^<.+>$/.test(normalized);
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function globToRegExp(pattern) {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += ".";
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`${source}$`);
}

function parseCsv(value) {
  if (!isNonEmptyString(value)) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function readJsonFile(absolutePath) {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Frontend feedback ledger must be dependency-free JSON-compatible YAML: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function loadLedger(ledgerPath = DEFAULT_LEDGER, cwd = process.cwd()) {
  const absolutePath = path.resolve(cwd, ledgerPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Frontend feedback ledger not found: ${absolutePath}`);
  }
  return {
    absolutePath,
    data: readJsonFile(absolutePath),
  };
}

export function validateLedger(data) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { errors: ["Ledger root must be a JSON object."] };
  }
  if (data.schema_version !== 1) {
    errors.push("Ledger schema_version must be 1.");
  }
  if (!Array.isArray(data.entries) || data.entries.length === 0) {
    errors.push("Ledger entries must be a non-empty array.");
    return { errors };
  }

  const ids = new Set();
  for (const [index, entry] of data.entries.entries()) {
    const label = entry?.id || `entry ${index + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`Entry ${index + 1} must be an object.`);
      continue;
    }

    for (const field of [
      "id",
      "title",
      "status",
      "category",
      "source",
      "normalized_rule",
      "rationale",
    ]) {
      if (!isMeaningfulString(entry[field])) {
        errors.push(`${label}: missing required string field ${field}.`);
      }
    }

    if (isNonEmptyString(entry.id)) {
      if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(entry.id)) {
        errors.push(`${label}: id must use lowercase letters, numbers, dots, or hyphens.`);
      }
      if (ids.has(entry.id)) errors.push(`${label}: duplicate entry id.`);
      ids.add(entry.id);
    }

    for (const field of [
      "tags",
      "applies_to",
      "anti_patterns",
      "preferred_patterns",
      "user_quotes",
      "first_checks",
      "incidents",
    ]) {
      if (!Array.isArray(entry[field]) || entry[field].length === 0) {
        errors.push(`${label}: ${field} must be a non-empty array.`);
      }
    }

    if (Array.isArray(entry.first_checks)) {
      for (const [checkIndex, check] of entry.first_checks.entries()) {
        if (!isMeaningfulString(check?.command) || !isMeaningfulString(check?.expected)) {
          errors.push(`${label}: first_checks[${checkIndex}] needs command and expected.`);
        }
      }
    }

    if (Array.isArray(entry.incidents)) {
      for (const [incidentIndex, incident] of entry.incidents.entries()) {
        for (const field of ["date", "source", "summary"]) {
          if (!isMeaningfulString(incident?.[field])) {
            errors.push(`${label}: incidents[${incidentIndex}].${field} is required.`);
          }
        }
        if (!Array.isArray(incident?.evidence) || incident.evidence.length === 0) {
          errors.push(`${label}: incidents[${incidentIndex}].evidence must be a non-empty array.`);
        }
      }
    }
  }

  return { errors };
}

function searchText(entry) {
  return [
    entry.id,
    entry.title,
    entry.category,
    entry.source,
    entry.normalized_rule,
    entry.rationale,
    ...(entry.tags || []),
    ...(entry.applies_to || []),
    ...(entry.anti_patterns || []),
    ...(entry.preferred_patterns || []),
    ...(entry.user_quotes || []),
    ...(entry.incidents || []).map((incident) => incident.summary),
  ]
    .join(" ")
    .toLowerCase();
}

export function findMatches(entries, { text = "", files = [] } = {}) {
  const normalizedText = text.trim().toLowerCase();
  const textTokens = new Set(tokenize(text));

  return entries
    .map((entry) => {
      let score = 0;
      const reasons = [];
      const searchable = searchText(entry);

      if (normalizedText && searchable.includes(normalizedText)) {
        score += 20;
        reasons.push("exact text phrase");
      }

      const matchedTokens = [...textTokens].filter((token) => searchable.includes(token));
      if (matchedTokens.length > 0) {
        score += matchedTokens.length * 4;
        reasons.push(`matched terms: ${matchedTokens.join(", ")}`);
      }

      for (const file of files) {
        const normalizedFile = normalizePath(file);
        const matchingPattern = (entry.applies_to || []).find((pattern) =>
          globToRegExp(pattern).test(normalizedFile),
        );
        if (matchingPattern) {
          score += 30;
          reasons.push(`path ${normalizedFile} matches ${matchingPattern}`);
        }
      }

      return { entry, score, reasons };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
}

export function inferCategory(comment, files = []) {
  const text = `${comment} ${files.join(" ")}`.toLowerCase();
  if (/\b(wordy|copy|label|text|title|subtitle|cta|rename|call this|change this to)\b/.test(text)) {
    return "copy";
  }
  if (/\b(click|button|action|open|close|expand|collapse|toggle|menu|tap)\b/.test(text)) {
    return "interaction";
  }
  if (/\b(component|card|modal|sheet|table|row|header|footer|badge|icon)\b/.test(text)) {
    return "component";
  }
  if (/\b(noise|busy|clutter|too much|remove|simplify|quiet|cleaner)\b/.test(text)) {
    return "noise";
  }
  if (/\b(space|spacing|align|hierarchy|section|layout|grid|indent|padding|margin)\b/.test(text)) {
    return "layout";
  }
  return "copy";
}

export function inferEntryDraft({ comment, files = [] }) {
  const normalizedComment = comment.trim().replace(/\s+/g, " ");
  const category = inferCategory(normalizedComment, files);
  const quoted = [...normalizedComment.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const replacementMatch = normalizedComment.match(/change this to ["']?([^"'.!?]+)["']?/i);
  const good = replacementMatch?.[1]?.trim() || quoted.at(-1) || "Replace with shorter direct copy";
  const bad = quoted.length > 1 ? quoted[0] : quoted[0] || "Current UI copy/pattern";
  const focusTokens = tokenize(normalizedComment).slice(0, 5);
  const titleStem = focusTokens.length > 0 ? titleCase(focusTokens.join(" ")) : "Conversation Feedback";
  const title =
    category === "copy" ? `${titleStem} copy guidance` : `${titleStem} ${category} guidance`;

  let normalizedRule = "Capture this conversation comment as a reusable frontend rule.";
  let rationale = "Repeated user corrections should become reusable audit and implementation guidance.";

  if (category === "copy") {
    normalizedRule =
      isMeaningfulString(good) && isMeaningfulString(bad)
        ? `Prefer concise direct UI copy. Replace patterns like "${bad}" with shorter labels like "${good}" when the destination already provides the missing context.`
        : "Prefer concise direct UI copy and remove explanatory filler from labels when the destination already provides context.";
    rationale =
      "Longer labels add reading cost and noise when they do not improve the next action.";
  } else if (category === "interaction") {
    normalizedRule =
      "Use the simplest obvious interaction affordance and remove extra clicks, duplicate controls, or ambiguous actions.";
    rationale = "Interaction friction should be removed at the shared pattern level when possible.";
  } else if (category === "component") {
    normalizedRule =
      "Fix the shared component or primitive instead of repeating local visual or behavioral overrides.";
    rationale = "Recurring component issues should be solved once at the reusable layer.";
  } else if (category === "noise") {
    normalizedRule =
      "Remove non-essential UI before restyling. Extra labels, wrappers, and helper elements need explicit workflow value to remain.";
    rationale = "Noise reduction improves scanning and decision speed more than cosmetic polish alone.";
  } else if (category === "layout") {
    normalizedRule =
      "Use spacing, typography, and alignment to clarify hierarchy before adding more containers or labels.";
    rationale = "Layout problems usually read as hierarchy problems and should be fixed at the structure level.";
  }

  return {
    title,
    category,
    rule: normalizedRule,
    rationale,
    bad,
    good,
    tags: [...new Set([category, ...tokenize(normalizedComment).slice(0, 4)])],
    appliesTo:
      files.length > 0 ? files : ["frontend/src/app/**", "frontend/src/components/**", "frontend/src/features/**"],
    comment: normalizedComment,
  };
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function captureEntry(data, capture) {
  const title = capture.title?.trim();
  const category = capture.category?.trim().toLowerCase();
  const source = capture.source?.trim().toLowerCase();
  const normalizedRule = capture.rule?.trim();
  const rationale = capture.rationale?.trim();
  const comment = capture.comment?.trim();
  const bad = capture.bad?.trim();
  const good = capture.good?.trim();
  const tags = parseCsv(capture.tags);
  const appliesTo = parseCsv(capture.appliesTo);
  const evidence = parseCsv(capture.evidence);

  for (const [field, value] of [
    ["title", title],
    ["category", category],
    ["source", source],
    ["rule", normalizedRule],
    ["rationale", rationale],
    ["comment", comment],
    ["bad", bad],
    ["good", good],
  ]) {
    if (!isMeaningfulString(value)) {
      throw new Error(`capture requires --${field}`);
    }
  }

  const id = `${slugify(category)}.${slugify(title)}`;
  if (data.entries.some((entry) => entry.id === id)) {
    throw new Error(`An entry with id ${id} already exists. Update the existing entry instead.`);
  }

  const entry = {
    id,
    title,
    status: "active",
    category,
    source: `${source}_conversation`,
    normalized_rule: normalizedRule,
    rationale,
    tags: tags.length > 0 ? tags : [category],
    applies_to: appliesTo.length > 0 ? appliesTo : ["frontend/src/app/**", "frontend/src/components/**"],
    anti_patterns: [bad],
    preferred_patterns: [good],
    user_quotes: [comment],
    first_checks: [
      {
        command: `node scripts/ops/frontend-feedback-ledger.mjs lookup --text "${title}"`,
        expected: "The new conversation-derived frontend rule is returned for future frontend work.",
      },
    ],
    incidents: [
      {
        date: new Date().toISOString().slice(0, 10),
        source: source === "claude" ? "Claude conversation" : "Codex conversation",
        summary: comment,
        evidence: evidence.length > 0 ? evidence : ["conversation capture only"],
      },
    ],
  };

  return {
    ...data,
    last_reviewed: new Date().toISOString().slice(0, 10),
    entries: [...data.entries, entry].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function recordEntry(data, capture) {
  const title = capture.title?.trim();
  const category = capture.category?.trim().toLowerCase();
  const explicitId = capture.id?.trim().toLowerCase();
  const derivedId = explicitId || `${slugify(category)}.${slugify(title)}`;
  const existingIndex = data.entries.findIndex((entry) => entry.id === derivedId);

  if (existingIndex === -1) {
    return {
      mode: "created",
      data: captureEntry(data, capture),
      entryId: derivedId,
    };
  }

  const existing = data.entries[existingIndex];
  const source = capture.source?.trim().toLowerCase();
  const normalizedRule = capture.rule?.trim();
  const rationale = capture.rationale?.trim();
  const comment = capture.comment?.trim();
  const bad = capture.bad?.trim();
  const good = capture.good?.trim();
  const tags = parseCsv(capture.tags);
  const appliesTo = parseCsv(capture.appliesTo);
  const evidence = parseCsv(capture.evidence);
  const incidentDate = new Date().toISOString().slice(0, 10);

  for (const [field, value] of [
    ["source", source],
    ["comment", comment],
  ]) {
    if (!isMeaningfulString(value)) {
      throw new Error(`record requires --${field}`);
    }
  }

  const updated = {
    ...existing,
    title: isMeaningfulString(title) ? title : existing.title,
    category: isMeaningfulString(category) ? category : existing.category,
    source: isMeaningfulString(source) ? `${source}_conversation` : existing.source,
    normalized_rule: isMeaningfulString(normalizedRule) ? normalizedRule : existing.normalized_rule,
    rationale: isMeaningfulString(rationale) ? rationale : existing.rationale,
    tags: [...new Set([...(existing.tags || []), ...tags])],
    applies_to:
      appliesTo.length > 0
        ? [...new Set([...(existing.applies_to || []), ...appliesTo])]
        : existing.applies_to,
    anti_patterns:
      isMeaningfulString(bad) && !(existing.anti_patterns || []).includes(bad)
        ? [...(existing.anti_patterns || []), bad]
        : existing.anti_patterns,
    preferred_patterns:
      isMeaningfulString(good) && !(existing.preferred_patterns || []).includes(good)
        ? [...(existing.preferred_patterns || []), good]
        : existing.preferred_patterns,
    user_quotes:
      isMeaningfulString(comment) && !(existing.user_quotes || []).includes(comment)
        ? [...(existing.user_quotes || []), comment]
        : existing.user_quotes,
    incidents: [
      ...(existing.incidents || []),
      {
        date: incidentDate,
        source: source === "claude" ? "Claude conversation" : "Codex conversation",
        summary: comment,
        evidence: evidence.length > 0 ? evidence : ["conversation capture only"],
      },
    ],
  };

  const entries = [...data.entries];
  entries[existingIndex] = updated;
  entries.sort((left, right) => left.id.localeCompare(right.id));

  return {
    mode: "updated",
    data: {
      ...data,
      last_reviewed: incidentDate,
      entries,
    },
    entryId: derivedId,
  };
}

export function intakeComment(data, capture) {
  const comment = capture.comment?.trim();
  if (!isMeaningfulString(comment)) {
    throw new Error("intake requires --comment");
  }
  const files = parseCsv(capture.files);
  const draft = inferEntryDraft({ comment, files });
  const merged = {
    ...draft,
    ...capture,
    title: capture.title?.trim() || draft.title,
    category: capture.category?.trim().toLowerCase() || draft.category,
    source: capture.source?.trim().toLowerCase() || "codex",
    rule: capture.rule?.trim() || draft.rule,
    rationale: capture.rationale?.trim() || draft.rationale,
    bad: capture.bad?.trim() || draft.bad,
    good: capture.good?.trim() || draft.good,
    tags: capture.tags || draft.tags.join(","),
    appliesTo: capture.appliesTo || files.join(",") || draft.appliesTo.join(","),
    evidence: capture.evidence,
    comment,
  };
  const matches = findMatches(data.entries, { text: comment, files });
  const targetId = capture.id?.trim() || matches[0]?.entry?.id;
  return {
    inferred: merged,
    suggestedId: targetId || `${slugify(merged.category)}.${slugify(merged.title)}`,
    matches: matches.slice(0, 3),
  };
}

function writeLedger(absolutePath, data) {
  ensureDirectory(absolutePath);
  fs.writeFileSync(absolutePath, `${JSON.stringify(data, null, 2)}\n`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function printUsage() {
  console.log(`Usage:
  node scripts/ops/frontend-feedback-ledger.mjs validate
  node scripts/ops/frontend-feedback-ledger.mjs lookup --text "<query>" [--files "path1,path2"]
  node scripts/ops/frontend-feedback-ledger.mjs capture --title "<title>" --category "<category>" --source codex|claude --rule "<normalized rule>" --rationale "<why>" --comment "<user quote>" --bad "<bad example>" --good "<good example>" [--tags "a,b"] [--applies-to "glob1,glob2"] [--evidence "path:line,path2:line"]
  node scripts/ops/frontend-feedback-ledger.mjs record [--id "<existing-id>"] --title "<title>" --category "<category>" --source codex|claude --comment "<user quote>" [--rule "<normalized rule>"] [--rationale "<why>"] [--bad "<bad example>"] [--good "<good example>"] [--tags "a,b"] [--applies-to "glob1,glob2"] [--evidence "path:line,path2:line"]
  node scripts/ops/frontend-feedback-ledger.mjs intake --comment "<raw conversation comment>" [--files "path1,path2"] [--source codex|claude] [--write] [--id "<existing-id>"]`);
}

function runValidate(ledgerPath) {
  const { data } = loadLedger(ledgerPath);
  const result = validateLedger(data);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: validated ${data.entries.length} frontend conversation feedback entries.`);
}

function runLookup(ledgerPath, options) {
  const text = options.text?.trim() ?? "";
  const files = parseCsv(options.files);
  if (!text && files.length === 0) {
    throw new Error("lookup requires --text and/or --files");
  }

  const { data } = loadLedger(ledgerPath);
  const result = validateLedger(data);
  if (result.errors.length > 0) {
    throw new Error(`ledger validation failed before lookup: ${result.errors.join("; ")}`);
  }

  const matches = findMatches(data.entries, { text, files });
  if (matches.length === 0) {
    console.error("No matching frontend conversation feedback rules found.");
    process.exitCode = 1;
    return;
  }

  for (const [index, match] of matches.entries()) {
    console.log(`${index + 1}. ${match.entry.id} (${match.entry.category})`);
    console.log(`   Title: ${match.entry.title}`);
    console.log(`   Rule: ${match.entry.normalized_rule}`);
    console.log(`   Preferred: ${match.entry.preferred_patterns.join(" | ")}`);
    console.log(`   Anti-patterns: ${match.entry.anti_patterns.join(" | ")}`);
    console.log(`   Reasons: ${match.reasons.join("; ")}`);
  }
}

function runCapture(ledgerPath, options) {
  const { absolutePath, data } = loadLedger(ledgerPath);
  const next = captureEntry(data, {
    title: options.title,
    category: options.category,
    source: options.source,
    rule: options.rule,
    rationale: options.rationale,
    comment: options.comment,
    bad: options.bad,
    good: options.good,
    tags: options.tags,
    appliesTo: options["applies-to"],
    evidence: options.evidence,
  });
  const result = validateLedger(next);
  if (result.errors.length > 0) {
    throw new Error(`captured entry is invalid: ${result.errors.join("; ")}`);
  }
  writeLedger(absolutePath, next);
  console.log(`CAPTURED: ${next.entries[next.entries.length - 1].id}`);
}

function runRecord(ledgerPath, options) {
  const { absolutePath, data } = loadLedger(ledgerPath);
  const result = recordEntry(data, {
    id: options.id,
    title: options.title,
    category: options.category,
    source: options.source,
    rule: options.rule,
    rationale: options.rationale,
    comment: options.comment,
    bad: options.bad,
    good: options.good,
    tags: options.tags,
    appliesTo: options["applies-to"],
    evidence: options.evidence,
  });
  const validation = validateLedger(result.data);
  if (validation.errors.length > 0) {
    throw new Error(`recorded entry is invalid: ${validation.errors.join("; ")}`);
  }
  writeLedger(absolutePath, result.data);
  console.log(`${result.mode.toUpperCase()}: ${result.entryId}`);
}

function runIntake(ledgerPath, options) {
  const { absolutePath, data } = loadLedger(ledgerPath);
  const result = intakeComment(data, {
    id: options.id,
    title: options.title,
    category: options.category,
    source: options.source,
    rule: options.rule,
    rationale: options.rationale,
    comment: options.comment,
    bad: options.bad,
    good: options.good,
    tags: options.tags,
    files: options.files,
    appliesTo: options["applies-to"],
    evidence: options.evidence,
  });
  console.log(`Suggested ID: ${result.suggestedId}`);
  console.log(`Category: ${result.inferred.category}`);
  console.log(`Title: ${result.inferred.title}`);
  console.log(`Rule: ${result.inferred.rule}`);
  console.log(`Rationale: ${result.inferred.rationale}`);
  console.log(`Bad: ${result.inferred.bad}`);
  console.log(`Good: ${result.inferred.good}`);
  console.log(`Tags: ${parseCsv(result.inferred.tags).join(", ")}`);
  console.log(`Applies to: ${parseCsv(result.inferred.appliesTo).join(", ")}`);
  if (result.matches.length > 0) {
    console.log("Likely existing matches:");
    for (const match of result.matches) {
      console.log(`- ${match.entry.id}: ${match.entry.title}`);
    }
  } else {
    console.log("Likely existing matches: none");
  }

  if (options.write === "true") {
    const recordResult = recordEntry(data, {
      ...result.inferred,
      id: options.id || result.matches[0]?.entry?.id,
      source: result.inferred.source,
      evidence: options.evidence,
    });
    const validation = validateLedger(recordResult.data);
    if (validation.errors.length > 0) {
      throw new Error(`intake write produced invalid ledger: ${validation.errors.join("; ")}`);
    }
    writeLedger(absolutePath, recordResult.data);
    console.log(`${recordResult.mode.toUpperCase()}: ${recordResult.entryId}`);
  }
}

function main() {
  try {
    const { command, options } = parseArgs(process.argv.slice(2));
    if (!command || command === "--help" || command === "help") {
      printUsage();
      return;
    }
    const ledgerPath = options.ledger || DEFAULT_LEDGER;
    if (command === "validate") {
      runValidate(ledgerPath);
      return;
    }
    if (command === "lookup") {
      runLookup(ledgerPath, options);
      return;
    }
    if (command === "capture") {
      runCapture(ledgerPath, options);
      return;
    }
    if (command === "record") {
      runRecord(ledgerPath, options);
      return;
    }
    if (command === "intake") {
      runIntake(ledgerPath, options);
      return;
    }
    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
