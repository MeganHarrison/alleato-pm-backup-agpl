#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TypeScript/JavaScript files with console.log
const files = execSync(`grep -rl "console\\.log" src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" || true`)
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

console.warn(`Found ${files.length} files with console.log statements`);

let totalFixed = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;
    
    // Pattern to match console.log statements (handles multi-line)
    const patterns = [
      // Simple console.log
      /console\.log\(/g,
      // Console.log (capital C)
      /Console\.log\(/g,
    ];
    
    let fixedCount = 0;
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        fixedCount += matches.length;
        
        // For error-like messages, use console.error
        content = content.replace(/console\.log\((.*[Ee]rror.*)\)/g, 'console.error($1)');
        
        // For warning-like messages, use console.warn  
        content = content.replace(/console\.log\((.*[Ww]arn.*)\)/g, 'console.warn($1)');
        
        // For debug/info messages that should be removed in production
        content = content.replace(/console\.log\((.*[Dd]ebug.*)\)/g, '// DEBUG: $1');
        content = content.replace(/console\.log\((.*[Ii]nfo.*)\)/g, '// INFO: $1');
        
        // For remaining console.logs, comment them out
        content = content.replace(/console\.log\(/g, '// console.log(');
      }
    });
    
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      console.warn(`✅ Fixed ${fixedCount} console.log statements in ${file}`);
      totalFixed += fixedCount;
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.warn(`\n🎉 Total fixed: ${totalFixed} console.log statements`);
console.warn('\nNext steps:');
console.warn('1. Review the changes with: git diff');
console.warn('2. Run tests to ensure nothing broke');
console.warn('3. Manually review commented lines to decide if they should be removed');