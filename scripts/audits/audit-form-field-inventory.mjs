#!/usr/bin/env node
/**
 * Audit: Form Field Inventory
 *
 * Goal:
 * Generate a repo-truth inventory of form fields so form audits do not require
 * manual page-by-page inspection.
 *
 * Output:
 * - Summary counts
 * - Per-file field inventory
 * - Explicit unsupported files when a file looks like a form surface but no
 *   fields could be extracted
 * - Optional JSON output for downstream tooling
 *
 * Usage:
 *   node scripts/audits/audit-form-field-inventory.mjs
 *   node scripts/audits/audit-form-field-inventory.mjs --match commitments
 *   node scripts/audits/audit-form-field-inventory.mjs --json
 *   node scripts/audits/audit-form-field-inventory.mjs --summary
 *   node scripts/audits/audit-form-field-inventory.mjs --write docs/ops/reports/form-fields.md
 *   node scripts/audits/audit-form-field-inventory.mjs --fail-on-gaps
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  FRONTEND_SRC,
  relFromRepo,
  walkFiles,
} from "./_lib.mjs";

const argv = process.argv.slice(2);
const options = {
  json: argv.includes("--json"),
  summary: argv.includes("--summary"),
  failOnGaps: argv.includes("--fail-on-gaps"),
  match: readFlagValue("--match"),
  writePath: readFlagValue("--write"),
};

const FIELD_TYPE_PATTERNS = [
  [/RHFDateField|type=["']date["']/, "date"],
  [/MoneyField|currency|formatted-number/, "currency"],
  [/RHFComboboxField|Combobox|CommandInput|role=["']combobox["']/, "combobox"],
  [/MultiCombobox|RHFMultiComboboxField/, "multi-combobox"],
  [/Checkbox|type=["']checkbox["']/, "checkbox"],
  [/Textarea/, "textarea"],
  [/RHFSelectField|SelectTrigger|<Select\b|SelectValue/, "select"],
  [/Switch|type=["']switch["']/, "switch"],
  [/type=["']email["']/, "email"],
  [/type=["']tel["']/, "tel"],
  [/RHFNumberField|type=["']number["']/, "number"],
  [/type=["']file["']/, "file"],
  [/InputGroupInput|<Input\b|RHFTextField/, "text"],
];

const IGNORED_FIELD_NAMES = new Set(["fieldName"]);

const FORM_FILE_HINT_RE =
  /(useFormContext|useForm\(|<form\b|handleSubmit\(|register\(|<FormField\b|<Controller\b|RHF[A-Za-z]+Field)/;

const EXTRACTORS = [
  extractConfigFields,
  extractFormFieldNames,
  extractControllerNames,
  extractRHFFieldNames,
  extractRegisterNames,
  extractPlainJsxFields,
];

const files = [];
for await (const filePath of walkFiles(FRONTEND_SRC)) {
  files.push(filePath);
}

const candidateFiles = [];
for (const filePath of files) {
  const relPath = relFromRepo(filePath);
  if (!isUiSurfaceFile(relPath)) {
    continue;
  }
  if (options.match && !relPath.includes(options.match)) {
    continue;
  }
  const text = await readFile(filePath, "utf8").catch(() => null);
  if (!text || !looksLikeFormSurface(relPath, text)) {
    continue;
  }
  const extractedFields = await collectFields(filePath, text);
  let mergedFields = mergeFieldEntries(extractedFields).sort(
    (a, b) => a.line - b.line || a.name.localeCompare(b.name),
  );
  if (mergedFields.length === 0) {
    const delegatedFields = await extractImportedFormComponentFields(filePath, text);
    mergedFields = mergeFieldEntries(delegatedFields).sort(
      (a, b) => a.line - b.line || a.name.localeCompare(b.name),
    );
  }

  candidateFiles.push({
    filePath,
    relPath,
    fieldCount: mergedFields.length,
    hasFormMarkup: /<form\b/.test(text),
    signals: collectSignals(text),
    fields: mergedFields,
  });
}

const unsupportedFiles = candidateFiles.filter((file) => file.fieldCount === 0);
const filesWithMissingLabels = candidateFiles.filter((file) =>
  file.fields.some((field) => !field.label),
);
const filesWithMissingTypes = candidateFiles.filter((file) =>
  file.fields.some((field) => !field.type),
);

const stats = buildStats(candidateFiles, unsupportedFiles);
const payload = {
  generatedAt: new Date().toISOString(),
  stats,
  unsupportedFiles: unsupportedFiles.map(minifyFileResult),
  files: candidateFiles.map(minifyFileResult),
};

const output = options.json
  ? JSON.stringify(payload, null, 2)
  : renderMarkdownReport({
      stats,
      files: candidateFiles,
      unsupportedFiles,
      filesWithMissingLabels,
      filesWithMissingTypes,
      summaryOnly: options.summary,
    });

if (options.writePath) {
  const absoluteWritePath = path.resolve(options.writePath);
  await writeFile(absoluteWritePath, output, "utf8");
}

process.stdout.write(`${output}\n`);

if (
  options.failOnGaps &&
  (unsupportedFiles.length > 0 ||
    filesWithMissingLabels.length > 0 ||
    filesWithMissingTypes.length > 0)
) {
  process.exitCode = 1;
}

function readFlagValue(flag) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return argv[index + 1] ?? null;
}

function isUiSurfaceFile(relPath) {
  return (
    relPath.endsWith(".tsx") &&
    (relPath.startsWith("frontend/src/app/") ||
      relPath.startsWith("frontend/src/components/") ||
      relPath.startsWith("frontend/src/features/"))
  );
}

function looksLikeFormSurface(relPath, text) {
  if (isExcludedInfrastructureFile(relPath)) {
    return false;
  }

  const hasStrongCodeSignal = FORM_FILE_HINT_RE.test(text);
  const hasFormTag = /<form\b/.test(text);
  const hasStrongPathSignal =
    /form/i.test(path.basename(relPath)) ||
    relPath.includes("/new/") ||
    relPath.includes("/edit/") ||
    relPath.includes("/respond/") ||
    relPath.includes("/fields/") ||
    relPath.includes("/forms/") ||
    relPath.includes("-form/");

  if (!hasStrongCodeSignal && !hasFormTag) {
    return false;
  }

  if (hasStrongCodeSignal) {
    return true;
  }

  return hasStrongPathSignal;
}

function isExcludedInfrastructureFile(relPath) {
  return (
    relPath.startsWith("frontend/src/components/forms/") ||
    relPath === "frontend/src/components/ui/form.tsx" ||
    relPath === "frontend/src/components/layout/FormContainer.tsx" ||
    relPath === "frontend/src/hooks/use-dev-autofill.tsx" ||
    relPath.startsWith("frontend/src/components/ai/") ||
    relPath.startsWith("frontend/src/components/ai-elements/") ||
    relPath.startsWith("frontend/src/components/ask-alleato/") ||
    relPath.startsWith("frontend/src/components/dev/") ||
    relPath.startsWith("frontend/src/components/dev-panel/") ||
    relPath.startsWith("frontend/src/components/misc/") ||
    relPath.startsWith("frontend/src/components/realtime/") ||
    relPath === "frontend/src/components/procore-docs/docs-chat.tsx" ||
    relPath === "frontend/src/components/ds/comment-thread.tsx" ||
    relPath.endsWith("/index.ts")
  );
}

function collectSignals(text) {
  return [
    /useFormContext/.test(text) ? "useFormContext" : null,
    /useForm\(/.test(text) ? "useForm" : null,
    /register\(/.test(text) ? "register" : null,
    /<FormField\b/.test(text) ? "FormField" : null,
    /<Controller\b/.test(text) ? "Controller" : null,
    /RHF[A-Za-z]+Field/.test(text) ? "RHFField" : null,
    /<form\b/.test(text) ? "form-tag" : null,
  ].filter(Boolean);
}

async function collectFields(filePath, text) {
  const entries = [];
  for (const extractor of EXTRACTORS) {
    entries.push(...extractor(text));
  }
  entries.push(...(await extractImportedConfigFields(filePath, text)));
  return entries;
}

function extractPlainJsxFields(text) {
  const entries = [];
  const labelMap = new Map();
  const matchedLabelIds = new Set();
  const labelRegex =
    /<Label\b[^>]*htmlFor=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Label>/g;
  let labelMatch;
  while ((labelMatch = labelRegex.exec(text)) !== null) {
    labelMap.set(labelMatch[1], {
      label: cleanLabel(labelMatch[2]),
      index: labelMatch.index,
    });
  }

  const controlRegex =
    /<(Input|Textarea|PasswordInput|NumberInput|Checkbox|SelectTrigger)\b([\s\S]{0,220}?)\bid=["']([^"']+)["']([\s\S]{0,220}?)\/?>/g;
  let match;
  while ((match = controlRegex.exec(text)) !== null) {
    const [, componentName, beforeId, id, afterId] = match;
    const labelRecord = labelMap.get(id);
    if (!labelRecord) {
      continue;
    }
    matchedLabelIds.add(id);
    const snippet = `${beforeId} ${afterId} ${componentName}`;
    const entry = buildFieldEntry(text, match.index, id, "plain-jsx");
    if (!entry) {
      continue;
    }
    entry.label = labelRecord.label;
    entry.type =
      inferFieldType(`${snippet} ${entry.type ?? ""}`) ?? entry.type;
    entry.required = inferRequired(snippet, labelRecord.label);
    entries.push(entry);
  }

  for (const [id, labelRecord] of labelMap.entries()) {
    if (matchedLabelIds.has(id)) {
      continue;
    }
    const entry = buildFieldEntry(text, labelRecord.index, id, "plain-label");
    if (!entry) {
      continue;
    }
    const nearbyContext = getCharWindow(text, labelRecord.index, 80, 260);
    entry.label = labelRecord.label;
    entry.type =
      inferFieldType(nearbyContext) ??
      inferTypeFromLabel(labelRecord.label) ??
      entry.type;
    entry.required = inferRequired(nearbyContext, labelRecord.label);
    entries.push(entry);
  }

  return entries;
}

function extractFormFieldNames(text) {
  return extractJsxNameMatches(
    text,
    /<FormField\b[\s\S]{0,200}?name=(?:["']([^"']+)["']|\{([A-Za-z_$][A-Za-z0-9_$.]*)\})/g,
    "FormField",
  );
}

function extractControllerNames(text) {
  return extractJsxNameMatches(
    text,
    /<Controller\b[\s\S]{0,200}?name=(?:["']([^"']+)["']|\{([A-Za-z_$][A-Za-z0-9_$.]*)\})/g,
    "Controller",
  );
}

function extractRHFFieldNames(text) {
  return extractJsxNameMatches(
    text,
    /<(?:RHF[A-Za-z]+Field)\b[\s\S]{0,240}?name=(?:["']([^"']+)["']|\{([A-Za-z_$][A-Za-z0-9_$.]*)\})/g,
    "RHFField",
  );
}

function extractRegisterNames(text) {
  const matches = [];
  const regex = /register\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const entry = buildFieldEntry(text, match.index, match[1], "register");
    if (entry) {
      matches.push(entry);
    }
  }
  return matches;
}

function extractConfigFields(text) {
  const matches = [];
  const regex = /name:\s*["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const objectWindow = text.slice(match.index, match.index + 350);
    const labelMatch = objectWindow.match(/label:\s*["']([^"']+)["']/);
    const controlMatch = objectWindow.match(/control:\s*["']([^"']+)["']/);
    if (!labelMatch && !controlMatch) {
      continue;
    }
    const entry = buildFieldEntry(text, match.index, match[1], "config");
    if (!entry) {
      continue;
    }
    entry.label = labelMatch?.[1] ?? entry.label;
    entry.type = normalizeFieldType(controlMatch?.[1] ?? entry.type);
    entry.required =
      /required:\s*true/.test(objectWindow) || entry.required;
    matches.push(entry);
  }
  return matches;
}

function extractNameMatches(text, regex, source, nameGroup = 1) {
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const entry = buildFieldEntry(text, match.index, match[nameGroup], source);
    if (entry) {
      matches.push(entry);
    }
  }
  return matches;
}

function extractJsxNameMatches(text, regex, source) {
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1] ?? match[2];
    if (!name) {
      continue;
    }
    const entry = buildFieldEntry(text, match.index, name, source);
    if (entry) {
      matches.push(entry);
    }
  }
  return matches;
}

async function extractImportedConfigFields(filePath, text) {
  const imports = findCandidateConfigImports(filePath, text);
  if (imports.length === 0) {
    return [];
  }

  const entries = [];
  for (const configPath of imports) {
    const configText = await readFile(configPath, "utf8").catch(() => null);
    if (!configText) {
      continue;
    }
    const configEntries = extractConfigFields(configText).map((entry) => ({
      ...entry,
      source: "config-import",
    }));
    entries.push(...configEntries);
  }
  return entries;
}

async function extractImportedFormComponentFields(filePath, text) {
  const componentImports = findCandidateFormComponentImports(filePath, text);
  if (componentImports.length === 0) {
    return [];
  }

  const entries = [];
  for (const { importName, importPath } of componentImports) {
    const usageRegex = new RegExp(`<${importName}\\b`);
    if (!usageRegex.test(text)) {
      continue;
    }
    const componentText = await readFile(importPath, "utf8").catch(() => null);
    if (!componentText) {
      continue;
    }
    const componentEntries = await collectFields(importPath, componentText);
    for (const entry of componentEntries) {
      entries.push({
        ...entry,
        source: "imported-component",
      });
    }
  }
  return entries;
}

function findCandidateConfigImports(filePath, text) {
  const configImports = [];
  const regex =
    /import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];?/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const importedNames = match[1]
      .split(",")
      .map((name) => name.replace(/\bas\b.+$/, "").trim())
      .filter(Boolean);
    const importPath = match[2];
    const shouldLoad =
      importedNames.some((name) =>
        ["formSections", "fields", "fieldDefinitions"].includes(name),
      ) || /\/form$/.test(importPath);
    if (!shouldLoad) {
      continue;
    }
    const resolved = resolveImportPath(filePath, importPath);
    if (resolved) {
      configImports.push(resolved);
    }
  }
  return [...new Set(configImports)];
}

function findCandidateFormComponentImports(filePath, text) {
  const imports = [];
  const regex =
    /import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];?/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const importPath = match[2];
    const resolved = resolveImportPath(filePath, importPath);
    if (!resolved) {
      continue;
    }
    const importedNames = match[1]
      .split(",")
      .map((name) => name.replace(/\bas\b.+$/, "").trim())
      .filter(Boolean);
    for (const importName of importedNames) {
      if (
        /(?:FormFields|FormDialog|FormPage|Create[A-Za-z0-9]*Form|Edit[A-Za-z0-9]*Form|[A-Za-z0-9]*Form)$/.test(
          importName,
        )
      ) {
        imports.push({ importName, importPath: resolved });
      }
    }
  }
  return imports;
}

function resolveImportPath(filePath, importPath) {
  let basePath;
  if (importPath.startsWith("@/")) {
    basePath = path.join(FRONTEND_SRC, importPath.slice(2));
  } else if (importPath.startsWith(".")) {
    basePath = path.resolve(path.dirname(filePath), importPath);
  } else {
    return null;
  }

  const candidates = [basePath, `${basePath}.ts`, `${basePath}.tsx`, path.join(basePath, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function buildFieldEntry(text, index, name, source) {
  if (IGNORED_FIELD_NAMES.has(name)) {
    return null;
  }
  const { line } = indexToLineCol(text, index);
  const nextBoundary = findNextFieldBoundary(text, index);
  const forwardSegment = text.slice(index, nextBoundary);
  const registerContext = getCharWindow(text, index, 700, 240);
  const candidateId =
    (source === "register"
      ? extractTagIdAroundIndex(text, index)
      : null) ?? name;
  const label =
    (source === "register"
      ? extractMatchingHtmlLabel(registerContext, candidateId)
      : extractFormLabel(forwardSegment) ??
        extractLabelProp(forwardSegment) ??
        extractMatchingHtmlLabel(forwardSegment, candidateId)) ?? null;
  const typeContext =
    source === "register"
      ? getCharWindow(text, index, 120, 260)
      : forwardSegment;

  return {
    name,
    line,
    source,
    label,
    type: inferFieldType(typeContext) ?? inferTypeFromLabel(label),
    required: inferRequired(
      source === "register" ? registerContext : forwardSegment,
      label,
    ),
  };
}

function extractHtmlForLabels(text) {
  const labels = new Map();
  const regex =
    /<Label\b[^>]*htmlFor=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Label>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    labels.set(match[1], cleanLabel(match[2]));
  }
  return labels;
}

function extractMatchingHtmlLabel(text, candidateId) {
  const labels = extractHtmlForLabels(text);
  return labels.get(candidateId) ?? null;
}

function extractIdFromWindow(text) {
  const idMatch = text.match(/\bid=["']([^"']+)["']/);
  return idMatch?.[1] ?? null;
}

function extractTagIdAroundIndex(text, index) {
  const tagStart = text.lastIndexOf("<", index);
  const tagEnd = text.indexOf(">", index);
  if (tagStart === -1 || tagEnd === -1 || tagEnd <= tagStart) {
    return null;
  }
  return extractIdFromWindow(text.slice(tagStart, tagEnd + 1));
}

function extractLabelProp(text) {
  const labelMatch = text.match(/\blabel=["']([^"']+)["']/);
  return labelMatch ? cleanLabel(labelMatch[1]) : null;
}

function extractFormLabel(text) {
  const labelMatch = text.match(/<FormLabel\b[^>]*>([\s\S]*?)<\/FormLabel>/);
  return labelMatch ? cleanLabel(labelMatch[1]) : null;
}

function inferFieldType(text) {
  for (const [pattern, fieldType] of FIELD_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return fieldType;
    }
  }
  return null;
}

function inferTypeFromLabel(label) {
  if (!label) {
    return null;
  }
  const normalized = label.toLowerCase();

  if (normalized.includes("date")) {
    return "date";
  }
  if (
    normalized.includes("status") ||
    normalized.includes(" type") ||
    normalized.startsWith("type") ||
    normalized.includes("company") ||
    normalized.includes("contact") ||
    normalized.includes("cost code") ||
    normalized.includes("phase") ||
    normalized.includes("sector") ||
    normalized.includes("delivery method") ||
    normalized.includes("office") ||
    normalized === "state" ||
    normalized.includes("assigned to")
  ) {
    return "select";
  }
  if (
    normalized.includes("percent") ||
    normalized.includes("qty") ||
    normalized.includes("quantity") ||
    normalized.includes("square footage")
  ) {
    return "number";
  }
  if (
    normalized.includes("amount") ||
    normalized.includes("cost") ||
    normalized.includes("value") ||
    normalized.includes("retainage")
  ) {
    return "currency";
  }
  if (
    normalized.includes("description") ||
    normalized.includes("remarks") ||
    normalized.includes("scope")
  ) {
    return "textarea";
  }
  return null;
}

function inferRequired(text, label) {
  return (
    /\brequired\b/.test(text) ||
    /required:\s*true/.test(text) ||
    /text-destructive/.test(text) ||
    /\*/.test(label ?? "")
  );
}

