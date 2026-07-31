#!/usr/bin/env node

/**
 * Design System Compliance Verification Script
 *
 * Checks for design system violations in the codebase.
 * Can be run manually or as part of CI/CD pipeline.
 *
 * Usage: node scripts/design-system/verify-compliance.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  log('\n' + '='.repeat(60), 'blue');
  log(message, 'blue');
  log('='.repeat(60), 'blue');
}

// Check 1: Run ESLint with design system rules
function checkESLintRules() {
  header('1. ESLint Design System Rules');

  try {
    execSync('npm run lint -- --quiet', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
    });
    log('✓ ESLint rules passed', 'green');
    return true;
  } catch (error) {
    log('✗ ESLint rules failed - see errors above', 'red');
    return false;
  }
}

// Check 2: Search for hardcoded colors in src files
function checkHardcodedColors() {
  header('2. Hardcoded Color Detection');

  const srcDir = path.resolve(__dirname, '../../src');
  let violations = 0;

  // Patterns to search for
  const patterns = [
    { regex: /#[0-9a-fA-F]{3,6}/g, description: 'hex colors' },
    { regex: /rgb\([^)]+\)/g, description: 'rgb colors' },
    { regex: /rgba\([^)]+\)/g, description: 'rgba colors' },
  ];

  function scanFile(filePath) {
    // Skip certain files
    if (
      filePath.includes('globals.css') ||
      filePath.includes('tailwind.config') ||
      filePath.includes('.next/') ||
      filePath.includes('node_modules/')
    ) {
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    patterns.forEach(({ regex, description }) => {
      const matches = content.match(regex);
      if (matches) {
        violations += matches.length;
        log(`  Found ${matches.length} ${description} in ${path.relative(srcDir, filePath)}`, 'yellow');
        matches.slice(0, 3).forEach(match => {
          log(`    - ${match}`, 'gray');
        });
        if (matches.length > 3) {
          log(`    ... and ${matches.length - 3} more`, 'gray');
        }
      }
    });
  }

  function walkDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.match(/\.(tsx?|jsx?)$/)) {
        scanFile(filePath);
      }
    });
  }

  walkDir(srcDir);

  if (violations === 0) {
    log('✓ No hardcoded colors found', 'green');
    return true;
  } else {
    log(`✗ Found ${violations} hardcoded color violations`, 'red');
    return false;
  }
}

// Check 3: Verify design system documentation exists
function checkDocumentation() {
  header('3. Design System Documentation');

  const docs = [
    'docs/design/README.md',
    '.claude/design-audit/design-system-rules.md',
    'src/design-system/tokens.md',
  ];

  let allExist = true;

  docs.forEach(doc => {
    const docPath = path.resolve(__dirname, '../..', doc);
    if (fs.existsSync(docPath)) {
      log(`✓ ${doc} exists`, 'green');
    } else {
      log(`✗ ${doc} missing`, 'red');
      allExist = false;
    }
  });

  return allExist;
}

// Check 4: Count usage of design system components
function checkComponentUsage() {
  header('4. Design System Component Usage');

  const srcDir = path.resolve(__dirname, '../../src');
  const components = {
    'Card': 0,
    'Badge': 0,
    'Button': 0,
    'Heading': 0,
    'Text': 0,
    'Stack': 0,
    'Inline': 0,
  };

  function scanFile(filePath) {
    if (filePath.includes('components/ui/')) return; // Skip component definitions

    const content = fs.readFileSync(filePath, 'utf-8');

    Object.keys(components).forEach(component => {
      const regex = new RegExp(`<${component}[\\s>]`, 'g');
      const matches = content.match(regex);
      if (matches) {
        components[component] += matches.length;
      }
    });
  }

  function walkDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.match(/\.(tsx?|jsx?)$/)) {
        scanFile(filePath);
      }
    });
  }

  walkDir(srcDir);

  log('Component usage statistics:', 'blue');
  Object.entries(components).forEach(([component, count]) => {
    log(`  ${component}: ${count} usages`, count > 0 ? 'green' : 'gray');
  });

  return true;
}

// Main execution
async function main() {
  log('\n🎨 Design System Compliance Verification\n', 'blue');

  const results = {
    eslint: checkESLintRules(),
    colors: checkHardcodedColors(),
    docs: checkDocumentation(),
    components: checkComponentUsage(),
  };

  // Summary
  header('Summary');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  log(`\nPassed: ${passed}/${total} checks`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n✓ All design system compliance checks passed!', 'green');
    process.exit(0);
  } else {
    log('\n✗ Some design system compliance checks failed.', 'red');
    log('Run `npm run lint` to see specific issues.', 'yellow');
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n✗ Error running compliance checks: ${error.message}`, 'red');
  process.exit(1);
});
