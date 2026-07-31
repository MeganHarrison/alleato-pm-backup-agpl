#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DEFAULT_REGISTRY = "docs/ops/learning/recurring-failures.yaml";
const MATURITY = ["recorded", "diagnosable", "detectable", "prevented"];
const ACTIVE_GUARDRAIL_MATURITY = new Set(["detectable", "prevented"]);
const EMPTY_VALUES = new Set(["", "n/a", "na", "none", "pending", "todo", "tbd"]);
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "app",
  "backend",
  "components",
  "docs",
  "for",
  "frontend",
  "from",
  "has",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "ops",
  "scripts",
  "src",
  "the",
  "this",
  "to",
  "with",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isMeaningful(value) {
  if (!isNonEmptyString(value)) return false;
  const normalized = value
    .trim()
    .replace(/^`|`$/g, "")
    .toLowerCase();
  return (
    !EMPTY_VALUES.has(normalized) &&
    !/^<.+>$/.test(normalized) &&
    !/\b(?:pending|todo|tbd)\b/.test(normalized)
  );
}

function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
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

export function loadRegistry(registryPath = DEFAULT_REGISTRY, cwd = process.cwd()) {
  const absolutePath = path.resolve(cwd, registryPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Learning registry not found: ${absolutePath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Learning registry must be dependency-free JSON-compatible YAML: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return { absolutePath, data: parsed };
}

export function validateRegistry(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { errors: ["Registry root must be a YAML object."], warnings };
  }
  if (data.schema_version !== 1) {
    errors.push("Registry schema_version must be 1.");
  }
  if (!Array.isArray(data.failures) || data.failures.length === 0) {
    errors.push("Registry failures must be a non-empty array.");
    return { errors, warnings };
  }

  const ids = new Set();
  for (const [index, failure] of data.failures.entries()) {
    const label = failure?.id || `entry ${index + 1}`;
    if (!failure || typeof failure !== "object" || Array.isArray(failure)) {
      errors.push(`Entry ${index + 1} must be an object.`);
      continue;
    }

    for (const field of [
      "id",
      "title",
      "status",
      "maturity",
      "canonical_owner",
      "root_cause",
      "detection_gap",
      "prevention",
    ]) {
      if (!isNonEmptyString(failure[field])) {
        errors.push(`${label}: missing required string field ${field}.`);
      }
    }

    if (isNonEmptyString(failure.id)) {
      if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(failure.id)) {
        errors.push(`${label}: id must use lowercase letters, numbers, dots, or hyphens.`);
      }
      if (ids.has(failure.id)) errors.push(`${label}: duplicate failure id.`);
      ids.add(failure.id);
    }

    if (!MATURITY.includes(failure.maturity)) {
      errors.push(`${label}: maturity must be one of ${MATURITY.join(", ")}.`);
    }

    for (const field of ["symptoms", "affected_paths", "first_checks", "incidents"]) {
      if (!Array.isArray(failure[field]) || failure[field].length === 0) {
        errors.push(`${label}: ${field} must be a non-empty array.`);
      }
    }

    if (Array.isArray(failure.first_checks)) {
      for (const [checkIndex, check] of failure.first_checks.entries()) {
        if (!isNonEmptyString(check?.command) || !isNonEmptyString(check?.expected)) {
          errors.push(`${label}: first_checks[${checkIndex}] needs command and expected.`);
        }
      }
    }

    if (!failure.guardrail || typeof failure.guardrail !== "object") {
      errors.push(`${label}: guardrail must be an object.`);
    } else {
      for (const field of ["kind", "status", "command", "evidence"]) {
        if (!isNonEmptyString(failure.guardrail[field])) {
          errors.push(`${label}: guardrail.${field} is required.`);
        }
      }
      if (
        ACTIVE_GUARDRAIL_MATURITY.has(failure.maturity) &&
        failure.guardrail.status !== "active"
      ) {
        errors.push(`${label}: ${failure.maturity} maturity requires an active guardrail.`);
      }
    }

    if (Array.isArray(failure.incidents)) {
      for (const [incidentIndex, incident] of failure.incidents.entries()) {
        for (const field of ["date", "task", "summary"]) {
          if (!isNonEmptyString(incident?.[field])) {
            errors.push(`${label}: incidents[${incidentIndex}].${field} is required.`);
          }
        }
      }

      const repeated = failure.incidents.length >= 2;
      const belowDetection = MATURITY.indexOf(failure.maturity) < MATURITY.indexOf("detectable");
      if (repeated && belowDetection) {
        if (failure.promotion?.required !== true) {
          errors.push(`${label}: repeated incidents below detectable maturity require promotion.required=true.`);
        } else if (
          !isNonEmptyString(failure.promotion.owner) ||
          !isNonEmptyString(failure.promotion.next_action)
        ) {
          errors.push(`${label}: promotion debt requires owner and next_action.`);
        } else {
          warnings.push(
            `${label}: repeated incident remains ${failure.maturity}; ${failure.promotion.owner} must ${failure.promotion.next_action}`
          );
        }
      }
    }
  }

  return { errors, warnings };
}

