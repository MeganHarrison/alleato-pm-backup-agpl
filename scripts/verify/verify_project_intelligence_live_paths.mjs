#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { assertRetiredCompilerIngressAbsent } from "../../project-intelligence/core/ownership-contract.mjs";

const root = process.cwd();

const removedFiles = [
  "backend/src/services/intelligence/operating_summary.py",
  "backend/src/services/agents/deep_project_intelligence.py",
  "backend/src/services/agents/deep_project_intelligence_contracts.py",
  "backend/src/scripts/refresh_operating_packet_direct.py",
  "backend/src/scripts/enqueue_periodic_packet_refresh.py",
  "backend/src/scripts/repair_intelligence_jobs.py",
  "backend/tests/test_project_operating_summary.py",
  "backend/unit_tests/test_task_extraction_training_examples.py",
  "frontend/src/lib/ai/services/project-operating-summary-sources.ts",
  "frontend/src/components/ai-intelligence/project-intelligence-cross-reference.tsx",
  "frontend/src/app/api/admin/intelligence-compiler/run/route.ts",
  "frontend/src/app/api/admin/intelligence-compiler/status/route.ts",
  "frontend/src/app/api/admin/intelligence-compiler/_shared.ts",
  "frontend/src/app/(admin)/intelligence-compiler/page.tsx",
  "frontend/src/components/ai-intelligence/intelligence-compiler-health-panel.tsx",
  "frontend/src/lib/ai/deep-agent-project-status.ts",
  "frontend/src/lib/ai/__tests__/deep-agent-project-status.test.ts",
  "scripts/verify/verify_ai_packet_synthesis_quality.mjs",
  "scripts/verify/repair_ai_intelligence_current_packet_links.mjs",
  "scripts/verify/verify_ai_intelligence_compiler_health.mjs",
];

const liveFiles = [
  "render.yaml",
  "backend/src/api/main.py",
  "backend/src/services/scheduler.py",
  "frontend/src/app/api/ai-assistant/chat/handler-v2.ts",
  "frontend/src/lib/ai/deep-agent-bridge.ts",
  "frontend/src/lib/ai/retrieval/deps.ts",
  "frontend/src/app/api/admin/operations-readiness/status/route.ts",
  "frontend/src/components/ai-intelligence/source-sync-health-panel.tsx",
  "frontend/src/lib/navigation-config.ts",
  "scripts/ops/suspend-render-db-pressure-crons.mjs",
  "scripts/verify/verify-render-web-scheduler-disabled.mjs",
  "scripts/verify/verify-live-db-incident.mjs",
  "docs/alleato-os-docs/project-intelligence/index.mdx",
  "docs/alleato-os-docs/project-intelligence/current-state.mdx",
  "docs/alleato-os-docs/project-intelligence/activation-runbook.mdx",
  "docs/alleato-os-docs/project-intelligence/verification.mdx",
];

const forbiddenLiveTerms = [
  "project-operating-summary-v1",
  "project_operating_summary",
  "operating_summary.py",
  "refresh_operating_packet_direct",
  "enqueue_periodic_packet_refresh",
  "alleato-packet-refresh-periodic",
  "alleato-intelligence-compiler-drain",
  "alleato-task-extraction",
  "INTELLIGENCE_USE_OPERATING_SUMMARY_COMPILER",
  "DEEP_AGENTS_PROJECT_INTELLIGENCE",
  "deep-agent-project-status",
  "deep_project_intelligence",
  "admin/intelligence-compiler",
  "intelligence-compiler",
  "/api/intelligence/projects/operating-summary",
  "/api/intelligence/compiler/run",
  "/api/intelligence/compiler/status",
  "/api/intelligence/deep-agent/project-status",
  "/api/intelligence/deep-agent/executive-briefing",
];

const requiredLiveTerms = [
  {
    file: "docs/architecture/AI-RAG-ARCHITECTURE.md",
    term: "backend/src/services/intelligence/project_intelligence.py",
  },
  {
    file: "docs/architecture/AI-RAG-ARCHITECTURE.md",
    term: "project_intelligence_synthesis_v1",
  },
  {
    file: "docs/architecture/AI-RAG-ARCHITECTURE.md",
    term: "refresh_project_intelligence",
  },
];

const failures = [];

try {
  assertRetiredCompilerIngressAbsent({ root });
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

for (const relativeFile of removedFiles) {
  if (fs.existsSync(path.join(root, relativeFile))) {
    failures.push(`deprecated file still exists: ${relativeFile}`);
  }
}

for (const relativeFile of liveFiles) {
  const absoluteFile = path.join(root, relativeFile);
  if (!fs.existsSync(absoluteFile)) {
    failures.push(`live source-of-truth file is missing: ${relativeFile}`);
    continue;
  }
  const content = fs.readFileSync(absoluteFile, "utf8");
  for (const term of forbiddenLiveTerms) {
    if (content.includes(term)) {
      failures.push(`${relativeFile} contains deprecated live-path term: ${term}`);
    }
  }
}

for (const { file, term } of requiredLiveTerms) {
  const absoluteFile = path.join(root, file);
  if (!fs.existsSync(absoluteFile)) continue;
  const content = fs.readFileSync(absoluteFile, "utf8");
  if (!content.includes(term)) {
    failures.push(`${file} is missing required live-path term: ${term}`);
  }
}

if (failures.length > 0) {
  console.error("[FAIL] Project Intelligence live-path guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[PASS] Project Intelligence live-path guard passed.");
