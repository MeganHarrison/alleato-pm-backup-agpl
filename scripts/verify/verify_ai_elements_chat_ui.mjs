#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..", "..");

const sourceFiles = execFileSync("rg", ["--files", "frontend/src"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => /\.(tsx|ts)$/.test(file));

const failures = [];

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function fail(message) {
  failures.push(message);
}

for (const file of sourceFiles) {
  const source = read(file);

  if (
    source.includes("@/components/chat/prompt-input") ||
    source.includes("@/components/elements/prompt-input")
  ) {
    fail(`${file} imports a deprecated prompt input path; use @/components/ai-elements/prompt-input`);
  }

  if (!file.endsWith(".tsx")) continue;

  const ownsAiSdkChat =
    source.includes("useChat(") || source.includes("useChat({");
  const rendersMessages =
    source.includes("messages.map((message) => (") ||
    source.includes("messages.map((msg) => (");

  if (!ownsAiSdkChat || !rendersMessages) continue;
  if (source.includes("<ChatArea")) continue;

  const hasMessageElement = source.includes("@/components/ai-elements/message");
  const hasConversationElement = source.includes("@/components/ai-elements/conversation");
  const hasPromptInputElement = source.includes("@/components/ai-elements/prompt-input");

  if (!hasMessageElement) {
    fail(`${file} renders AI SDK messages without ai-elements/message`);
  }

  if (!hasConversationElement) {
    fail(`${file} renders AI SDK messages without ai-elements/conversation auto-scroll`);
  }

  if (!hasPromptInputElement) {
    fail(`${file} owns an AI SDK chat input without ai-elements/prompt-input`);
  }

  if (source.includes("messagesEndRef") || source.includes("scrollIntoView({ behavior")) {
    fail(`${file} uses manual chat scrolling; use Conversation from ai-elements`);
  }
}

const report = {
  status: failures.length === 0 ? "pass" : "fail",
  checkedAt: new Date().toISOString(),
  checkedFiles: sourceFiles.length,
  failures,
};

console.log(JSON.stringify(report, null, 2));

if (failures.length > 0) {
  process.exit(1);
}