function failureSearchText(failure) {
  return [
    failure.id,
    failure.title,
    failure.canonical_owner,
    ...(failure.symptoms || []),
    ...(failure.affected_paths || []),
    failure.root_cause,
    failure.detection_gap,
    failure.prevention,
  ]
    .join(" ")
    .toLowerCase();
}

export function findMatches(failures, { symptom = "", files = [] } = {}) {
  const symptomTokens = new Set(tokens(symptom));
  const normalizedSymptom = symptom.trim().toLowerCase();

  return failures
    .map((failure) => {
      const searchable = failureSearchText(failure);
      let score = 0;
      const reasons = [];

      if (normalizedSymptom && searchable.includes(normalizedSymptom)) {
        score += 20;
        reasons.push("exact symptom phrase");
      }

      const matchedTokens = [...symptomTokens].filter((token) => searchable.includes(token));
      if (matchedTokens.length > 0) {
        score += matchedTokens.length * 4;
        reasons.push(`symptom terms: ${matchedTokens.join(", ")}`);
      }

      for (const file of files) {
        const normalizedFile = file.replace(/\\/g, "/").replace(/^\.\//, "");
        const matchingPattern = (failure.affected_paths || []).find((pattern) =>
          globToRegExp(pattern).test(normalizedFile)
        );
        if (matchingPattern) {
          score += 30;
          reasons.push(`path ${normalizedFile} matches ${matchingPattern}`);
          continue;
        }

        const pathTokens = tokens(normalizedFile);
        const overlap = pathTokens.filter((token) => searchable.includes(token));
        if (overlap.length > 0) {
          score += overlap.length * 2;
          reasons.push(`path terms: ${[...new Set(overlap)].join(", ")}`);
        }
      }

      return { failure, score, reasons: [...new Set(reasons)] };
    })
    .filter((match) => match.score >= 6)
    .sort((left, right) => right.score - left.score || left.failure.id.localeCompare(right.failure.id));
}

function getMarkdownSection(text, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(
    new RegExp(
      `^##\\s+${escaped}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s+|(?![\\s\\S]))`,
      "im"
    )
  );
  return match?.[1]?.trim() || "";
}

function getLearningValue(section, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(new RegExp(`^-\\s*${escaped}:\\s*(.+?)\\s*$`, "im"));
  return match?.[1]?.trim().replace(/^`|`$/g, "") || "";
}

export function auditTaskText(text, taskPath, registryIds) {
  const section = getMarkdownSection(text, "Incident Learning");
  if (!section) return { checked: false, errors: [] };

  const fingerprint = getLearningValue(section, "Failure fingerprint");
  if (!fingerprint) {
    return {
      checked: true,
      errors: [`${taskPath}: Incident Learning is missing Failure fingerprint.`],
    };
  }
  if (["n/a", "na", "none"].includes(fingerprint.toLowerCase())) {
    return { checked: true, errors: [] };
  }

  const errors = [];
  if (!registryIds.has(fingerprint)) {
    errors.push(
      `${taskPath}: unknown failure fingerprint ${fingerprint}; add it to ${DEFAULT_REGISTRY} or use an existing ID.`
    );
  }

  for (const label of ["Root cause", "Detection gap", "Prevention", "Guardrail evidence"]) {
    const value = getLearningValue(section, label);
    if (!isMeaningful(value)) {
      errors.push(`${taskPath}: Incident Learning ${label} must be completed before finish.`);
    }
  }

  return { checked: true, errors };
}

function parseArgs(argv) {
  const [command, ...raw] = argv;
  const options = {
    command,
    symptom: "",
    files: [],
    registry: DEFAULT_REGISTRY,
    staged: false,
    strict: false,
    tasks: [],
  };

  for (let index = 0; index < raw.length; index += 1) {
    const arg = raw[index];
    if (arg === "--symptom") {
      options.symptom = raw[++index] || "";
    } else if (arg === "--registry") {
      options.registry = raw[++index] || "";
    } else if (arg === "--staged") {
      options.staged = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--files" || arg === "--task") {
      const destination = arg === "--files" ? options.files : options.tasks;
      while (raw[index + 1] && !raw[index + 1].startsWith("--")) {
        destination.push(raw[++index]);
      }
    } else if (arg === "--help" || arg === "-h") {
      options.command = "help";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage() {
  console.log(`Usage:
  node scripts/ops/learning-registry.mjs lookup --symptom "text" [--files path ...]
  node scripts/ops/learning-registry.mjs lookup --files path ...
  node scripts/ops/learning-registry.mjs audit [--staged] [--task task.md ...] [--strict]

Options:
  --registry <path>  Override the default registry path.
  --strict           Treat unresolved promotion debt as an audit failure.`);
}

function printLookup(matches) {
  for (const [{ failure, score, reasons }, index] of matches.map((match, index) => [match, index])) {
    if (index > 0) console.log("");
    console.log(`${index + 1}. ${failure.id} — ${failure.title}`);
    console.log(`   Maturity: ${failure.maturity}`);
    console.log(`   Canonical owner: ${failure.canonical_owner}`);
    console.log(`   Match: ${reasons.join("; ")} (score ${score})`);
    console.log("   First checks:");
    for (const check of failure.first_checks) {
      console.log(`   - ${check.command}`);
      console.log(`     Expect: ${check.expected}`);
    }
    console.log(`   Root cause: ${failure.root_cause}`);
    console.log(`   Prevention: ${failure.prevention}`);
    console.log(
      `   Guardrail: ${failure.guardrail.status} ${failure.guardrail.kind} — ${failure.guardrail.command}`
    );
    if (failure.promotion?.required) {
      console.log(`   Promotion debt: ${failure.promotion.owner} — ${failure.promotion.next_action}`);
    }
  }
}

function stagedTaskFiles() {
  const output = execFileSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf8",
  });
  return output
    .split(/\r?\n/)
    .filter((file) => /^docs\/ops\/tasks\/[^/]+\.md$/.test(file));
}

function runCli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    usage();
    process.exit(2);
  }

  if (!options.command || options.command === "help") {
    usage();
    process.exit(options.command === "help" ? 0 : 2);
  }

  let registry;
  try {
    registry = loadRegistry(options.registry);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const validation = validateRegistry(registry.data);
  if (validation.errors.length > 0) {
    console.error("Learning registry audit failed:");
    validation.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  if (options.command === "lookup") {
    if (!options.symptom.trim() && options.files.length === 0) {
      console.error("Lookup requires --symptom, --files, or both.");
      process.exit(2);
    }
    const matches = findMatches(registry.data.failures, options);
    if (matches.length === 0) {
      console.error("No recurring failure matched the supplied symptom or paths.");
      process.exit(1);
    }
    printLookup(matches);
    process.exit(0);
  }

  if (options.command !== "audit") {
    console.error(`Unknown command: ${options.command}`);
    usage();
    process.exit(2);
  }

  const taskFiles = new Set(options.tasks);
  if (options.staged) stagedTaskFiles().forEach((file) => taskFiles.add(file));
  const registryIds = new Set(registry.data.failures.map((failure) => failure.id));
  const taskErrors = [];
  let checkedTasks = 0;

  for (const taskFile of taskFiles) {
    const absolutePath = path.resolve(taskFile);
    if (!fs.existsSync(absolutePath)) {
      taskErrors.push(`${taskFile}: task file not found.`);
      continue;
    }
    const result = auditTaskText(fs.readFileSync(absolutePath, "utf8"), taskFile, registryIds);
    if (result.checked) checkedTasks += 1;
    taskErrors.push(...result.errors);
  }

  if (taskErrors.length > 0) {
    console.error("Incident learning task audit failed:");
    taskErrors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`Learning registry audit passed: ${registry.data.failures.length} fingerprints.`);
  console.log(`Incident-learning task files checked: ${checkedTasks}.`);
  if (validation.warnings.length > 0) {
    console.warn("Promotion debt:");
    validation.warnings.forEach((warning) => console.warn(`- ${warning}`));
    if (options.strict) process.exit(1);
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) runCli();
