#!/usr/bin/env node
/**
 * Universal Task Verification Script
 * Run this before marking ANY task as complete
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
  summary: string;
}

class TaskVerifier {
  private results: VerificationResult = {
    passed: true,
    checks: [],
    summary: ''
  };

  async verify(): Promise<VerificationResult> {
    console.log('🔍 Starting Task Verification...\n');

    // 1. TypeScript Check
    await this.runCheck('TypeScript', async () => {
      try {
        execSync('npm run typecheck', { stdio: 'pipe' });
        return { passed: true, message: '✅ No TypeScript errors' };
      } catch (error) {
        return { passed: false, message: '❌ TypeScript errors found' };
      }
    });

    // 2. Linting Check
    await this.runCheck('ESLint', async () => {
      try {
        execSync('npm run lint', { stdio: 'pipe' });
        return { passed: true, message: '✅ No linting errors' };
      } catch (error) {
        return { passed: false, message: '❌ Linting errors found' };
      }
    });

    // 3. Build Check
    await this.runCheck('Build', async () => {
      try {
        execSync('npm run build', { stdio: 'pipe' });
        return { passed: true, message: '✅ Build successful' };
      } catch (error) {
        return { passed: false, message: '❌ Build failed' };
      }
    });

    // 4. Check for console.log statements
    await this.runCheck('Console Logs', async () => {
      try {
        const result = execSync(
          "grep -r 'console.log' src --include='*.ts' --include='*.tsx' | grep -v '// console.log' | wc -l",
          { cwd: process.cwd(), encoding: 'utf8' }
        ).trim();
        
        const count = parseInt(result);
        if (count > 0) {
          return { passed: false, message: `⚠️  Found ${count} console.log statements` };
        }
        return { passed: true, message: '✅ No console.log statements' };
      } catch {
        return { passed: true, message: '✅ No console.log statements' };
      }
    });

    // 5. Check for TODO comments
    await this.runCheck('TODOs', async () => {
      try {
        const result = execSync(
          "grep -r 'TODO' src --include='*.ts' --include='*.tsx' | wc -l",
          { cwd: process.cwd(), encoding: 'utf8' }
        ).trim();
        
        const count = parseInt(result);
        if (count > 0) {
          return { passed: true, message: `⚠️  Found ${count} TODO comments (review needed)` };
        }
        return { passed: true, message: '✅ No TODO comments' };
      } catch {
        return { passed: true, message: '✅ No TODO comments' };
      }
    });

    // Generate summary
    this.generateSummary();

    return this.results;
  }

  private async runCheck(
    name: string,
    check: () => Promise<{ passed: boolean; message: string }>
  ): Promise<void> {
    process.stdout.write(`Checking ${name}...`);
    
    const result = await check();
    this.results.checks.push({ name, ...result });
    
    if (!result.passed) {
      this.results.passed = false;
    }
    
    console.log(` ${result.message}`);
  }

  private generateSummary(): void {
    const passedCount = this.results.checks.filter(c => c.passed).length;
    const totalCount = this.results.checks.length;

    if (this.results.passed) {
      this.results.summary = `✅ All ${totalCount} checks passed! Task is ready for completion.`;
    } else {
      this.results.summary = `❌ ${passedCount}/${totalCount} checks passed. Please fix issues before marking complete.`;
    }
  }

  printReport(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📋 VERIFICATION REPORT');
    console.log('='.repeat(50));
    
    this.results.checks.forEach(check => {
      console.log(`${check.name}: ${check.message}`);
    });
    
    console.log('\n' + this.results.summary);
    console.log('='.repeat(50));

    if (!this.results.passed) {
      console.log('\n⚠️  DO NOT mark this task as complete until all issues are resolved!');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const verifier = new TaskVerifier();
  const results = await verifier.verify();
  verifier.printReport();
}

main().catch(console.error);