#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredFiles = [
  "frontend/src/lib/ai/tool-registry.ts",
  "frontend/src/lib/ai/__tests__/tool-registry.test.ts",
  "frontend/src/lib/ai-ops/tool-registry.ts",
  "frontend/src/lib/ai-ops/__tests__/workflow-pack.test.ts",
];

const failures = [];

const approvedDirectToolDefinitionFiles = new Map([
  [
    "frontend/src/lib/ai/assistant-self-knowledge.ts",
    "Self-inspection tools are not part of the Eve production catalog.",
  ],
  [
    "frontend/src/lib/ai/tools/action-tools.ts",
    "Approved assistant factory; runtime exposure is filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/asrs-intelligence.ts",
    "Approved assistant factory; runtime exposure is filtered by the global registry.",
  ],
  // Domain files extracted from the approved aggregate factories. They are
  // composed exclusively by createActionTools / createProjectTools and share
  // those factories' registry filtering — same justification as the parents.
  [
    "frontend/src/lib/ai/tools/read/communication-search-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/read/email-search-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/read/implementation-status-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/read/meeting-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/read/memory-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/read/project-data-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/read/rag-search-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/change-order-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/commitment-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/communication-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/company-contact-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/implementation-dispatch-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/misc-write-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/prime-contract-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/rfi-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/submittal-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/write/task-tools.ts",
    "Composed by createActionTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/acumatica.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/app-help-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/create-document.ts",
    "Document artifact UI helper; not currently exposed by the Eve production catalog.",
  ],
  [
    "frontend/src/lib/ai/tools/document-intelligence.ts",
    "Approved assistant factory; runtime exposure is filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/executive-brief-tools.ts",
    "Approved assistant factory; runtime exposure is filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/financial.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/forecast-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/get-weather.ts",
    "Standalone demo/weather helper; not currently exposed by the Eve production catalog.",
  ],
  [
    "frontend/src/lib/ai/tools/marketing.ts",
    "Approved assistant factory; runtime exposure is filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/operational.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/outlook-operations.ts",
    "Composed by createProjectTools and filtered by the Eve production catalog.",
  ],
  [
    "frontend/src/lib/ai/tools/progress-report-tools.ts",
    "Approved assistant factory; runtime exposure is filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/project-tools.ts",
    "Approved aggregate assistant factory; runtime exposure is filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/request-suggestions.ts",
    "Suggestion helper; not currently exposed by the Eve production catalog.",
  ],
  [
    "frontend/src/lib/ai/tools/schedule-tools.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/search-past-conversations.ts",
    "Composed by createProjectTools and filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/structured-output.ts",
    "Approved assistant factory; runtime exposure is filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/structured-queries.ts",
    "Structured query helper; not currently exposed by the Eve production catalog.",
  ],
  [
    "frontend/src/lib/ai/tools/update-document.ts",
    "Document artifact UI helper; not currently exposed by the Eve production catalog.",
  ],
  [
    "frontend/src/lib/ai/tools/web-search.ts",
    "Approved assistant factory; runtime exposure is filtered by the global registry.",
  ],
  [
    "frontend/src/lib/ai/tools/workspace-tools.ts",
    "Approved assistant factory; runtime exposure is filtered by the global registry.",
  ],
]);

for (const file of requiredFiles) {
  const absolutePath = path.join(repoRoot, file);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${file}: required registry file is missing`);
  }
}

const executiveRegistryPath = path.join(
  repoRoot,
  "frontend/src/lib/ai-ops/tool-registry.ts",
);

if (fs.existsSync(executiveRegistryPath)) {
  const source = fs.readFileSync(executiveRegistryPath, "utf8");
  if (!source.includes('from "@/lib/ai/tool-registry"')) {
    failures.push(
      "frontend/src/lib/ai-ops/tool-registry.ts: Executive Daily Brief registry must import the global assistant registry",
    );
  }
  if (source.includes("WORKFLOW_TOOL_DEFINITIONS")) {
    failures.push(
      "frontend/src/lib/ai-ops/tool-registry.ts: workflow-local tool definition arrays are forbidden; use the global assistant registry",
    );
  }
  if (source.includes("sourceAdapterToolDefinitions")) {
    failures.push(
      "frontend/src/lib/ai-ops/tool-registry.ts: source adapter tool definitions must come through the global assistant registry",
    );
  }
}

const globalRegistryPath = path.join(
  repoRoot,
  "frontend/src/lib/ai/tool-registry.ts",
);
const eveRegistryPath = path.join(
  repoRoot,
  "frontend/src/lib/ai/eve-runtime/production-tool-registry.ts",
);

if (fs.existsSync(globalRegistryPath)) {
  const source = fs.readFileSync(globalRegistryPath, "utf8");
  for (const requiredExport of [
    "GLOBAL_ASSISTANT_TOOL_REGISTRY",
    "validateAssistantToolRegistry",
    "assistantToolsForWorkflow",
    "toolDefinitionsForWorkflow",
  ]) {
    if (!source.includes(requiredExport)) {
      failures.push(
        `frontend/src/lib/ai/tool-registry.ts: missing ${requiredExport}`,
      );
    }
  }
}

if (fs.existsSync(eveRegistryPath)) {
  const source = fs.readFileSync(eveRegistryPath, "utf8");
  for (const requiredExport of [
    "createProductionEveRequestCatalog",
    "EVE_TOOL_MANIFEST",
    "assertProductionEveToolRegistryComplete",
  ]) {
    if (!source.includes(requiredExport)) {
      failures.push(
        `frontend/src/lib/ai/eve-runtime/production-tool-registry.ts: missing ${requiredExport}`,
      );
    }
  }
}

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return listSourceFiles(absolutePath);
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [absolutePath];
  });
}

for (const absolutePath of [
  ...listSourceFiles(path.join(repoRoot, "frontend/src/lib/ai")),
  ...listSourceFiles(path.join(repoRoot, "frontend/src/app")),
]) {
  const relativePath = path
    .relative(repoRoot, absolutePath)
    .split(path.sep)
    .join("/");
  const source = fs.readFileSync(absolutePath, "utf8");
  if (!/\btool\s*\(\s*\{/.test(source)) continue;
  if (!approvedDirectToolDefinitionFiles.has(relativePath)) {
    failures.push(
      `${relativePath}: direct tool({ ... }) definitions must be registered or added to the explicit non-assistant allowlist`,
    );
  }
}

if (failures.length > 0) {
  console.error("AI assistant tool registry guardrail failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("AI assistant tool registry guardrail passed.");
