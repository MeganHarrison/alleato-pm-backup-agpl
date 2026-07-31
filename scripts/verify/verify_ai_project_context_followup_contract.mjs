#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const chatHandler = readFileSync(
  resolve(repoRoot, "frontend/src/lib/ai/chat-handler.ts"),
  "utf8",
);

const requiredFragments = [
  "function shouldAnswerProjectLocationDirectly",
  "function loadProjectLocationAnswer",
  "projectLocationQuestion",
  "priorProjectName",
  "formatPriorProjectContinuityContext",
  "Conversation Continuity Guardrail",
  "projectLocationContextLookup",
  "strategist-project-location",
  "locationRagQuery",
  "appendLocationRagFallback",
  "ragFallbackAttempted",
  "semanticSearch timed out during project location fallback retrieval",
  "Union Collective",
  "addressPresent",
  "statePresent",
];

const failures = requiredFragments
  .filter((fragment) => !chatHandler.includes(fragment))
  .map((fragment) => `chat handler missing project-location follow-up fragment: ${fragment}`);

const locationBranchBeforeStream =
  chatHandler.indexOf("if (projectLocationQuestion)") > -1 &&
  chatHandler.indexOf("if (projectLocationQuestion)") < chatHandler.indexOf("const result = streamText");

if (!locationBranchBeforeStream) {
  failures.push("project location follow-up must resolve before generic streamText fallback");
}

const priorContextBeforeLookup =
  chatHandler.indexOf("const priorProjectName = extractPriorProjectName(messages)") > -1 &&
  chatHandler.indexOf("priorProjectName,", chatHandler.indexOf("if (projectLocationQuestion)")) >
    chatHandler.indexOf("const priorProjectName = extractPriorProjectName(messages)");

if (!priorContextBeforeLookup) {
  failures.push("project location lookup must receive priorProjectName from conversation history");
}

if (failures.length > 0) {
  console.error("AI project-context follow-up verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("AI project-context follow-up verification passed.");
