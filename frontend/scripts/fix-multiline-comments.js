#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Find all files with "// console.log" followed by non-comment lines
const files = execSync(`grep -l "// console.log" src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -R || true`)
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

console.warn(`Found ${files.length} files to check`);

let totalFixed = 0;

files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line has "// console.log(" 
      if (line.includes('// console.log(')) {
        // Check if the line doesn't end with );
        if (!line.includes(');')) {
          // This is a multi-line console.log that was commented out
          // Find the end of the statement
          let j = i + 1;
          while (j < lines.length && !lines[j].includes(');')) {
            // Comment out the line if it's not already commented
            if (!lines[j].trim().startsWith('//')) {
              lines[j] = '    // ' + lines[j].trim();
              modified = true;
              totalFixed++;
            }
            j++;
          }
          // Comment out the closing line too
          if (j < lines.length && !lines[j].trim().startsWith('//')) {
            lines[j] = '    // ' + lines[j].trim();
            modified = true;
            totalFixed++;
          }
          i = j; // Skip to the end of this block
        }
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, lines.join('\n'));
      console.warn(`✅ Fixed multi-line comments in ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.warn(`\n🎉 Total lines fixed: ${totalFixed}`);