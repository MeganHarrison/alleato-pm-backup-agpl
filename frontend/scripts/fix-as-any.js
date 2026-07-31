#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Find all files with 'as any' type assertions
const files = execSync(`grep -rl "as any" src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" || true`)
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

console.warn(`Found ${files.length} files with 'as any' type assertions`);

let totalFixed = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;
    
    // Count occurrences before replacement
    const matches = content.match(/as any/g);
    const count = matches ? matches.length : 0;
    
    // Replace 'as any' with 'as unknown'
    content = content.replace(/as any\b/g, 'as unknown');
    
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      console.warn(`✅ Fixed ${count} 'as any' assertions in ${file}`);
      totalFixed += count;
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.warn(`\n🎉 Total fixed: ${totalFixed} 'as any' type assertions`);
console.warn('\nNote: Some "as unknown" assertions might need more specific types.');
console.warn('Run npm run typecheck to ensure no new errors were introduced.');