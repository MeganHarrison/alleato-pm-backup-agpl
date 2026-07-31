#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files
const testFiles = glob.sync('tests/**/*.{spec,test}.{ts,tsx,js,jsx}', {
  cwd: path.join(__dirname, '..'),
  absolute: true
});

let updatedCount = 0;

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace hardcoded localhost URLs with relative paths
  // Pattern 1: page.goto('http://localhost:3000/path')
  content = content.replace(
    /page\.goto\(['"]http:\/\/(?:localhost|127\.0\.0\.1):\d+([^'"]*)['"]\)/g,
    (match, path) => {
      // If it's just the root, use '/'
      const relativePath = path || '/';
      return `page.goto('${relativePath}')`;
    }
  );

  // Pattern 2: await page.goto('http://localhost:3000/path')
  content = content.replace(
    /await\s+page\.goto\(['"]http:\/\/(?:localhost|127\.0\.0\.1):\d+([^'"]*)['"]\)/g,
    (match, path) => {
      const relativePath = path || '/';
      return `await page.goto('${relativePath}')`;
    }
  );

  // Pattern 3: URLs in expectations like expect(page.url()).toBe('http://localhost:3000/path')
  content = content.replace(
    /expect\(page\.url\(\)\)\.toBe\(['"]http:\/\/(?:localhost|127\.0\.0\.1):\d+([^'"]*)['"]\)/g,
    (match, path) => {
      const relativePath = path || '/';
      return `expect(page.url()).toBe(expect.stringContaining('${relativePath}'))`;
    }
  );

  // Pattern 4: URLs in toContain expectations
  content = content.replace(
    /\.toContain\(['"]http:\/\/(?:localhost|127\.0\.0\.1):\d+([^'"]*)['"]\)/g,
    (match, path) => {
      const relativePath = path || '/';
      return `.toContain('${relativePath}')`;
    }
  );

  // Pattern 5: fetch() calls with hardcoded URLs
  content = content.replace(
    /fetch\(['"]http:\/\/(?:localhost|127\.0\.0\.1):\d+(\/api[^'"]*)['"]/g,
    (match, path) => {
      return `fetch('${path}'`;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    updatedCount++;
    console.log(`Updated: ${path.relative(process.cwd(), file)}`);
  }
});

console.log(`\nUpdated ${updatedCount} test files to use relative URLs.`);
console.log('Tests will now use the BASE_URL from .env.local configured in playwright.config.ts');