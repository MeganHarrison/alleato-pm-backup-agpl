#!/usr/bin/env npx tsx
/**
 * TypeScript Error Logger
 *
 * Runs TypeScript compiler and appends errors to the continuous log.
 *
 * Usage:
 *   npx tsx scripts/log-typescript-errors.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  category: string;
}

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(
  REPO_ROOT,
  'docs',
  'typescript-errors',
  'TYPESCRIPT-ERRORS-LOG.md'
);

// Category detection based on error patterns
function detectCategory(error: string, code: string): string {
  const lowerError = error.toLowerCase();

  if (
    lowerError.includes('selectqueryerror') ||
    (lowerError.includes('does not exist') && lowerError.includes('column'))
  ) {
    return 'SCHEMA_MISMATCH';
  }

  if (
    lowerError.includes('resolver') ||
    lowerError.includes('control<') ||
    lowerError.includes('useform') ||
    lowerError.includes('fieldvalues') ||
    lowerError.includes('submithandler')
  ) {
    return 'FORM_TYPING';
  }

  if (
    lowerError.includes('not assignable') &&
    (lowerError.includes('date') ||
      (lowerError.includes('string') && lowerError.includes('number')) ||
      lowerError.includes('uint8array'))
  ) {
    return 'TYPE_CONVERSION';
  }

  if (lowerError.includes('does not exist') && lowerError.includes('service')) {
    return 'SERVICE_METHOD';
  }

  if (
    lowerError.includes('overload') ||
    lowerError.includes('syntaxhighlighter') ||
    lowerError.includes('cssproperties')
  ) {
    return 'LIBRARY_TYPES';
  }

  if (code === 'TS2339') {
    return 'MISSING_PROPERTY';
  }

  if (code === 'TS2355') {
    return 'FUNCTION_RETURN';
  }

  return 'OTHER';
}

function parseTypeScriptOutput(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];
  const lines = output.split('\n');
  const errorRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

  for (const line of lines) {
    const match = line.match(errorRegex);
    if (match) {
      const [, file, lineNum, col, code, message] = match;
      errors.push({
        file: file.trim(),
        line: parseInt(lineNum, 10),
        column: parseInt(col, 10),
        code,
        message: message.trim(),
        category: detectCategory(message, code),
      });
    }
  }

  return errors;
}

function generateLogEntry(errors: TypeScriptError[]): string {
  const date = new Date().toISOString().split('T')[0];
  const filesAffected = new Set(errors.map((e) => e.file)).size;

  // Group by category
  const byCategory = new Map<string, TypeScriptError[]>();
  for (const error of errors) {
    if (!byCategory.has(error.category)) {
      byCategory.set(error.category, []);
    }
    byCategory.get(error.category)!.push(error);
  }

  let entry = `\n### ${date} | ${errors.length} errors | ${filesAffected} files\n`;

  for (const [category, categoryErrors] of byCategory) {
    entry += `\n#### ${category} (${categoryErrors.length} errors)\n`;

    // Group by file within category
    const byFile = new Map<string, TypeScriptError[]>();
    for (const error of categoryErrors) {
      if (!byFile.has(error.file)) {
        byFile.set(error.file, []);
      }
      byFile.get(error.file)!.push(error);
    }

    for (const [file, fileErrors] of byFile) {
      entry += `\n**File:** \`${file}\`\n\n`;
      entry += '| Line | Code | Error |\n';
      entry += '|------|------|-------|\n';

      for (const error of fileErrors) {
        // Truncate long messages
        const msg =
          error.message.length > 80
            ? error.message.substring(0, 77) + '...'
            : error.message;
        entry += `| ${error.line} | ${error.code} | ${msg} |\n`;
      }
    }

    entry += '\n**Root Cause:** [TODO: Add root cause]\n';
    entry += '\n**Fix:** [TODO: Add fix description]\n';
    entry += '\n---\n';
  }

  return entry;
}

function appendToLog(entry: string): void {
  if (!fs.existsSync(LOG_FILE)) {
    console.error(`Log file not found: ${LOG_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(LOG_FILE, 'utf-8');

  // Find the "## Error Log" section and insert after it
  const errorLogMarker = '## Error Log';
  const markerIndex = content.indexOf(errorLogMarker);

  if (markerIndex === -1) {
    console.error('Could not find "## Error Log" section in log file');
    process.exit(1);
  }

  // Find the end of the header line
  const insertIndex = content.indexOf('\n', markerIndex) + 1;

  const newContent =
    content.slice(0, insertIndex) + entry + content.slice(insertIndex);

  fs.writeFileSync(LOG_FILE, newContent);
}

function updateStats(errorCount: number): void {
  const content = fs.readFileSync(LOG_FILE, 'utf-8');

  // Update total errors
  const totalMatch = content.match(/Total Errors Logged \| (\d+)/);
  if (totalMatch) {
    const currentTotal = parseInt(totalMatch[1], 10);
    const newTotal = currentTotal + errorCount;
    const updatedContent = content
      .replace(/Total Errors Logged \| \d+/, `Total Errors Logged | ${newTotal}`)
      .replace(/(Total )?Fix Sessions \| (\d+)/, (_match, totalPrefix, count) => {
        const label = totalPrefix ? 'Total Fix Sessions' : 'Fix Sessions';
        return `${label} | ${parseInt(count, 10) + 1}`;
      })
      .replace(/Last Updated \| [\d-]+/, `Last Updated | ${new Date().toISOString().split('T')[0]}`);
    fs.writeFileSync(LOG_FILE, updatedContent);
  }
}

async function main() {
  console.log('Running TypeScript compiler...\n');

  let tscOutput = '';
  try {
    execSync('npx tsc --noEmit 2>&1', {
      encoding: 'utf-8',
      cwd: FRONTEND_ROOT,
    });
    console.log('No TypeScript errors found!');
    return;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      tscOutput = (error as { stdout: string }).stdout || '';
    }
  }

  const errors = parseTypeScriptOutput(tscOutput);

  if (errors.length === 0) {
    console.log('No TypeScript errors parsed.');
    return;
  }

  console.log(`Found ${errors.length} TypeScript errors\n`);

  // Show summary
  const byCategory = new Map<string, number>();
  for (const error of errors) {
    byCategory.set(error.category, (byCategory.get(error.category) || 0) + 1);
  }

  console.log('Errors by category:');
  for (const [cat, count] of [...byCategory.entries()].sort(([, a], [, b]) => b - a)) {
    console.log(`  ${cat}: ${count}`);
  }

  // Generate and append log entry
  const entry = generateLogEntry(errors);
  appendToLog(entry);
  updateStats(errors.length);

  console.log(`\nAppended ${errors.length} errors to:`);
  console.log(`  ${LOG_FILE}`);
  console.log('\nRemember to fill in Root Cause and Fix sections!');
}

main().catch(console.error);
