const path = require('path');

const repoRoot = __dirname;
const eslintWrapper = path.join(repoRoot, 'scripts', 'lint-staged', 'run-frontend-eslint.sh');
const debtScript = path.join(repoRoot, 'frontend', 'scripts', 'check-no-new-eslint-debt.mjs');
const frontendRoot = path.join(repoRoot, 'frontend');
const quoteArg = (value) => JSON.stringify(value.replaceAll(path.sep, '/'));

// lint-staged 16 spawns commands without a shell, which breaks `cd X && Y`
// constructs and breaks single-quoted JSON arguments (the string-argv tokenizer
// does not understand bash's `'\''` close-and-reopen sequence). We delegate to
// a small bash wrapper that handles the cwd switch and the strict-rule
// override correctly.
// See scripts/lint-staged/run-frontend-eslint.sh

// lint-staged passes absolute paths; convert to paths relative to frontend/
// so the eslint invocation (which sets cwd=frontend/) finds them.
const toFrontendRelative = (absPaths) =>
  absPaths
    .map((p) => quoteArg(path.relative(frontendRoot, p)))
    .join(' ');

module.exports = {
  'frontend/**/*.{ts,tsx,js,jsx}': (filenames) => {
    const rel = toFrontendRelative(filenames);
    return [
      // Fix what can be auto-fixed
      `${quoteArg(eslintWrapper)} fix ${rel}`,
      // Then enforce strict design-system rules on changed files only (ratchet-down pattern).
      // Global config keeps many rules at "warn" due to legacy debt, but staged changes
      // must not introduce new drift.
      `${quoteArg(eslintWrapper)} strict ${rel}`,
      // Block adding new design-system eslint-disable escapes.
      'node frontend/scripts/design-system/check-no-new-disables.mjs',
      // Block any new lint warnings/errors on added lines in staged files.
      `node ${quoteArg(debtScript)} --staged`,
      // Ratchet no-new-any on staged changes only; existing debt is handled separately.
      'node scripts/check-no-new-any.mjs --staged',
    ];
  },
};
