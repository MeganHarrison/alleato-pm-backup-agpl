#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const retiredExperimentDirectory = ["eve", "canary"].join("-");
const migrationComparisonTerm = ["par", "ity"].join("");

const requiredCanonicalPaths = [
  "agents/alleato-assistant/agent/agent.ts",
  "agents/alleato-assistant/agent/channels/eve.ts",
  "frontend/src/app/api/ai-assistant/eve/proxy/[...path]/route.ts",
  "frontend/src/app/api/ai-assistant/eve/tools/route.ts",
  "frontend/src/lib/ai/assistant-turn/assistant-turn.ts",
  "frontend/src/lib/ai/eve-runtime/production-tool-registry.ts",
  "backend/src/services/agents/app_expert/runtime/generated/app-sitemap.generated.json",
  "backend/src/services/agents/app_expert/runtime/generated/feature-registry.generated.json",
];

const forbiddenRuntimeFragments = [
  {
    file: "backend/src/api/main.py",
    value: '"/api/pipeline/process"',
    message: "Retired FastAPI pipeline compatibility ingress is present",
  },
  {
    file: "backend/src/services/ingestion/fireflies_pipeline.py",
    value: "_extract_meeting_memories",
    message: "Retired meeting-memory mutation helper is present",
  },
  {
    file: "frontend/src/app/api/ai-assistant/eve/tools/route.ts",
    value: "randomUUID()",
    message: "Eve bridge still invents tool-call identity",
  },
];

const forbiddenLegacyPaths = [
  "agents/app-expert-eve-lab",
  "scripts/verify/verify_ai_strategist_frontend_conversation.mjs",
  "frontend/src/app/api/ai-assistant/turns/runtime/route.ts",
  "frontend/src/app/api/ai-assistant/chat",
  "frontend/src/app/(main)/ai-assistant",
  "frontend/src/lib/ai/bot-core.ts",
  "frontend/src/lib/ai/orchestrator.ts",
  "frontend/src/lib/ai/agents",
  "frontend/src/lib/ai/persona-and-memory.ts",
  "frontend/src/lib/ai/intent-router.ts",
  "frontend/src/lib/ai/deep-agent-bridge.ts",
  "frontend/src/lib/ai/detect-rag-request.ts",
  "frontend/src/lib/ai/retrieval/planner.ts",
  "frontend/src/lib/ai/retrieval/executor.ts",
  "frontend/src/lib/ai/retrieval/deps.ts",
  "frontend/src/lib/ai/retrieval/source-specific-rag.ts",
  "frontend/src/lib/ai/services/conversation-memory.ts",
  "frontend/src/lib/ai/services/memory-extraction.ts",
  "docs/architecture/EVE-MIGRATION-ASSESSMENT.md",
  "docs/architecture/AI-ASSISTANT-APP-EXPERT-STRUCTURE.md",
  "docs/architecture/_audit/frontend-orchestration-inventory.md",
  "docs/architecture/_audit/frontend-tools-inventory.md",
  "docs/architecture/ai-rag-architecture.html",
  `frontend/src/lib/ai/${retiredExperimentDirectory}`,
  `frontend/src/lib/ai/eve-runtime/${migrationComparisonTerm}.ts`,
  `frontend/src/lib/ai/eve-runtime/__tests__/${migrationComparisonTerm}.test.ts`,
];

const forbiddenLegacyReferences = [
  {
    file: "package.json",
    value: "rag:verify:strategist-frontend",
  },
  {
    file: "package.json",
    value: "rag:verify:source-specific",
  },
  {
    file: "pnpm-lock.yaml",
    value: "agents/app-expert-eve-lab",
  },
  {
    file: "package-lock.json",
    value: "agents/app-expert-eve-lab",
  },
];

const failures = [];

const forbiddenRegistryMarkers = [
  ["Par", "ityRuntime"].join(""),
  ["LEGACY_ASSISTANT", "EXPECTED_TOOL_NAMES"].join("_"),
  ["legacy", "ExpectedCount"].join(""),
  ["legacy", "Factory"].join(""),
  ["EXCLUDED_LEGACY", "SPECIALIST_TOOLS"].join("_"),
];

for (const relativePath of requiredCanonicalPaths) {
  if (!existsSync(path.join(repoRoot, relativePath))) {
    failures.push(`Missing canonical Eve runtime owner: ${relativePath}`);
  }
}

for (const relativePath of forbiddenLegacyPaths) {
  if (existsSync(path.join(repoRoot, relativePath))) {
    failures.push(`Forbidden legacy assistant owner is present: ${relativePath}`);
  }
}

for (const { file, value } of forbiddenLegacyReferences) {
  const absolutePath = path.join(repoRoot, file);
  if (existsSync(absolutePath) && readFileSync(absolutePath, "utf8").includes(value)) {
    failures.push(`Forbidden legacy assistant reference "${value}" is present in ${file}`);
  }
}

for (const { file, value, message } of forbiddenRuntimeFragments) {
  const absolutePath = path.join(repoRoot, file);
  if (
    existsSync(absolutePath) &&
    readFileSync(absolutePath, "utf8").includes(value)
  ) {
    failures.push(`${message}: ${file}`);
  }
}

for (const [file, countKey] of [
  [
    "backend/src/services/agents/app_expert/runtime/generated/app-sitemap.generated.json",
    "routeCount",
  ],
  [
    "backend/src/services/agents/app_expert/runtime/generated/feature-registry.generated.json",
    "featureCount",
  ],
]) {
  const absolutePath = path.join(repoRoot, file);
  if (!existsSync(absolutePath)) continue;
  const generated = JSON.parse(readFileSync(absolutePath, "utf8"));
  if (!Number.isInteger(generated[countKey]) || generated[countKey] < 1) {
    failures.push(`${file} has invalid ${countKey}`);
  }
}

const eveRuntimeRoot = path.join(repoRoot, "frontend/src/lib/ai/eve-runtime");
if (existsSync(eveRuntimeRoot)) {
  const pending = [eveRuntimeRoot];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
        continue;
      }

      const relativePath = path.relative(repoRoot, absolutePath);
      if (entry.name.toLowerCase().includes(migrationComparisonTerm)) {
        failures.push(`Forbidden Eve migration scaffolding is present: ${relativePath}`);
      }

      const source = readFileSync(absolutePath, "utf8");
      for (const marker of forbiddenRegistryMarkers) {
        if (source.includes(marker)) {
          failures.push(
            `Forbidden Eve migration marker "${marker}" is present in ${relativePath}`,
          );
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Eve-only runtime guardrail failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Eve-only runtime guardrail passed: one canonical generation owner, no retired owners or registry scaffolding.",
);
