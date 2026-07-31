#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultStandaloneRoot = path.resolve(repoRoot, "../github/alleato-ai");
const standaloneRoot = path.resolve(
  process.env.ALLEATO_AI_STANDALONE_REPO || defaultStandaloneRoot,
);

const exactMirrors = [
  ["tools/actions.py", "backend/src/services/agents/alleato_ai_tools/actions.py"],
  ["tools/think.py", "backend/src/services/agents/alleato_ai_tools/think.py"],
  ["tools/_retry.py", "backend/src/services/agents/alleato_ai_tools/_retry.py"],
];

const knownDivergentMirrors = [
  ["tools/db.py", "backend/src/services/agents/alleato_ai_tools/db.py", "backend import path and runtime env handling"],
  ["tools/recent.py", "backend/src/services/agents/alleato_ai_tools/recent.py", "backend import path"],
  ["tools/resolvers.py", "backend/src/services/agents/alleato_ai_tools/resolvers.py", "backend import path"],
  ["tools/pm.py", "backend/src/services/agents/alleato_ai_tools/pm.py", "backend import path"],
  ["tools/graph_api.py", "backend/src/services/agents/alleato_ai_tools/graph_api.py", "backend import path"],
  ["tools/acumatica.py", "backend/src/services/agents/alleato_ai_tools/acumatica.py", "backend env handling"],
  ["tools/rag.py", "backend/src/services/agents/alleato_ai_tools/rag.py", "backend env handling"],
  ["tools/rerank.py", "backend/src/services/agents/alleato_ai_tools/rerank.py", "backend provider handling"],
  ["prompts/orchestrator.md", "backend/src/services/agents/alleato_ai_tools/prompts/orchestrator.md", "backend prompt currently ahead"],
  ["prompts/soul.md", "backend/src/services/agents/alleato_ai_tools/prompts/soul.md", "backend prompt currently ahead"],
  ["prompts/_subagent_output_rule.md", "backend/src/services/agents/alleato_ai_tools/prompts/_subagent_output_rule.md", "shared subagent contract"],
  ["prompts/financial_analyst.md", "backend/src/services/agents/alleato_ai_tools/prompts/financial_analyst.md", "shared prompt with backend import surface"],
  ["prompts/risk_analyst.md", "backend/src/services/agents/alleato_ai_tools/prompts/risk_analyst.md", "shared prompt with backend import surface"],
  ["prompts/communications_analyst.md", "backend/src/services/agents/alleato_ai_tools/prompts/communications_analyst.md", "shared prompt with backend import surface"],
  ["subagents/__init__.py", "backend/src/services/agents/alleato_ai_tools/subagents.py", "backend adds tool gates and structured output schemas"],
];

const requiredBackendSubagentContracts = [
  "FinancialAnalystPacket",
  "RiskAnalystPacket",
  "CommunicationsAnalystPacket",
  '"business-development-analyst"',
];

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function rel(root, filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function fileExists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const failures = [];
const warnings = [];
const mirrorStatus = [];

if (!fs.existsSync(standaloneRoot)) {
  failures.push(
    `Standalone alleato-ai repo not found at ${standaloneRoot}. Set ALLEATO_AI_STANDALONE_REPO to verify another checkout.`,
  );
} else {
  for (const [standaloneRelative, backendRelative] of exactMirrors) {
    const standaloneFile = path.join(standaloneRoot, "alleato_ai", standaloneRelative);
    const backendFile = path.join(repoRoot, backendRelative);
    if (!fs.existsSync(standaloneFile) || !fs.existsSync(backendFile)) {
      failures.push(`Missing exact mirror pair: ${standaloneFile} <-> ${backendFile}`);
      continue;
    }
    const matches = readText(standaloneFile) === readText(backendFile);
    mirrorStatus.push({
      standalone: rel(standaloneRoot, standaloneFile),
      backend: rel(repoRoot, backendFile),
      status: matches ? "exact" : "drifted",
    });
    if (!matches) {
      failures.push(
        `Unexpected exact-mirror drift: ${rel(standaloneRoot, standaloneFile)} differs from ${rel(
          repoRoot,
          backendFile,
        )}. Consolidate or move this pair to the known-divergence list with a reason.`,
      );
    }
  }

  for (const [standaloneRelative, backendRelative, reason] of knownDivergentMirrors) {
    const standaloneFile = path.join(standaloneRoot, "alleato_ai", standaloneRelative);
    const backendFile = path.join(repoRoot, backendRelative);
    if (!fs.existsSync(standaloneFile) || !fs.existsSync(backendFile)) {
      warnings.push(`Known-divergence pair is incomplete: ${standaloneRelative} <-> ${backendRelative}`);
      continue;
    }
    mirrorStatus.push({
      standalone: rel(standaloneRoot, standaloneFile),
      backend: rel(repoRoot, backendFile),
      status: readText(standaloneFile) === readText(backendFile) ? "converged" : "known-divergent",
      reason,
    });
  }

  for (const requiredFile of [
    "alleato_ai/prompts/business_development_analyst.md",
    "alleato_ai/schemas.py",
  ]) {
    if (!fileExists(standaloneRoot, requiredFile)) {
      warnings.push(`Standalone repo is missing ${requiredFile}; backend is currently ahead.`);
    }
  }
}

const backendSubagents = readText(
  path.join(repoRoot, "backend/src/services/agents/alleato_ai_tools/subagents.py"),
);
for (const token of requiredBackendSubagentContracts) {
  if (!backendSubagents.includes(token)) {
    failures.push(`Backend subagent surface is missing required consolidation token ${token}.`);
  }
}

const result = {
  backendRepo: repoRoot,
  standaloneRepo: standaloneRoot,
  exactMirrorCount: exactMirrors.length,
  knownDivergentCount: knownDivergentMirrors.length,
  mirrorStatus,
  warnings,
};

if (failures.length > 0) {
  console.error("alleato_ai_tools consolidation check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnings.length > 0) {
    console.error("Warnings:");
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log("alleato_ai_tools consolidation check passed");
console.log(JSON.stringify(result, null, 2));
