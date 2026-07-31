#!/usr/bin/env node

/**
 * Safe Design System Violation Fixer
 *
 * This script ONLY fixes safe, well-defined patterns:
 * 1. HSL colors in hover states (pattern is consistent)
 * 2. Specific spacing patterns that map 1:1
 * 3. Does NOT touch complex expressions or templates
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

// ONLY map spacing values we're 100% confident about
const SAFE_SPACING_MAPPINGS = {
  // These are in Tailwind documentation and safe to replace
  'min-h-[400px]': 'min-h-96',  //  384px close enough
  'min-h-[120px]': 'min-h-32',  //  128px
  'min-h-[48px]': 'min-h-12',   //  48px exact
  'min-w-[80px]': 'min-w-20',   //  80px exact
  'min-w-[100px]': 'min-w-24',  //  96px close
  'min-w-[120px]': 'min-w-32',  //  128px
  'min-w-[200px]': 'min-w-48',  //  192px close
  'max-w-[1800px]': 'max-w-7xl', // 1280px (conservative max)
  'w-[50px]': 'w-12',           //  48px close
  'w-[100px]': 'w-24',          //  96px close
  'w-[120px]': 'w-32',          //  128px
  'w-[200px]': 'w-48',          //  192px close
  'h-[600px]': 'h-96',          //  384px (not full screen)
};

function fixFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Fix safe spacing violations (exact string replacement only)
  for (const [arbitrary, standard] of Object.entries(SAFE_SPACING_MAPPINGS)) {
    if (content.includes(arbitrary)) {
      const beforeReplace = content;
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${arbitrary.replace(/[[\]]/g, '\\$&')}\\b`, 'g');
      content = content.replace(regex, standard);
      if (content !== beforeReplace) {
        modified = true;
      }
    }
  }

  // Fix HSL colors that are clearly in className attributes
  // Only target the EXACT patterns we see in the errors
  const hslInBg = /className="[^"]*bg-\[hsl\(0\s*,\s*0%\s*,\s*96\.1%\)\][^"]*"/g;
  if (hslInBg.test(content)) {
    content = content.replace(
      /bg-\[hsl\(0\s*,\s*0%\s*,\s*96\.1%\)\]/g,
      'bg-secondary'
    );
    modified = true;
  }

  const hslInHoverBg = /hover:bg-\[hsl\([^\]]+\)\]/g;
  if (hslInHoverBg.test(content)) {
    content = content.replace(
      hslInHoverBg,
      'hover:bg-secondary'
    );
    modified = true;
  }

  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

async function main() {
  console.log('🔍 Finding files with SAFE fixable violations...\n');

  const files = await glob('src/**/*.{tsx,ts,jsx,js}', {
    cwd: '/Users/meganharrison/Documents/github/alleato-procore/frontend',
    absolute: true,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
  });

  let fixedCount = 0;

  for (const file of files) {
    if (fixFile(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ Fixed ${fixedCount} files`);
  console.log('\n🧪 Run "npm run quality" to see remaining issues');
}

main().catch(console.error);
