#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TypeScript/JavaScript files with 'any' type
const files = execSync(`grep -rl ": any" src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" || true`)
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

console.warn(`Found ${files.length} files with 'any' type annotations`);

let totalFixed = 0;

// Patterns to replace
const replacements = [
  // Type annotations
  { pattern: /: any\b/g, replacement: ': unknown' },
  // Array types
  { pattern: /: any\[\]/g, replacement: ': unknown[]' },
  // Generic types - but preserve 'as any' for now as those might need manual review
  { pattern: /<any>/g, replacement: '<unknown>' },
  // Function parameters
  { pattern: /\(([^:)]+): any\)/g, replacement: '($1: unknown)' },
  // Multiple parameters
  { pattern: /\(([^:)]+): any,/g, replacement: '($1: unknown,' },
];

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;
    let fixedCount = 0;
    
    replacements.forEach(({ pattern, replacement }) => {
      const matches = content.match(pattern);
      if (matches) {
        fixedCount += matches.length;
        content = content.replace(pattern, replacement);
      }
    });
    
    // Special handling for specific patterns that need context
    // Replace @typescript-eslint/no-explicit-any with @typescript-eslint/no-explicit-unknown
    content = content.replace(/@typescript-eslint\/no-explicit-any/g, '@typescript-eslint/no-explicit-unknown');
    
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      console.warn(`✅ Fixed ${fixedCount} 'any' types in ${file}`);
      totalFixed += fixedCount;
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.warn(`\n🎉 Total fixed: ${totalFixed} 'any' type annotations`);
console.warn('\nNext steps:');
console.warn('1. Run npm run typecheck to check for any new errors');
console.warn('2. Review "as any" type assertions manually (not auto-fixed)');
console.warn('3. Some "unknown" types might need more specific types');