function normalizeFieldType(type) {
  if (!type) {
    return null;
  }
  return type.replace(/^formatted-number$/, "number");
}

function cleanLabel(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\s*"([^"]+)"\s*\}/g, "$1")
    .replace(/\{\s*'([^']+)'\s*\}/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s+\*/g, " *")
    .trim();
}

function getLineWindow(text, centerLine, before, after) {
  const lines = text.split("\n");
  const startLine = Math.max(1, centerLine - before);
  const endLine = Math.min(lines.length, centerLine + after);
  return {
    startLine,
    endLine,
    text: lines.slice(startLine - 1, endLine).join("\n"),
  };
}

function getCharWindow(text, index, before, after) {
  return text.slice(
    Math.max(0, index - before),
    Math.min(text.length, index + after),
  );
}

function findNextFieldBoundary(text, index) {
  const slice = text.slice(index + 1);
  const markers = [
    /<FormField\b/,
    /<Controller\b/,
    /<RHF[A-Za-z]+Field\b/,
    /register\(\s*["']/,
    /name:\s*["']/,
  ];
  let boundary = Math.min(text.length, index + 1800);
  for (const marker of markers) {
    const match = slice.match(marker);
    if (!match || match.index == null) {
      continue;
    }
    boundary = Math.min(boundary, index + 1 + match.index);
  }
  return boundary;
}

function indexToLineCol(text, targetIndex) {
  let line = 1;
  let column = 1;
  for (let index = 0; index < targetIndex && index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function mergeFieldEntries(entries) {
  const merged = new Map();
  for (const entry of entries) {
    const key = `${entry.name}:${entry.line}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, entry);
      continue;
    }
    merged.set(key, pickBetterEntry(existing, entry));
  }

  // Collapse same field name in the same file when multiple extractors saw it.
  const deduped = new Map();
  for (const entry of merged.values()) {
    const key = entry.name;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, entry);
      continue;
    }
    deduped.set(key, pickBetterEntry(existing, entry));
  }
  return [...deduped.values()];
}

function pickBetterEntry(left, right) {
  const leftScore = scoreEntry(left);
  const rightScore = scoreEntry(right);
  if (rightScore > leftScore) {
    return right;
  }
  if (rightScore === leftScore && right.line < left.line) {
    return right;
  }
  return left;
}

function scoreEntry(entry) {
  return (
    (entry.label ? 4 : 0) +
    (entry.type ? 3 : 0) +
    (entry.required ? 1 : 0) +
    (entry.source === "config" ? 1 : 0)
  );
}

function buildStats(candidateFiles, unsupportedFiles) {
  const totalFields = candidateFiles.reduce(
    (sum, file) => sum + file.fields.length,
    0,
  );
  const missingLabels = candidateFiles.reduce(
    (sum, file) => sum + file.fields.filter((field) => !field.label).length,
    0,
  );
  const missingTypes = candidateFiles.reduce(
    (sum, file) => sum + file.fields.filter((field) => !field.type).length,
    0,
  );

  return {
    candidateFiles: candidateFiles.length,
    filesWithFields: candidateFiles.filter((file) => file.fieldCount > 0).length,
    unsupportedFiles: unsupportedFiles.length,
    totalFields,
    missingLabels,
    missingTypes,
  };
}

function minifyFileResult(file) {
  return {
    file: file.relPath,
    fieldCount: file.fieldCount,
    hasFormMarkup: file.hasFormMarkup,
    signals: file.signals,
    fields: file.fields,
  };
}

function renderMarkdownReport({
  stats,
  files,
  unsupportedFiles,
  filesWithMissingLabels,
  filesWithMissingTypes,
  summaryOnly,
}) {
  const lines = [];
  lines.push("# Form Field Inventory Audit");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Candidate files: ${stats.candidateFiles}`);
  lines.push(`- Files with extracted fields: ${stats.filesWithFields}`);
  lines.push(`- Unsupported candidate files: ${stats.unsupportedFiles}`);
  lines.push(`- Total extracted fields: ${stats.totalFields}`);
  lines.push(`- Fields missing labels: ${stats.missingLabels}`);
  lines.push(`- Fields missing types: ${stats.missingTypes}`);
  lines.push("");

  if (unsupportedFiles.length > 0) {
    lines.push("## Unsupported Candidate Files");
    lines.push("");
    for (const file of unsupportedFiles) {
      lines.push(
        `- \`${file.relPath}\` (${file.signals.join(", ") || "no signals"})`,
      );
    }
    lines.push("");
  }

  if (filesWithMissingLabels.length > 0 || filesWithMissingTypes.length > 0) {
    lines.push("## Extraction Gaps");
    lines.push("");
    if (filesWithMissingLabels.length > 0) {
      lines.push(
        `- Files with missing labels: ${filesWithMissingLabels
          .map((file) => `\`${file.relPath}\``)
          .join(", ")}`,
      );
    }
    if (filesWithMissingTypes.length > 0) {
      lines.push(
        `- Files with missing types: ${filesWithMissingTypes
          .map((file) => `\`${file.relPath}\``)
          .join(", ")}`,
      );
    }
    lines.push("");
  }

  if (summaryOnly) {
    return lines.join("\n");
  }

  lines.push("## Files");
  lines.push("");
  for (const file of files) {
    lines.push(`### \`${file.relPath}\``);
    lines.push("");
    lines.push(`- Signals: ${file.signals.join(", ") || "none"}`);
    lines.push(`- Extracted fields: ${file.fieldCount}`);
    if (file.fieldCount === 0) {
      lines.push("- Status: unsupported");
      lines.push("");
      continue;
    }
    lines.push("");
    lines.push("| Line | Name | Label | Type | Required | Source |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const field of file.fields) {
      lines.push(
        `| ${field.line} | \`${field.name}\` | ${escapeTableCell(
          field.label ?? "[missing]",
        )} | ${field.type ?? "[missing]"} | ${field.required ? "yes" : "no"} | ${field.source} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, "\\|");
}
