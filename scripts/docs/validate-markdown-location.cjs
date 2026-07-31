#!/usr/bin/env node

/**
 * Blocks commits when Markdown files live outside documentation/ unless they
 * explicitly opt out with an override marker.
 */

const { execSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

const OVERRIDE_MARKER = "<!-- allow-outside-documentation -->";

function getStagedMarkdownFiles() {
  try {
    const output = execSync(
      "git diff --cached --name-only --diff-filter=ACM -- '*.md' '*.mdx'",
      { encoding: "utf8" }
    );
    return output
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  } catch (error) {
    // If git diff fails, fail closed to avoid bypassing the guard.
    console.error("Unable to read staged files:", error.message);
    process.exit(1);
  }
}

function hasOverrideMarker(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    return content.includes(OVERRIDE_MARKER);
  } catch (error) {
    console.error(`❌ Unable to read ${filePath}: ${error.message}`);
    return false;
  }
}

function main() {
  const stagedMarkdown = getStagedMarkdownFiles();

  if (stagedMarkdown.length === 0) {
    return;
  }

  const violations = stagedMarkdown.filter((filePath) => {
    if (filePath.startsWith("documentation/")) {
      return false;
    }
    return !hasOverrideMarker(filePath);
  });

  if (violations.length > 0) {
    console.error(
      "❌ Markdown files must live under documentation/ or include the override marker."
    );
    console.error("");
    violations.forEach((file) => console.error(`  - ${file}`));
    console.error("");
    console.error(
      `Add ${OVERRIDE_MARKER} to the file to explicitly allow it outside documentation/.`
    );
    process.exit(1);
  }
}

main();
