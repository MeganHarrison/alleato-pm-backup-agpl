#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Get files with syntax errors
const errors = execSync('npm run typecheck 2>&1 || true', { encoding: 'utf8' });
const syntaxErrors = errors
  .split('\n')
  .filter(line => line.includes('TS1003'))
  .map(line => {
    const match = line.match(/(.+?):\d+:\d+/);
    return match ? match[1] : null;
  })
  .filter(Boolean);

const uniqueFiles = [...new Set(syntaxErrors)];

console.warn(`Found syntax errors in ${uniqueFiles.length} files`);

uniqueFiles.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix patterns like (p as any).p.name -> (p as any).name
    content = content.replace(/\((\w+) as any\)\.(\1)\./g, '($1 as any).');
    
    // Fix patterns like (p as any).(p as any).p.name -> (p as any).name  
    content = content.replace(/\((\w+) as any\)\.\((\1) as any\)\.(\1)\./g, '($1 as any).');
    
    // Fix patterns like p['job number'] || (p as any).(p as any).p.id
    content = content.replace(/\((\w+) as any\)\.\((\1) as any\)/g, '($1 as any)');
    
    fs.writeFileSync(file, content);
    console.warn(`✅ Fixed ${file}`);
  } catch (err) {
    console.error(`❌ Error fixing ${file}:`, err.message);
  }
});