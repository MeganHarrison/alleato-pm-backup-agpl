#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Usage: node scripts/audit-surface-complexity.mjs <file...>");
  process.exit(2);
}

const blockChecks = [
  {
    id: "popup-tabs",
    pattern: /\b(Tabs|TabsList|TabsTrigger|Segmented|ToggleGroup)\b/,
    fail: "Temporary popup contains tabs or segmented controls.",
  },
  {
    id: "popup-search-or-filter",
    pattern: /\b(CommandInput|Search|search|filter|Filter)\b/,
    fail: "Temporary popup appears to contain search or filters.",
  },
  {
    id: "popup-feed-content",
    pattern: /\b(recent|Recent|activity|Activity|comments\.map|notifications\.map|slice\(0,\s*[6-9]|\bmap\()\b/,
    fail: "Temporary popup appears to contain feed or preview-list content.",
  },
  {
    id: "popup-scroll",
    pattern: /\b(overflow-y-auto|overflow-auto|max-h-|max-h-\[|max-h-\()/,
    fail: "Temporary popup has scroll or max-height behavior. Verify it is a preview popover, not a command dropdown.",
  },
  {
    id: "popup-large-switch",
    pattern: /<Switch\b/,
    fail: "Command popup contains a switch. Prefer a dynamic label or checkmark row unless this is explicitly a settings menu.",
  },
  {
    id: "popup-large-type",
    pattern: /\b(text-lg|text-xl|text-2xl)\b/,
    fail: "Command popup uses oversized text for menu rows.",
  },
  {
    id: "popup-large-row-padding",
    pattern: /\b(py-4|py-5|py-6|h-12|h-14|h-16|min-h-12|min-h-14|min-h-16)\b/,
    fail: "Command popup uses oversized row density. Match compact menu rows instead.",
  },
  {
    id: "popup-oversized-width",
    pattern: /\b(w-96|w-\[3[3-9][0-9]px\]|w-\[4[0-9][0-9]px\]|min-w-96|min-w-\[3[3-9][0-9]px\]|min-w-\[4[0-9][0-9]px\])\b/,
    fail: "Command popup appears wider than the standard menu pattern.",
  },
];

const fileChecks = [
  {
    id: "nested-cards",
    pattern: /<Card[\s\S]{0,2500}<Card\b/,
    fail: "Nested cards detected.",
  },
  {
    id: "one-off-dropdown",
    pattern: /function\s+\w*(Dropdown|Menu|Popover)\w*\s*\([^)]*\)\s*{[\s\S]{0,1800}<div[^>]+className=/,
    fail: "Possible one-off dropdown/popover instead of shared primitives.",
  },
];

function getPopupBlocks(text) {
  const blocks = [];
  const openPattern = /<(DropdownMenuContent|PopoverContent)\b/g;
  let match;

  while ((match = openPattern.exec(text)) !== null) {
    const name = match[1];
    const close = `</${name}>`;
    const closeIndex = text.indexOf(close, match.index);
    if (closeIndex === -1) continue;

    const block = text.slice(match.index, closeIndex + close.length);
    const line = text.slice(0, match.index).split("\n").length;
    blocks.push({ name, block, line });
  }

  return blocks;
}

let failures = 0;

for (const file of files) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) {
    console.error(`MISSING ${file}`);
    failures += 1;
    continue;
  }

  const text = fs.readFileSync(absolute, "utf8");
  const fileFailures = [];

  for (const check of fileChecks) {
    if (check.pattern.test(text)) {
      fileFailures.push({ id: check.id, fail: check.fail });
    }
  }

  for (const popup of getPopupBlocks(text)) {
    for (const check of blockChecks) {
      if (check.pattern.test(popup.block)) {
        fileFailures.push({
          id: `${check.id}:L${popup.line}`,
          fail: `${check.fail} (${popup.name} at line ${popup.line})`,
        });
      }
    }
  }

  if (fileFailures.length === 0) {
    console.log(`PASS ${file}`);
    continue;
  }

  failures += fileFailures.length;
  console.log(`FAIL ${file}`);
  for (const failure of fileFailures) {
    console.log(`  - ${failure.id}: ${failure.fail}`);
  }
}

if (failures > 0) {
  process.exit(1);
}
