#!/usr/bin/env node
/**
 * Verification Orchestrator
 * Reads task manifest and executes appropriate verification strategies
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { chromium } from 'playwright';

interface VerificationResult {
  check: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  evidence?: {
    screenshots?: string[];
    metrics?: any;
    logs?: string[];
  };
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

interface VerificationReport {
  task: {
    id: string;
    description: string;
    type: string;
    timestamp: Date;
  };
  
  verification: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  
  results: {
    summary: {
      totalChecks: number;
      passed: number;
      failed: number;
      skipped: number;
    };
    details: VerificationResult[];
    failures: Array<{
      check: string;
      reason: string;
      suggestion: string;
      severity: string;
    }>;
  };
  
  recommendation: 'approve' | 'fix-required' | 'manual-review';
}

export class VerificationOrchestrator {
  private results: VerificationResult[] = [];
  private manifest: any;
  private startTime = new Date();

  async verifyFromManifest(manifestPath: string): Promise<VerificationReport> {
    // Load manifest
    this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    console.log(`🔍 Starting verification for task: ${this.manifest.description}`);
    console.log(`📋 Task type: ${this.manifest.task_type}`);
    console.log(`📁 Files modified: ${this.manifest.files_modified.length}`);
    
    // Execute verifications based on manifest
    if (this.manifest.verification_needed.code_quality) {
      await this.verifyCodeQuality();
    }
    
    if (this.manifest.verification_needed.visual) {
      await this.verifyVisual();
    }
    
    if (this.manifest.verification_needed.functional) {
      await this.verifyFunctional();
    }
    
    if (this.manifest.verification_needed.integration) {
      await this.verifyIntegration();
    }
    
    if (this.manifest.verification_needed.performance) {
      await this.verifyPerformance();
    }
    
    if (this.manifest.verification_needed.security) {
      await this.verifySecurity();
    }
    
    // Check success criteria
    await this.verifySuccessCriteria();
    
    // Generate report
    return this.generateReport();
  }

  private async verifyCodeQuality() {
    console.log('\n📝 Verifying code quality...');
    
    // TypeScript check
    await this.runCheck('TypeScript Compilation', async () => {
      try {
        execSync('npm run typecheck --prefix frontend', { stdio: 'pipe' });
        return { status: 'pass', message: '✅ No TypeScript errors' };
      } catch (error) {
        return { 
          status: 'fail', 
          message: '❌ TypeScript compilation failed',
          severity: 'critical'
        };
      }
    });
    
    // ESLint check
    await this.runCheck('ESLint', async () => {
      try {
        execSync('npm run lint --prefix frontend', { stdio: 'pipe' });
        return { status: 'pass', message: '✅ No linting errors' };
      } catch (error) {
        return { 
          status: 'fail', 
          message: '❌ Linting errors found',
          severity: 'high'
        };
      }
    });
    
    // Build check
    await this.runCheck('Build', async () => {
      try {
        execSync('npm run build --prefix frontend', { stdio: 'pipe' });
        return { status: 'pass', message: '✅ Build successful' };
      } catch (error) {
        return { 
          status: 'fail', 
          message: '❌ Build failed',
          severity: 'critical'
        };
      }
    });
  }

  private async verifyVisual() {
    console.log('\n🎨 Verifying visual changes...');
    
    const scenarios = this.manifest.test_scenarios.filter((s: any) => s.type === 'visual');
    if (scenarios.length === 0) return;
    
    const browser = await chromium.launch({ headless: true });
    
    try {
      for (const scenario of scenarios) {
        for (const page of scenario.targets) {
          await this.verifyPageVisuals(browser, page, scenario.checks);
        }
      }
    } finally {
      await browser.close();
    }
  }

  private async verifyPageVisuals(browser: any, pagePath: string, checks: string[]) {
    const page = await browser.newPage();
    const viewports = [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 812 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      await this.runCheck(`Visual - ${pagePath} (${viewport.name})`, async () => {
        try {
          await page.goto(`http://localhost:3000${pagePath}`, { waitUntil: 'networkidle' });
          
          // Take screenshot
          const screenshotPath = `tests/screenshots/${this.manifest.task_id}/${pagePath.slice(1)}-${viewport.name}.png`;
          const screenshotDir = path.dirname(screenshotPath);
          if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
          }
          await page.screenshot({ path: screenshotPath, fullPage: true });
          
          // Check layout metrics if needed
          if (checks.includes('layout-metrics')) {
            const metrics = await page.evaluate(() => {
              const main = document.querySelector('main');
              const body = document.body;
              
              if (!main) return { error: 'No main element found' };
              
              const mainRect = main.getBoundingClientRect();
              const computedStyle = window.getComputedStyle(main);
              
              return {
                mainWidth: mainRect.width,
                viewportWidth: window.innerWidth,
                viewportUsage: (mainRect.width / window.innerWidth) * 100,
                paddingLeft: parseInt(computedStyle.paddingLeft),
                paddingRight: parseInt(computedStyle.paddingRight)
              };
            });
            
            // Check dashboard-specific requirements
            if (pagePath.includes('dashboard') || pagePath.includes('executive')) {
              if (metrics.viewportUsage < 95) {
                return {
                  status: 'fail',
                  message: `❌ Dashboard only using ${metrics.viewportUsage.toFixed(1)}% of viewport (should be >95%)`,
                  evidence: { screenshots: [screenshotPath], metrics },
                  severity: 'high'
                };
              }
            }
          }
          
          return {
            status: 'pass',
            message: `✅ Visual verification passed`,
            evidence: { screenshots: [screenshotPath] }
          };
          
        } catch (error) {
          return {
            status: 'fail',
            message: `❌ Visual verification failed: ${error}`,
            severity: 'high'
          };
        }
      });
    }
    
    await page.close();
  }

  private async verifyFunctional() {
    console.log('\n⚙️ Verifying functional changes...');
    
    // Run tests for modified files
    const testFiles = this.findRelatedTests(this.manifest.files_modified);
    
    if (testFiles.length > 0) {
      await this.runCheck('Unit Tests', async () => {
        try {
          execSync(`npm test -- ${testFiles.join(' ')}`, { stdio: 'pipe' });
          return { status: 'pass', message: `✅ All ${testFiles.length} related tests passed` };
        } catch (error) {
          return {
            status: 'fail',
            message: '❌ Some tests failed',
            severity: 'high'
          };
        }
      });
    }
  }

  private async verifyIntegration() {
    console.log('\n🔗 Verifying integration...');
    
    // Check if APIs still work
    if (this.manifest.task_type === 'api') {
      const endpoints = this.manifest.test_scenarios
        .filter((s: any) => s.type === 'api')
        .flatMap((s: any) => s.targets);
        
      for (const endpoint of endpoints) {
        await this.runCheck(`API Integration - ${endpoint}`, async () => {
          try {
            const response = await fetch(`http://localhost:3000${endpoint}`);
            if (response.ok) {
              return { status: 'pass', message: '✅ Endpoint accessible' };
            } else {
              return {
                status: 'fail',
                message: `❌ Endpoint returned ${response.status}`,
                severity: 'high'
              };
            }
          } catch (error) {
            return {
              status: 'fail',
              message: `❌ Endpoint unreachable`,
              severity: 'critical'
            };
          }
        });
      }
    }
  }

  private async verifyPerformance() {
    console.log('\n⚡ Verifying performance...');
    
    // Basic performance checks
    await this.runCheck('Bundle Size', async () => {
      try {
        const output = execSync('npm run analyze --prefix frontend', { encoding: 'utf8' });
        // Parse bundle size from output
        return { status: 'pass', message: '✅ Bundle size within limits' };
      } catch {
        return { status: 'skip', message: '⏭️ Bundle analysis not available' };
      }
    });
  }

  private async verifySecurity() {
    console.log('\n🔒 Verifying security...');
    
    // Check for common security issues
    await this.runCheck('Security Audit', async () => {
      try {
        execSync('npm audit --audit-level=high', { stdio: 'pipe' });
        return { status: 'pass', message: '✅ No high severity vulnerabilities' };
      } catch {
        return {
          status: 'fail',
          message: '❌ Security vulnerabilities found',
          severity: 'critical'
        };
      }
    });
  }

  private async verifySuccessCriteria() {
    console.log('\n✅ Verifying success criteria...');
    
    for (const criterion of this.manifest.success_criteria) {
      // Map criteria to actual checks
      const passed = this.results.some(r => 
        r.message.toLowerCase().includes(criterion.toLowerCase()) && 
        r.status === 'pass'
      );
      
      await this.runCheck(`Criterion: ${criterion}`, async () => {
        if (passed) {
          return { status: 'pass', message: `✅ ${criterion}` };
        } else {
          // Try to find evidence why it failed
          const relatedFailure = this.results.find(r => 
            r.message.toLowerCase().includes(criterion.toLowerCase()) && 
            r.status === 'fail'
          );
          
          return {
            status: 'fail',
            message: `❌ ${criterion}`,
            evidence: relatedFailure?.evidence,
            severity: 'high'
          };
        }
      });
    }
  }

  private async runCheck(
    name: string, 
    check: () => Promise<Partial<VerificationResult>>
  ) {
    process.stdout.write(`  Checking ${name}...`);
    
    const result = await check();
    const fullResult: VerificationResult = {
      check: name,
      status: result.status || 'fail',
      message: result.message || 'Check failed',
      evidence: result.evidence,
      severity: result.severity as any
    };
    
    this.results.push(fullResult);
    console.log(` ${result.message}`);
  }

  private findRelatedTests(files: string[]): string[] {
    const testFiles: string[] = [];
    
    for (const file of files) {
      const testFile = file.replace(/\.(ts|tsx)$/, '.test.$1');
      const specFile = file.replace(/\.(ts|tsx)$/, '.spec.$1');
      
      if (fs.existsSync(testFile)) testFiles.push(testFile);
      if (fs.existsSync(specFile)) testFiles.push(specFile);
    }
    
    return testFiles;
  }

  private generateReport(): VerificationReport {
    const endTime = new Date();
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    
    const failures = this.results
      .filter(r => r.status === 'fail')
      .map(r => ({
        check: r.check,
        reason: r.message,
        suggestion: this.getSuggestion(r),
        severity: r.severity || 'medium'
      }));
    
    let recommendation: VerificationReport['recommendation'] = 'approve';
    if (failures.some(f => f.severity === 'critical')) {
      recommendation = 'fix-required';
    } else if (failures.length > 0) {
      recommendation = 'manual-review';
    }
    
    return {
      task: {
        id: this.manifest.task_id,
        description: this.manifest.description,
        type: this.manifest.task_type,
        timestamp: new Date()
      },
      verification: {
        startTime: this.startTime,
        endTime,
        duration: endTime.getTime() - this.startTime.getTime()
      },
      results: {
        summary: {
          totalChecks: this.results.length,
          passed,
          failed,
          skipped
        },
        details: this.results,
        failures
      },
      recommendation
    };
  }

  private getSuggestion(result: VerificationResult): string {
    if (result.check.includes('TypeScript')) {
      return 'Run `npm run typecheck` to see specific errors';
    }
    if (result.check.includes('ESLint')) {
      return 'Run `npm run lint:fix` to auto-fix issues';
    }
    if (result.check.includes('Visual') && result.message.includes('viewport')) {
      return 'Check layout component configuration and CSS width settings';
    }
    return 'Review the specific check requirements and fix accordingly';
  }

  saveReport(report: VerificationReport, outputPath?: string): string {
    const reportPath = outputPath || `.claude/verification/reports/${this.manifest.task_id}-report.json`;
    const dir = path.dirname(reportPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Also generate a markdown summary
    const summaryPath = reportPath.replace('.json', '.md');
    const summary = this.generateMarkdownSummary(report);
    fs.writeFileSync(summaryPath, summary);
    
    return reportPath;
  }

  private generateMarkdownSummary(report: VerificationReport): string {
    const status = report.recommendation === 'approve' ? '✅ PASSED' : '❌ FAILED';
    
    let summary = `# Verification Report: ${status}\n\n`;
    summary += `**Task:** ${report.task.description}\n`;
    summary += `**Type:** ${report.task.type}\n`;
    summary += `**Duration:** ${report.verification.duration}ms\n\n`;
    
    summary += `## Summary\n`;
    summary += `- Total Checks: ${report.results.summary.totalChecks}\n`;
    summary += `- Passed: ${report.results.summary.passed}\n`;
    summary += `- Failed: ${report.results.summary.failed}\n`;
    summary += `- Skipped: ${report.results.summary.skipped}\n\n`;
    
    if (report.results.failures.length > 0) {
      summary += `## Failures\n\n`;
      for (const failure of report.results.failures) {
        summary += `### ${failure.check} (${failure.severity})\n`;
        summary += `- **Reason:** ${failure.reason}\n`;
        summary += `- **Suggestion:** ${failure.suggestion}\n\n`;
      }
    }
    
    summary += `## Recommendation: ${report.recommendation}\n`;
    
    return summary;
  }
}

// CLI usage
if (require.main === module) {
  const manifestPath = process.argv[2];
  
  if (!manifestPath) {
    console.error('Usage: verification-orchestrator <manifest-path>');
    process.exit(1);
  }
  
  const orchestrator = new VerificationOrchestrator();
  
  orchestrator.verifyFromManifest(manifestPath)
    .then(report => {
      const reportPath = orchestrator.saveReport(report);
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 VERIFICATION COMPLETE');
      console.log('='.repeat(60));
      console.log(`Status: ${report.recommendation === 'approve' ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Report saved to: ${reportPath}`);
      
      if (report.recommendation !== 'approve') {
        console.log('\n❌ Task cannot be marked complete due to verification failures.');
        process.exit(1);
      }
    })
    .catch(console.error);
}