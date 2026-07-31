/**
 * Verify Cache Setup
 *
 * Quick test to ensure caching infrastructure is working
 * without making actual API calls
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verifying Claude Cache Setup...\n');

const checks = [
  {
    name: 'TypeScript runtime (tsx)',
    test: () => true, // If this runs, tsx works
    fix: 'Run: npm install'
  },
  {
    name: 'Anthropic SDK installed',
    test: () => {
      try {
        const pkgPath = join(__dirname, '..', 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return pkg.dependencies['@anthropic-ai/sdk'] !== undefined;
      } catch {
        return false;
      }
    },
    fix: 'Run: npm install @anthropic-ai/sdk'
  },
  {
    name: 'Cache helper exists',
    test: () => existsSync(join(__dirname, 'claude-cache-helper.ts')),
    fix: 'File missing: scripts/claude-cache-helper.ts'
  },
  {
    name: 'Cache monitor exists',
    test: () => existsSync(join(__dirname, 'cache-monitor.ts')),
    fix: 'File missing: scripts/cache-monitor.ts'
  },
  {
    name: 'CLAUDE.md exists',
    test: () => existsSync(join(__dirname, '..', 'CLAUDE.md')),
    fix: 'File missing: CLAUDE.md'
  },
  {
    name: 'Rules directory exists',
    test: () => existsSync(join(__dirname, '..', '.claude', 'rules')),
    fix: 'Directory missing: .claude/rules/'
  },
  {
    name: 'Database types exist',
    test: () => existsSync(join(__dirname, '..', 'frontend', 'src', 'types', 'database.types.ts')),
    fix: 'Run: npm run db:types (from frontend directory)'
  },
  {
    name: 'NPM scripts configured',
    test: () => {
      try {
        const pkgPath = join(__dirname, '..', 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return pkg.scripts['cache:stats'] !== undefined;
      } catch {
        return false;
      }
    },
    fix: 'NPM scripts missing from package.json'
  }
];

let allPassed = true;

for (const check of checks) {
  const passed = check.test();
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);

  if (!passed) {
    console.log(`   Fix: ${check.fix}`);
    allPassed = false;
  }
}

console.log('');

if (allPassed) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ALL CHECKS PASSED!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🚀 Ready to use! Next steps:\n');
  console.log('1. Set your API key:');
  console.log('   export ANTHROPIC_API_KEY="your-key-here"\n');
  console.log('2. Run the example:');
  console.log('   npx tsx scripts/cache-example.ts\n');
  console.log('3. View your stats:');
  console.log('   npm run cache:stats\n');

  console.log('📚 Documentation:');
  console.log('   .claude/MONITORING-SETUP-COMPLETE.md');
  console.log('   docs/CACHE-MONITORING-GUIDE.md\n');
} else {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('❌ SETUP INCOMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Please fix the issues above and run again.\n');
  process.exit(1);
}
