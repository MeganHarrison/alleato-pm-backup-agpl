#!/usr/bin/env node

/**
 * Documentation Structure Validator
 *
 * Enforces DOCUMENTATION-STANDARDS.md rules:
 * - Only meta-documentation allowed in /documentation root
 * - All other docs must be in /documentation/docs/[category]/
 * - No files left in /documentation/need to review/ > 7 days
 * - No duplicate documentation files
 */

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.join(__dirname, '../../documentation');
const ALLOWED_ROOT_FILES = [
  'DOCUMENTATION-STANDARDS.md',
  'DOCUMENTATION-QUICK-REFERENCE.md',
  'DOCUMENTATION-SYSTEM-SUMMARY.md',
  'INDEX.md',
  'RULE-VIOLATION-LOG.md',
  'SPACING-QUICK-REFERENCE.md',
  'SPACING-SYSTEM-IMPLEMENTATION.md',
  'CLAUDE-CODE-PERMISSIONS-GUIDE.md',
  'SUBAGENTS-INDEX.md',
  'alleato-budget-template.xlsx', // Template file
  '.DS_Store' // macOS system file
];

const ALLOWED_ROOT_DIRS = [
  'docs',
  'directory',
  'forms',
  'templates',
  'need to review',
  'database',      // Legacy - scheduled for migration to docs/database
  'design-system', // Legacy - scheduled for migration to docs/design-system
  'plans',         // Legacy - scheduled for migration to docs/plans
  '1-plans'        // Legacy - scheduled for cleanup/migration
];

const REVIEW_DIR_MAX_AGE_DAYS = 7;

class DocValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    console.log('🔍 Validating documentation structure...\n');

    this.checkRootFiles();
    this.checkReviewDirectory();
    this.checkDuplicates();

    this.printResults();

    return this.errors.length === 0;
  }

  checkRootFiles() {
    const items = fs.readdirSync(DOCS_ROOT);

    for (const item of items) {
      const itemPath = path.join(DOCS_ROOT, item);
      const stat = fs.statSync(itemPath);

      if (stat.isFile()) {
        if (!ALLOWED_ROOT_FILES.includes(item)) {
          this.errors.push({
            type: 'MISPLACED_FILE',
            file: item,
            message: `File "${item}" should not be in /documentation root`,
            suggestion: this.suggestLocation(item)
          });
        }
      } else if (stat.isDirectory()) {
        if (!ALLOWED_ROOT_DIRS.includes(item)) {
          this.warnings.push({
            type: 'UNKNOWN_DIRECTORY',
            file: item,
            message: `Directory "${item}" is not in the standard structure`
          });
        }
      }
    }
  }

  checkReviewDirectory() {
    const reviewDir = path.join(DOCS_ROOT, 'need to review');

    if (!fs.existsSync(reviewDir)) {
      return;
    }

    const now = Date.now();
    const maxAge = REVIEW_DIR_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    const checkDirectory = (dir) => {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isFile()) {
          const age = now - stat.mtimeMs;
          const ageInDays = Math.floor(age / (24 * 60 * 60 * 1000));

          if (age > maxAge) {
            this.errors.push({
              type: 'STALE_REVIEW_FILE',
              file: path.relative(DOCS_ROOT, itemPath),
              message: `File has been in review for ${ageInDays} days (max: ${REVIEW_DIR_MAX_AGE_DAYS})`,
              suggestion: 'Move to final location or delete if no longer needed'
            });
          }
        } else if (stat.isDirectory()) {
          checkDirectory(itemPath);
        }
      }
    };

    checkDirectory(reviewDir);
  }

  checkDuplicates() {
    const allFiles = this.getAllMarkdownFiles(path.join(DOCS_ROOT, 'docs'));
    const filesByBasename = {};

    for (const file of allFiles) {
      const basename = path.basename(file).toLowerCase();

      if (!filesByBasename[basename]) {
        filesByBasename[basename] = [];
      }
      filesByBasename[basename].push(file);
    }

    for (const [basename, files] of Object.entries(filesByBasename)) {
      if (files.length > 1) {
        this.warnings.push({
          type: 'POTENTIAL_DUPLICATE',
          file: basename,
          message: `Found ${files.length} files with similar names:`,
          files: files.map(f => path.relative(DOCS_ROOT, f))
        });
      }
    }
  }

  getAllMarkdownFiles(dir) {
    const files = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isFile() && item.endsWith('.md')) {
        files.push(itemPath);
      } else if (stat.isDirectory()) {
        files.push(...this.getAllMarkdownFiles(itemPath));
      }
    }

    return files;
  }

  suggestLocation(filename) {
    const lower = filename.toLowerCase();

    if (lower.includes('plan')) {
      return 'docs/plans/[category]/';
    }
    if (lower.includes('complete') || lower.includes('summary') || lower.includes('report')) {
      return 'docs/ops/reports/';
    }
    if (lower.includes('cleanup')) {
      return 'docs/ops/reports/';
    }
    if (lower.includes('architecture') || lower.includes('schema')) {
      return 'docs/architecture/';
    }
    if (lower.includes('api')) {
      return 'docs/api/';
    }
    if (lower.includes('form')) {
      return 'docs/forms/';
    }

    return 'docs/[appropriate-category]/';
  }

  printResults() {
    console.log('\n' + '='.repeat(80));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ Documentation structure is valid!\n');
      return;
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ ERRORS (${this.errors.length}):\n`);

      for (const error of this.errors) {
        console.log(`  ${error.type}: ${error.file}`);
        console.log(`    ${error.message}`);
        if (error.suggestion) {
          console.log(`    → Suggestion: ${error.suggestion}`);
        }
        console.log();
      }
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.warnings.length}):\n`);

      for (const warning of this.warnings) {
        console.log(`  ${warning.type}: ${warning.file}`);
        console.log(`    ${warning.message}`);
        if (warning.files) {
          for (const file of warning.files) {
            console.log(`      - ${file}`);
          }
        }
        console.log();
      }
    }

    console.log('='.repeat(80));
    console.log('\n📚 See DOCUMENTATION-STANDARDS.md for correct file placement\n');

    if (this.errors.length > 0) {
      console.log('❌ Documentation structure validation FAILED');
      console.log('   Fix the errors above before committing.\n');
    }
  }
}

// Run validation
const validator = new DocValidator();
const isValid = validator.validate();

process.exit(isValid ? 0 : 1);
