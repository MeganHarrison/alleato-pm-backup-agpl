import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, "docs", "alleato-os-docs");
const pagePath = path.join(
  docsRoot,
  "developer-docs",
  "agent-tools",
  "agent_tools.md",
);
const docsJsonPath = path.join(docsRoot, "docs.json");

const failures = [];

if (!fs.existsSync(pagePath)) {
  failures.push(`missing page: ${path.relative(repoRoot, pagePath)}`);
}

if (!fs.existsSync(docsJsonPath)) {
  failures.push(`missing docs config: ${path.relative(repoRoot, docsJsonPath)}`);
}

if (fs.existsSync(pagePath)) {
  const page = fs.readFileSync(pagePath, "utf8");
  if (!page.includes('title: "AI Agent Tools"')) {
    failures.push("page frontmatter is missing title: AI Agent Tools");
  }
  if (!page.includes("[AI Tools](/ai-features/ai-tools)")) {
    failures.push("page must link to the generated AI Tools catalog");
  }
  if (!page.includes("frontend/src/lib/ai/tool-registry.ts")) {
    failures.push("page must reference frontend/src/lib/ai/tool-registry.ts");
  }
}

if (fs.existsSync(docsJsonPath)) {
  try {
    const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, "utf8"));
    const serialized = JSON.stringify(docsJson);
    if (!serialized.includes("developer-docs/agent-tools/agent_tools")) {
      failures.push("docs.json navigation does not include developer-docs/agent-tools/agent_tools");
    }
    if (!serialized.includes('"group":"AI Tools"')) {
      failures.push('docs.json navigation does not include the "AI Tools" group');
    }
  } catch (error) {
    failures.push(`docs.json is not valid JSON: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error("AI agent tools docs verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("AI agent tools docs verification passed.");
