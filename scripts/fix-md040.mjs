#!/usr/bin/env node

/**
 * fix-md040.mjs
 *
 * Automatically fixes MD040/fenced-code-language violations by inferring
 * the most likely language for unlabeled fenced code blocks.
 *
 * Usage:
 *   node scripts/fix-md040.mjs                    # Dry run (preview changes)
 *   node scripts/fix-md040.mjs --apply            # Apply changes
 *   node scripts/fix-md040.mjs --apply --verbose  # Apply with detailed output
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

// Directories to scan
const SCAN_DIRS = [
  "docs",
  ".claude",
  "PRPs",
  "DOCS_NEED_TO_FILE",
  "frontend",
  "backend",
  "supabase",
  "scripts",
];

// ── Language Detection Heuristics ──────────────────────────────────────────

function inferLanguage(codeBlock) {
  const lines = codeBlock.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return "text";

  const joined = lines.join("\n");
  const first = lines[0].trim();
  const firstLower = first.toLowerCase();

  // Shebang
  if (first.startsWith("#!/")) {
    if (first.includes("python")) return "python";
    if (first.includes("node")) return "javascript";
    if (first.includes("bash") || first.includes("sh")) return "bash";
    return "bash";
  }

  // JSON - starts with { or [, and looks like JSON
  if (/^\s*[\[{]/.test(first) && isLikelyJSON(joined)) return "json";

  // YAML - key: value patterns, no braces
  if (isLikelyYAML(joined)) return "yaml";

  // SQL keywords
  if (isLikelySQL(joined)) return "sql";

  // HTML/JSX with tags
  if (isLikelyHTML(joined)) return "html";

  // TSX/JSX - React component patterns
  if (isLikelyTSX(joined)) return "tsx";

  // TypeScript patterns (before JS check since TS is superset)
  if (isLikelyTypeScript(joined)) return "typescript";

  // JavaScript patterns
  if (isLikelyJavaScript(joined)) return "javascript";

  // CSS
  if (isLikelyCSS(joined)) return "css";

  // Bash/Shell
  if (isLikelyBash(joined)) return "bash";

  // Python
  if (isLikelyPython(joined)) return "python";

  // Markdown
  if (isLikelyMarkdown(joined)) return "markdown";

  // Diff/patch
  if (isLikelyDiff(joined)) return "diff";

  // .env file patterns
  if (isLikelyEnv(joined)) return "bash";

  // File paths or directory listings
  if (isLikelyFileTree(joined)) return "text";

  // Fallback: if it has common shell-like patterns
  if (hasShellIndicators(joined)) return "bash";

  return "text";
}

function isLikelyJSON(code) {
  try {
    JSON.parse(code);
    return true;
  } catch {
    // Check partial JSON patterns
    return (
      /^\s*\{[\s\S]*"[\w-]+":\s/.test(code) ||
      /^\s*\[[\s\S]*\{[\s\S]*\}/.test(code)
    );
  }
}

function isLikelyYAML(code) {
  const lines = code.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return false;
  // YAML: multiple key: value lines, no semicolons at end
  const kvLines = lines.filter((l) => /^\s*[\w-]+:\s/.test(l));
  return kvLines.length >= 2 && !code.includes(";");
}

function isLikelySQL(code) {
  const upper = code.toUpperCase();
  const sqlKeywords = [
    "SELECT ",
    "INSERT ",
    "UPDATE ",
    "DELETE ",
    "CREATE TABLE",
    "ALTER TABLE",
    "DROP TABLE",
    "CREATE INDEX",
    "CREATE OR REPLACE",
    "BEGIN;",
    "COMMIT;",
    "GRANT ",
    "REVOKE ",
    "CREATE POLICY",
    "CREATE FUNCTION",
    "ENABLE ROW LEVEL",
    "ADD CONSTRAINT",
    "REFERENCES ",
    "PRIMARY KEY",
    "FOREIGN KEY",
    "NOT NULL",
    "DEFAULT ",
    "ON DELETE",
    "ON UPDATE",
  ];
  const matches = sqlKeywords.filter((kw) => upper.includes(kw));
  return matches.length >= 2 || (matches.length === 1 && code.includes(";"));
}

function isLikelyHTML(code) {
  return (
    /^<(!DOCTYPE|html|div|span|p|h[1-6]|ul|ol|li|table|form|input|button|a |img |section|header|footer|nav|main|article)/im.test(
      code
    ) && !isLikelyTSX(code)
  );
}

function isLikelyTSX(code) {
  // React/JSX patterns
  return (
    (/^(export\s+)?(default\s+)?function\s+\w+/.test(code) &&
      code.includes("return (") &&
      code.includes("<")) ||
    (/^(const|let)\s+\w+\s*[:=].*React\.FC/.test(code)) ||
    (code.includes("useState") && code.includes("<")) ||
    (code.includes("useEffect") && code.includes("<")) ||
    /<\w+[\s/>]/.test(code) && /^(import|export|const|function)\s/.test(code.trim())
  );
}

function isLikelyTypeScript(code) {
  const tsPatterns = [
    /:\s*(string|number|boolean|void|any|never|unknown)\b/,
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
    /<\w+(\s*,\s*\w+)*>/,
    /as\s+(string|number|boolean|any|const)\b/,
    /:\s*\w+\[\]/,
    /import\s+.*from\s+['"]@\//,
    /export\s+(type|interface)\s/,
    /Partial<|Required<|Pick<|Omit<|Record</,
    /:\s*React\.\w+/,
  ];
  return tsPatterns.some((p) => p.test(code));
}

function isLikelyJavaScript(code) {
  const jsPatterns = [
    /^(import|export)\s/m,
    /^(const|let|var)\s+\w+\s*=/m,
    /^(async\s+)?function\s/m,
    /=>\s*[{(]/,
    /\bawait\s/,
    /require\(/,
    /module\.exports/,
    /console\.(log|error|warn)/,
    /\.then\(/,
    /\.catch\(/,
    /new Promise/,
    /document\./,
    /window\./,
    /process\.env/,
  ];
  const matches = jsPatterns.filter((p) => p.test(code));
  return matches.length >= 2;
}

function isLikelyCSS(code) {
  return (
    /^[.#@][\w-]+\s*\{/m.test(code) ||
    /^\s*[\w-]+:\s*[\w#"'].+;$/m.test(code) ||
    /@(media|keyframes|import|font-face)\s/.test(code)
  );
}

function isLikelyBash(code) {
  const first = code.split("\n")[0].trim();
  const bashStarters = [
    /^(cd|ls|rm|mv|cp|mkdir|touch|cat|echo|grep|find|chmod|chown)\s/,
    /^(npm|npx|node|yarn|pnpm|pip|python|docker|git|curl|wget|brew)\s/,
    /^(sudo|export|source|eval|exec|exit|kill|pkill|sleep)\s/,
    /^\$/,
    /^#\s/,
    /^[A-Z_]+=/, // ENV_VAR=value
  ];
  if (bashStarters.some((p) => p.test(first))) return true;

  const bashIndicators = [
    /\|\s*(grep|awk|sed|sort|uniq|head|tail|wc|xargs)/,
    /\$\{?\w+\}?/,
    /&&\s*(cd|npm|node|git)/,
    />\s*\/?(tmp|dev\/null)/,
    /2>&1/,
    /\bfi\b|\bdone\b|\besac\b/,
    /\bif\s+\[/,
    /\bfor\s+\w+\s+in\b/,
  ];
  return bashIndicators.filter((p) => p.test(code)).length >= 1;
}

function isLikelyPython(code) {
  const pyPatterns = [
    /^(def|class|import|from)\s/m,
    /^\s*(if|elif|else|for|while|try|except|with|return)\s/m,
    /print\(/,
    /self\./,
    /def\s+__\w+__/,
    /@\w+\ndef\s/,
  ];
  return pyPatterns.filter((p) => p.test(code)).length >= 2;
}

function isLikelyMarkdown(code) {
  const first = code.split("\n")[0].trim();
  return (
    /^#{1,6}\s/.test(first) ||
    (/^[-*]\s/.test(first) && code.split("\n").filter((l) => /^[-*]\s/.test(l.trim())).length >= 3) ||
    /^\|.*\|.*\|/m.test(code)
  );
}

function isLikelyDiff(code) {
  return (
    /^[+-]{3}\s/m.test(code) ||
    /^@@\s/m.test(code) ||
    (code.split("\n").filter((l) => /^[+-]\s/.test(l)).length >= 3)
  );
}

function isLikelyEnv(code) {
  const lines = code.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  return lines.length >= 1 && lines.every((l) => /^[A-Z_][\w]*=/.test(l.trim()));
}

function isLikelyFileTree(code) {
  const lines = code.split("\n").filter((l) => l.trim());
  const treeLines = lines.filter(
    (l) => /^[\s│├└─]+/.test(l) || /^\s*(├──|└──|│)/.test(l)
  );
  return treeLines.length >= lines.length * 0.5 && lines.length >= 3;
}

function hasShellIndicators(code) {
  const first = code.split("\n")[0].trim();
  // Single-line that looks like a command
  return (
    code.split("\n").filter((l) => l.trim()).length <= 3 &&
    /^[\w./-]+\s/.test(first) &&
    !first.includes("=") &&
    !first.includes("{") &&
    !first.includes("(")
  );
}

// ── File Processing ────────────────────────────────────────────────────────

function processFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  let modified = false;
  let fixCount = 0;
  const fixes = [];

  // Two-pass approach:
  // Pass 1: Match paired fences with same indentation (most reliable)
  let result = content.replace(
    /^([ \t]*)(```)(\s*)\n([\s\S]*?)^\1```\s*$/gm,
    (match, indent, fence, trailing, codeContent) => {
      if (trailing.trim() !== "") return match;

      const lang = inferLanguage(codeContent);
      fixCount++;
      fixes.push({ lang, preview: codeContent.split("\n")[0].substring(0, 60) });
      modified = true;
      return `${indent}\`\`\`${lang}\n${codeContent}${indent}\`\`\``;
    }
  );

  // Pass 2: Catch remaining unlabeled opening fences (e.g., indented in lists
  // where closing fence has different indentation).
  // Strategy: find lines that are just ``` (no language), peek ahead to find
  // the code content up to the next closing ```, and insert the language.
  const lines = result.split("\n");
  const newLines = [];
  for (let i = 0; i < lines.length; i++) {
    const openMatch = lines[i].match(/^([ \t]*)```\s*$/);
    if (openMatch) {
      // Look ahead to find the closing fence
      let closeIdx = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^[ \t]*```\s*$/.test(lines[j])) {
          closeIdx = j;
          break;
        }
        // If we hit another opening fence with a language, stop
        if (/^[ \t]*```\w/.test(lines[j])) break;
      }
      if (closeIdx > i + 1) {
        const codeContent = lines.slice(i + 1, closeIdx).join("\n");
        const lang = inferLanguage(codeContent);
        fixCount++;
        fixes.push({ lang, preview: codeContent.split("\n")[0].substring(0, 60) });
        modified = true;
        newLines.push(`${openMatch[1]}\`\`\`${lang}`);
      } else {
        newLines.push(lines[i]);
      }
    } else {
      newLines.push(lines[i]);
    }
  }
  result = newLines.join("\n");

  return { result, modified, fixCount, fixes };
}

// ── Directory Walking ──────────────────────────────────────────────────────

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (
          entry === "node_modules" ||
          entry === ".git" ||
          entry === ".next" ||
          entry === ".venv" ||
          entry === "venv" ||
          entry === "__pycache__"
        )
          continue;
        walk(fullPath, files);
      } else if (entry.endsWith(".md") || entry.endsWith(".mdx")) {
        files.push(fullPath);
      }
    } catch {
      continue;
    }
  }
  return files;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log(APPLY ? "🔧 APPLYING fixes..." : "👀 DRY RUN (use --apply to write changes)");
  console.log("");

  let totalFiles = 0;
  let totalFixes = 0;
  const langCounts = {};

  for (const dir of SCAN_DIRS) {
    const fullDir = join(ROOT, dir);
    const files = walk(fullDir);

    for (const file of files) {
      const { result, modified, fixCount, fixes } = processFile(file);
      if (!modified) continue;

      totalFiles++;
      totalFixes += fixCount;

      const relPath = relative(ROOT, file);
      console.log(`  ${relPath} (${fixCount} fix${fixCount > 1 ? "es" : ""})`);

      for (const f of fixes) {
        langCounts[f.lang] = (langCounts[f.lang] || 0) + 1;
        if (VERBOSE) {
          console.log(`    -> \`\`\`${f.lang}  (${f.preview})`);
        }
      }

      if (APPLY) {
        writeFileSync(file, result, "utf-8");
      }
    }
  }

  console.log("");
  console.log("─".repeat(50));
  console.log(`Files: ${totalFiles}  |  Fixes: ${totalFixes}`);
  console.log("");
  console.log("Language distribution:");
  const sorted = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);
  for (const [lang, count] of sorted) {
    const bar = "█".repeat(Math.ceil(count / 2));
    console.log(`  ${lang.padEnd(14)} ${String(count).padStart(4)}  ${bar}`);
  }

  if (!APPLY) {
    console.log("");
    console.log("Run with --apply to write changes.");
  } else {
    console.log("");
    console.log("Done. Changes written to disk.");
  }
}

main();
