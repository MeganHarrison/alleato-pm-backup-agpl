#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");

const files = {
  route: "frontend/src/app/api/ai-assistant/chat/route.ts",
  handlerV2: "frontend/src/app/api/ai-assistant/chat/handler-v2.ts",
  orchestrator: "frontend/src/lib/ai/orchestrator.ts",
  strategist: "frontend/src/lib/ai/agents/strategist.ts",
  botCore: "frontend/src/lib/ai/bot-core.ts",
  projectTools: "frontend/src/lib/ai/tools/project-tools.ts",
  financialTools: "frontend/src/lib/ai/tools/financial.ts",
  operationalTools: "frontend/src/lib/ai/tools/operational.ts",
  failureResponse: "frontend/src/lib/ai/strategist-failure-response.ts",
};

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

const checks = [
  {
    file: files.route,
    description: "chat route delegates to the v2 handler under API guardrails",
    test: (content) =>
      content.includes("withApiGuardrails") &&
      content.includes("handleChatV2") &&
      content.includes("flushLangfuse") &&
      content.includes("maxDuration = 300"),
  },
  {
    file: files.failureResponse,
    description: "strategist failure response explains cause, confirmed sources, and next step",
    test: (content) =>
      content.includes("What happened:") &&
      content.includes("What I could confirm:") &&
      content.includes("What that means:") &&
      content.includes("persisted tool trace"),
  },
  {
    file: files.handlerV2,
    description: "chat handler plans retrieval, assembles context, and runs AI SDK strategist tools",
    test: (content) =>
      content.includes("planRetrieval") &&
      content.includes("executeRetrievalPlan") &&
      content.includes("assembleSystemPromptFromContext") &&
      content.includes("createStrategistTools(args.user.id") &&
      content.includes("includeActionTools: true") &&
      content.includes("tools,") &&
      content.includes("stopWhen: stepCountIs(6)") &&
      content.includes("tool_count: Object.keys(tools).length"),
  },
  {
    file: files.orchestrator,
    description: "strategist tool registry exposes inspectable tool names and write guardrails",
    test: (content) =>
      content.includes("createStrategistTools") &&
      content.includes("allowWrites: Boolean(options.includeActionTools)") &&
      content.includes("filterRegisteredToolSet") &&
      content.includes("availableToolNames: Object.keys(toolsWithoutSelfInspection).sort()"),
  },
  {
    file: files.handlerV2,
    description: "chat handler streams live AI SDK status data before long retrieval work",
    test: (content) =>
      content.includes('type: "data-status"') &&
      content.includes("Plan: ${plan.reason}") &&
      content.includes("Searching project knowledge") &&
      content.includes("Retrieved (${Object.keys(retrievalCtx.durationsMs).length} sources"),
  },
  {
    file: files.handlerV2,
    description: "chat handler traces canonical project briefing snapshot retrieval",
    test: (content) =>
      content.includes("getProjectBriefingSnapshot") &&
      content.includes('agent: "retrieval-planner-v2"') &&
      content.includes("ctx.projectSnapshot") &&
      content.includes("durationsMs.project_snapshot"),
  },
  {
    file: files.strategist,
    description: "strategist prompt enforces natural strategic responses and project briefing structure",
    test: (content) =>
      content.includes("Broad Project Update Contract") &&
      content.includes("Hard Facts") &&
      content.includes("What Changed") &&
      content.includes("Insider Analysis") &&
      content.includes("Recommended Actions") &&
      content.includes("Next Step"),
  },
  {
    file: files.botCore,
    description: "prompt assembly surfaces context health instead of silent failures",
    test: (content) =>
      content.includes("Runtime Context Health") &&
      content.includes("Memory and learning context could not be loaded") &&
      content.includes("Pinned project context could not be loaded"),
  },
  {
    file: files.projectTools,
    description: "project tools return structured retrieval errors and canonical briefing snapshot",
    test: (content) =>
      content.includes("This data source failed during retrieval") &&
      content.includes("getProjectBriefingSnapshot") &&
      content.includes("recommendedQuestions") &&
      content.includes("alwaysEndWithForwardMotion") &&
      !content.includes("throw error;\n    }\n  };\n}\n\nexport function createProjectTools"),
  },
  {
    file: files.financialTools,
    description: "financial tools return structured retrieval errors",
    test: (content) =>
      content.includes("This financial data source failed during retrieval") &&
      !content.includes("throw error;\n    }\n  };\n}\n\n// ---------------------------------------------------------------------------\n// Helpers"),
  },
  {
    file: files.operationalTools,
    description: "operational tools return structured retrieval errors",
    test: (content) =>
      content.includes("This operational knowledge source failed during retrieval") &&
      !content.includes("throw error;\n    }\n  };\n}\n\n// ---------------------------------------------------------------------------\n// Helpers"),
  },
];

const failures = [];

for (const check of checks) {
  const content = read(check.file);
  if (!check.test(content)) {
    failures.push(`${check.file}: ${check.description}`);
  }
}

if (failures.length > 0) {
  console.error("AI assistant response contract verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("AI assistant response contract verification passed.");
