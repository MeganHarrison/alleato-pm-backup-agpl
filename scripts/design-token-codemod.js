#!/usr/bin/env node

/**
 * Design Token Codemod
 * Replaces hardcoded Tailwind color/shadow classes with semantic design tokens.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '../frontend/src');

// Files to skip
const SKIP_FILES = new RegExp(
  '(GOLDEN-EXAMPLES\\.tsx|' +
  '\\.test\\.(tsx|ts|jsx|js)|' +
  '\\.spec\\.(tsx|ts|jsx|js))$'
);

// Replacement rules — ordered carefully to avoid partial matches.
// Each entry: [pattern, replacement, category]
// Using word-boundary-aware patterns: class must be followed by space, quote, backtick, or end
const REPLACEMENTS = [
  // --- Background colors ---
  // bg-gray-200 before bg-gray-100/50 to avoid partial match issues (longer first)
  [/\bbg-gray-200\b/g,  'bg-muted',       'bg-gray-200'],
  [/\bbg-gray-100\b/g,  'bg-muted',       'bg-gray-100'],
  [/\bbg-gray-50\b/g,   'bg-muted',       'bg-gray-50'],
  [/\bbg-white\b/g,     'bg-card',        'bg-white'],

  // --- Text colors ---
  // Process from most-specific (darkest) to least to avoid substring issues.
  // Note: text-gray-900 won't collide with others since each is a different number.
  [/\btext-gray-900\b/g, 'text-foreground',          'text-gray-900'],
  [/\btext-gray-800\b/g, 'text-foreground',          'text-gray-800'],
  [/\btext-gray-700\b/g, 'text-muted-foreground',    'text-gray-700'],
  [/\btext-gray-600\b/g, 'text-muted-foreground',    'text-gray-600'],
  [/\btext-gray-500\b/g, 'text-muted-foreground',    'text-gray-500'],
  [/\btext-gray-400\b/g, 'text-muted-foreground',    'text-gray-400'],

  // --- Border colors ---
  [/\bborder-gray-300\b/g, 'border-border', 'border-gray-300'],
  [/\bborder-gray-200\b/g, 'border-border', 'border-gray-200'],
  [/\bborder-gray-100\b/g, 'border-border', 'border-gray-100'],

  // --- Shadows ---
  // Largest first to avoid shadow-md matching inside shadow-2xl etc.
  [/\bshadow-2xl\b/g, 'shadow-sm', 'shadow-2xl'],
  [/\bshadow-xl\b/g,  'shadow-sm', 'shadow-xl'],
  [/\bshadow-lg\b/g,  'shadow-sm', 'shadow-lg'],
  [/\bshadow-md\b/g,  'shadow-sm', 'shadow-md'],
];

// Tally structure
const counts = {};
REPLACEMENTS.forEach(([, , cat]) => { counts[cat] = 0; });

let filesChanged = 0;
let filesScanned = 0;

function collectTsxFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules just in case
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      collectTsxFiles(fullPath, results);
    } else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      if (!SKIP_FILES.test(fullPath)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let content = original;

  const localCounts = {};

  for (const [pattern, replacement, category] of REPLACEMENTS) {
    // Count matches before replacing
    const matches = content.match(pattern);
    if (matches) {
      localCounts[category] = (localCounts[category] || 0) + matches.length;
      counts[category] += matches.length;
      content = content.replace(pattern, replacement);
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesChanged++;
    const rel = path.relative(SRC_DIR, filePath);
    const summary = Object.entries(localCounts)
      .map(([k, v]) => `${k}×${v}`)
      .join(', ');
    console.log(`  CHANGED  ${rel}  [${summary}]`);
  }

  filesScanned++;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nDesign Token Codemod`);
console.log(`Scanning: ${SRC_DIR}\n`);

const files = collectTsxFiles(SRC_DIR);
console.log(`Found ${files.length} files to process (skipping GOLDEN-EXAMPLES + test files)\n`);

for (const file of files) {
  processFile(file);
}

console.log('\n─────────────────────────────────────────');
console.log(`Files scanned  : ${filesScanned}`);
console.log(`Files changed  : ${filesChanged}`);
console.log('\nReplacements by category:');

let totalReplacements = 0;
for (const [cat, count] of Object.entries(counts)) {
  if (count > 0) {
    console.log(`  ${cat.padEnd(20)} ${count}`);
    totalReplacements += count;
  }
}
if (totalReplacements === 0) {
  console.log('  (none — everything was already using semantic tokens)');
}
console.log(`\nTotal replacements: ${totalReplacements}`);
console.log('─────────────────────────────────────────\n');
