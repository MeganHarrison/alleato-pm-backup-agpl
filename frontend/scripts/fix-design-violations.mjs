#!/usr/bin/env node

/**
 * Automated Design System Violation Fixer
 *
 * This script fixes common design system violations:
 * 1. Replaces hardcoded colors with semantic tokens
 * 2. Replaces arbitrary spacing with standard values
 * 3. Removes invalid patterns like m-[#color]
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

// Color mappings (hex to semantic token)
const COLOR_MAPPINGS = {
  // Whites and backgrounds
  '#FFF': 'background',
  '#FFFFFF': 'background',
  '#FAF8F5': 'background',
  '#F5F1ED': 'secondary',

  // Grays/Neutrals
  '#2D2D2D': 'foreground',
  '#4A4A4A': 'muted-foreground',
  '#6B6B6B': 'muted-foreground',
  '#9B9B9B': 'muted-foreground',

  // Brand/Orange (Procore colors)
  '#E07856': 'primary',
  '#C85A3A': 'primary-foreground',
  '#DB802D': 'primary',
};

// Spacing mappings (arbitrary to design system)
const SPACING_MAPPINGS = {
  'min-h-[400px]': 'min-h-96',  // 24rem = 384px (closest to 400px)
  'min-h-[240px]': 'min-h-60',  // 15rem = 240px
  'min-h-[120px]': 'min-h-32',  // 8rem = 128px
  'min-h-[150px]': 'min-h-36',  // 9rem = 144px
  'min-h-[48px]': 'min-h-12',   // 3rem = 48px
  'min-h-[44px]': 'min-h-11',   // 2.75rem = 44px
  'min-w-[100px]': 'min-w-24',  // 6rem = 96px
  'min-w-[120px]': 'min-w-32',  // 8rem = 128px
  'min-w-[150px]': 'min-w-36',  // 9rem = 144px
  'min-w-[200px]': 'min-w-48',  // 12rem = 192px
  'min-w-[80px]': 'min-w-20',   // 5rem = 80px
  'max-w-[500px]': 'max-w-lg',  // 32rem = 512px
  'max-w-[400px]': 'max-w-md',  // 28rem = 448px
  'max-w-[300px]': 'max-w-xs',  // 20rem = 320px
  'max-w-[425px]': 'max-w-md',  // 28rem = 448px
  'max-w-[200px]': 'max-w-xs',
  'max-w-[140px]': 'max-w-36',
  'max-w-[1800px]': 'max-w-7xl',
  'max-w-[85%]': 'max-w-5xl',   // Large responsive width
  'max-w-[75%]': 'max-w-4xl',   // Medium responsive width
  'max-h-[80vh]': 'max-h-screen',
  'max-h-[400px]': 'max-h-96',
  'max-h-[300px]': 'max-h-80',
  'w-[500px]': 'w-full md:w-auto',  // Full width on mobile, auto on desktop
  'w-[400px]': 'w-96',
  'w-[50px]': 'w-12',           // 3rem = 48px
  'w-[100px]': 'w-24',
  'w-[120px]': 'w-32',
  'w-[140px]': 'w-36',
  'w-[150px]': 'w-36',
  'w-[200px]': 'w-48',
  'w-[300px]': 'w-72',
  'h-[600px]': 'h-screen',
};

function fixFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Fix spacing violations
  for (const [arbitrary, standard] of Object.entries(SPACING_MAPPINGS)) {
    const regex = new RegExp(arbitrary.replace(/[[\]]/g, '\\$&'), 'g');
    if (content.includes(arbitrary)) {
      content = content.replace(regex, standard);
      modified = true;
    }
  }

  // Remove invalid color-based spacing (e.g., m-[#E07856], w-[#E07856])
  // These are clearly mistakes where color values are used in spacing
  const beforeInvalidRemoval = content;
  content = content.replace(/\b(m|mx|my|mt|mb|ml|mr|p|px|py|pt|pb|pl|pr)-\[#[0-9A-Fa-f]{3,6}\]/g, '');
  content = content.replace(/\b(w|h)-\[#[0-9A-Fa-f]{3,6}\]/g, '');
  content = content.replace(/\b(min-w|min-h|max-w|max-h)-\[#[0-9A-Fa-f]{3,6}\]/g, '');
  // Clean up multiple spaces that may result from removals
  content = content.replace(/\s{2,}/g, ' ');
  content = content.replace(/className="\s+/g, 'className="');
  content = content.replace(/\s+"/g, '"');

  if (content !== beforeInvalidRemoval) {
    modified = true;
  }

  // Fix hardcoded hex colors in className (simple cases)
  // This is trickier - we'll target common patterns like text-[#color] or bg-[#color]
  for (const [hex, token] of Object.entries(COLOR_MAPPINGS)) {
    const hexPattern = hex.replace(/#/g, '\\#');

    // text-[#color] -> text-{token}
    const textRegex = new RegExp(`text-\\[${hexPattern}\\]`, 'g');
    if (content.match(textRegex)) {
      content = content.replace(textRegex, `text-${token}`);
      modified = true;
    }

    // bg-[#color] -> bg-{token}
    const bgRegex = new RegExp(`bg-\\[${hexPattern}\\]`, 'g');
    if (content.match(bgRegex)) {
      content = content.replace(bgRegex, `bg-${token}`);
      modified = true;
    }

    // border-[#color] -> border-{token}
    const borderRegex = new RegExp(`border-\\[${hexPattern}\\]`, 'g');
    if (content.match(borderRegex)) {
      content = content.replace(borderRegex, `border-${token}`);
      modified = true;
    }
  }

  // Fix HSL colors in hover/focus states (common pattern)
  // e.g., hover:bg-[hsl(0,0%,96%)] -> hover:bg-secondary
  const hslPatterns = [
    { pattern: /hover:bg-\[hsl\([^\]]+\)\]/g, replacement: 'hover:bg-secondary' },
    { pattern: /bg-\[hsl\([^\]]+\)\]/g, replacement: 'bg-secondary' },
    { pattern: /text-\[hsl\([^\]]+\)\]/g, replacement: 'text-muted-foreground' },
    { pattern: /border-\[hsl\([^\]]+\)\]/g, replacement: 'border-border' },
  ];

  for (const { pattern, replacement } of hslPatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

async function main() {
  console.log('🔍 Finding files with design system violations...\n');

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
