#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript/JavaScript files
const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
  cwd: path.resolve(__dirname, '..'),
  absolute: true,
  ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
});

let totalRemoved = 0;
const filesModified = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');

  // Pattern to match console.log statements (including multiline)
  const consoleLogPattern = /console\.(log|debug|info|warn|error)\([^)]*\);?\s*/g;

  // Count occurrences
  const matches = content.match(consoleLogPattern);
  if (matches && matches.length > 0) {
    // Remove console statements
    const newContent = content.replace(consoleLogPattern, '');

    // Only write if content actually changed
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      totalRemoved += matches.length;
      filesModified.push({
        file: path.relative(process.cwd(), file),
        count: matches.length
      });
    }
  }
});

console.log(`\n✅ Removed ${totalRemoved} console statements from ${filesModified.length} files:\n`);
filesModified.forEach(({ file, count }) => {
  console.log(`  - ${file}: ${count} statements`);
});
console.log('\n');