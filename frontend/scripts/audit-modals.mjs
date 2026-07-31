#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");

const SYSTEM_PATTERNS = {
  dialog: /from\s+["']@\/components\/ui\/dialog["']/,
  unified: /from\s+["']@\/components\/ui\/unified-modal["']/,
  legacyAnimated: /from\s+["']@\/components\/ui\/modal\/animated-modal["']/,
  legacyModal: /from\s+["']@\/components\/ui\/modal\/modal["']/,
  budgetBaseModal: /from\s+["'](?:@\/components\/budget\/modals\/BaseModal|\.\/BaseModal)["']/,
  budgetBaseSidebar: /from\s+["'](?:@\/components\/budget\/modals\/BaseSidebar|\.\/BaseSidebar)["']/,
};

async function walk(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, files);
      continue;
    }
    if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function isModalCandidate(filePath, content) {
  if (/(modal|dialog)\.(tsx|ts)$/i.test(filePath)) return true;
  if (/<(Dialog|Modal|Sheet|Drawer)\b/.test(content)) return true;
  return false;
}

function collectSystems(content) {
  return {
    dialog: SYSTEM_PATTERNS.dialog.test(content),
    unified: SYSTEM_PATTERNS.unified.test(content),
    legacyAnimated: SYSTEM_PATTERNS.legacyAnimated.test(content),
    legacyModal: SYSTEM_PATTERNS.legacyModal.test(content),
    budgetBaseModal: SYSTEM_PATTERNS.budgetBaseModal.test(content),
    budgetBaseSidebar: SYSTEM_PATTERNS.budgetBaseSidebar.test(content),
  };
}

function analyzeFile(filePath, content) {
  if (!isModalCandidate(filePath, content)) {
    return [];
  }

  const systems = collectSystems(content);
  const findings = [];
  const rel = path.relative(ROOT, filePath);
  const systemCount = Object.values(systems).filter(Boolean).length;
  const isBudgetModalFile =
    rel.includes(`${path.sep}components${path.sep}budget${path.sep}`) &&
    /(modal|dialog)\.tsx$/i.test(rel);
  const isBudgetOverlayFile =
    isBudgetModalFile || rel.endsWith(`budget${path.sep}original-budget-edit-modal.tsx`);
  const isBudgetBaseFile = /Base(Modal|Sidebar)\.tsx$/.test(rel);

  if (systems.legacyAnimated || systems.legacyModal) {
    findings.push({
      severity: "ERROR",
      rule: "legacy-modal-system",
      file: rel,
      detail: "Uses legacy `@/components/ui/modal/*` primitives.",
    });
  }

  if (systemCount > 1) {
    findings.push({
      severity: "WARN",
      rule: "mixed-modal-systems",
      file: rel,
      detail: "File imports multiple modal systems.",
    });
  }

  if (
    isBudgetModalFile &&
    !isBudgetBaseFile &&
    !systems.budgetBaseModal &&
    !systems.budgetBaseSidebar &&
    (systems.dialog || systems.unified || systems.legacyAnimated || systems.legacyModal)
  ) {
    findings.push({
      severity: "WARN",
      rule: "budget-modal-not-on-base-wrapper",
      file: rel,
      detail: "Budget modal/dialog does not use BaseModal/BaseSidebar wrappers.",
    });
  }

  if (isBudgetOverlayFile && /TabsTrigger/.test(content) && !content.includes("style-tokens")) {
    findings.push({
      severity: "WARN",
      rule: "budget-tabs-not-standardized",
      file: rel,
      detail: "Budget overlay defines tabs without shared modal tab style tokens.",
    });
  }

  if (isBudgetOverlayFile && /RadioGroupItem/.test(content) && !content.includes("style-tokens")) {
    findings.push({
      severity: "WARN",
      rule: "budget-radio-not-standardized",
      file: rel,
      detail: "Budget overlay defines radio options without shared radio card style token.",
    });
  }

  if (isBudgetOverlayFile && /(orange|yellow|amber|slate)-(50|100|200|300|400|500|600|700|800|900)/.test(content)) {
    findings.push({
      severity: "WARN",
      rule: "budget-hardcoded-palette",
      file: rel,
      detail: "Hardcoded palette classes detected in budget overlay; use semantic tokens.",
    });
  }

  if (
    (systems.dialog || systems.unified) &&
    /className=\{?["'`][^"'`]*max-w-\[[^"'`]*["'`]\}?/.test(content)
  ) {
    findings.push({
      severity: "INFO",
      rule: "custom-dialog-width",
      file: rel,
      detail: "Custom arbitrary dialog width detected; verify against modal baseline.",
    });
  }

  return findings;
}

async function main() {
  const files = await walk(SRC_DIR);
  const findings = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    findings.push(...analyzeFile(filePath, content));
  }

  const sorted = findings.sort((a, b) => {
    const sevOrder = { ERROR: 0, WARN: 1, INFO: 2 };
    const sevDiff = sevOrder[a.severity] - sevOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.file.localeCompare(b.file);
  });

  const totals = sorted.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    { ERROR: 0, WARN: 0, INFO: 0 },
  );

  console.log("Modal Consistency Audit");
  console.log(`Files scanned: ${files.length}`);
  console.log(
    `ERROR: ${totals.ERROR} | WARN: ${totals.WARN} | INFO: ${totals.INFO}`,
  );
  console.log("");
  console.log("severity\trule\tfile\tdetail");

  for (const finding of sorted) {
    console.log(
      [finding.severity, finding.rule, finding.file, finding.detail].join("\t"),
    );
  }

  if (totals.ERROR > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
