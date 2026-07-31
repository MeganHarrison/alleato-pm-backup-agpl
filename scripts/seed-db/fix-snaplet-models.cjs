#!/usr/bin/env node

/**
 * Fix Snaplet Generated Models
 *
 * This script fixes the "job number" column issue in Snaplet's generated userModels.js file.
 * The column name has a space which causes JavaScript syntax errors.
 *
 * Run this after `npx @snaplet/seed sync`
 */

const fs = require('fs');
const path = require('path');

const userModelsPath = path.join(__dirname, '../node_modules/@snaplet/seed/dist/assets/userModels.js');

console.log('🔧 Fixing Snaplet generated models...');

if (!fs.existsSync(userModelsPath)) {
  console.log('⚠️  Snaplet models file not found. Run `npx @snaplet/seed sync` first.');
  process.exit(1);
}

try {
  let content = fs.readFileSync(userModelsPath, 'utf8');

  // Find and fix all column names with spaces
  // Pattern: matches identifiers with spaces that aren't already quoted
  // Example: job number: -> "job number":
  // Example: start date: -> "start date":

  // Use a more general regex to find all unquoted column names with spaces
  // Pattern: find any sequence of words separated by spaces followed by a colon
  // that is not already quoted
  const generalPattern = /^(\s+)([a-z]+(?:\s+[a-z]+)+):\s*fallback/gm;

  const matches = [];
  let match;
  while ((match = generalPattern.exec(content)) !== null) {
    matches.push({
      full: match[0],
      indent: match[1],
      column: match[2],
      index: match.index
    });
  }

  let totalFixed = 0;

  if (matches.length > 0) {
    // Replace from end to start to maintain indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const { column } = matches[i];
      const searchPattern = new RegExp(`(\\s+)${column.replace(/\s+/g, '\\s+')}:`, 'g');
      content = content.replace(searchPattern, `$1"${column}":`);
      console.log(`   Fixed "${column}" column`);
    }

    totalFixed = matches.length;
    fs.writeFileSync(userModelsPath, content, 'utf8');
    console.log(`✅ Fixed ${totalFixed} total column(s) with spaces`);
    console.log('   Snaplet models are now ready to use!');
  } else {
    console.log('✅ No issues found in Snaplet models');
  }

  process.exit(0);
} catch (error) {
  console.error('❌ Error fixing Snaplet models:', error.message);
  process.exit(1);
}
