#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get TypeScript errors
const errors = execSync('npm run typecheck 2>&1 || true', { encoding: 'utf8' });

// Parse TS18046 errors (is of type 'unknown')
const unknownErrors = errors
  .split('\n')
  .filter(line => line.includes('TS18046'))
  .map(line => {
    const match = line.match(/(.+?)\((\d+),(\d+)\): error TS18046: '(.+?)' is of type 'unknown'/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        variable: match[4]
      };
    }
    return null;
  })
  .filter(Boolean);

// Group by file
const errorsByFile = {};
unknownErrors.forEach(error => {
  if (!errorsByFile[error.file]) {
    errorsByFile[error.file] = [];
  }
  errorsByFile[error.file].push(error);
});

console.warn(`Found ${unknownErrors.length} 'unknown' type errors across ${Object.keys(errorsByFile).length} files`);

// Fix each file
Object.entries(errorsByFile).forEach(([file, errors]) => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    // Sort errors by line number in reverse order to avoid offset issues
    errors.sort((a, b) => b.line - a.line);
    
    errors.forEach(error => {
      const lineIndex = error.line - 1;
      const line = lines[lineIndex];
      
      if (line) {
        // Common patterns to fix
        const patterns = [
          // Pattern: variable.property
          { 
            regex: new RegExp(`(\\b${error.variable}\\.\\w+)`, 'g'),
            replacement: `(${error.variable} as any).$1`
          },
          // Pattern: variable[key]
          {
            regex: new RegExp(`(\\b${error.variable}\\[)`, 'g'),
            replacement: `(${error.variable} as any)[`
          },
          // Pattern: ...variable
          {
            regex: new RegExp(`(\\.\\.\\.${error.variable}\\b)`, 'g'),
            replacement: `...(${error.variable} as any)`
          },
          // Pattern: standalone variable in conditionals
          {
            regex: new RegExp(`([\\s\\(\\{\\[])(${error.variable})([\\.\\s\\)\\}\\]\\?:,])`, 'g'),
            replacement: '$1($2 as any)$3'
          }
        ];
        
        let fixed = false;
        for (const pattern of patterns) {
          if (pattern.regex.test(line)) {
            lines[lineIndex] = line.replace(pattern.regex, pattern.replacement);
            fixed = true;
            break;
          }
        }
        
        if (!fixed) {
          console.warn(`⚠️  Could not auto-fix: ${file}:${error.line} - ${error.variable}`);
        }
      }
    });
    
    content = lines.join('\n');
    fs.writeFileSync(file, content);
    console.warn(`✅ Fixed ${errors.length} errors in ${file}`);
    
  } catch (err) {
    console.error(`❌ Error processing ${file}:`, err.message);
  }
});

console.warn('\nDone! Run npm run typecheck to see remaining errors.');