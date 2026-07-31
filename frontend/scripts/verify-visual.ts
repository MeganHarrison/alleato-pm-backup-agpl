#!/usr/bin/env node
/**
 * Visual Verification Script
 * Prevents layout issues by verifying visual appearance
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface LayoutMetrics {
  mainWidth: number;
  bodyWidth: number;
  mainPaddingLeft: number;
  mainPaddingRight: number;
  hasEdgePadding: boolean;
  viewportUsage: number;
  sectionSpacing: number[];
}

interface VerificationResult {
  page: string;
  viewport: string;
  passed: boolean;
  metrics: LayoutMetrics;
  issues: string[];
}

class VisualVerifier {
  private browser: Browser | null = null;
  private results: VerificationResult[] = [];
  private baseUrl = 'http://localhost:3000';

  async initialize() {
    this.browser = await chromium.launch({ 
      headless: process.env.HEADLESS !== 'false' 
    });
    
    // Ensure screenshots directory exists
    const screenshotDir = path.join(process.cwd(), 'tests/screenshots/visual-verification');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async verifyPage(pagePath: string, pageType: 'dashboard' | 'form' | 'table' | 'executive') {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    
    // Test different viewports
    const viewports = [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 812 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      try {
        // Navigate and wait for page to stabilize
        await page.goto(`${this.baseUrl}${pagePath}`, { 
          waitUntil: 'networkidle' 
        });
        
        // Wait for layout to stabilize
        await page.waitForTimeout(1000);

        // Take screenshot for manual review
        const screenshotPath = `tests/screenshots/visual-verification/${pagePath.replace(/\//g, '-')}-${viewport.name}.png`;
        await page.screenshot({
          path: screenshotPath,
          fullPage: true
        });

        // Collect layout metrics
        const metrics = await page.evaluate(() => {
          const main = document.querySelector('main');
          const body = document.body;
          
          if (!main) {
            return {
              mainWidth: 0,
              bodyWidth: body.offsetWidth,
              mainPaddingLeft: 0,
              mainPaddingRight: 0,
              hasEdgePadding: false,
              viewportUsage: 0,
              sectionSpacing: []
            };
          }

          const computedStyle = window.getComputedStyle(main);
          const mainRect = main.getBoundingClientRect();
          
          // Check section spacing
          const sections = main.querySelectorAll('section, .space-y-6 > div, .space-y-8 > div');
          const spacings: number[] = [];
          
          for (let i = 1; i < sections.length; i++) {
            const prev = sections[i - 1].getBoundingClientRect();
            const curr = sections[i].getBoundingClientRect();
            spacings.push(curr.top - prev.bottom);
          }

          return {
            mainWidth: mainRect.width,
            bodyWidth: body.offsetWidth,
            mainPaddingLeft: parseInt(computedStyle.paddingLeft),
            mainPaddingRight: parseInt(computedStyle.paddingRight),
            hasEdgePadding: mainRect.left > 0 || parseInt(computedStyle.paddingLeft) > 0,
            viewportUsage: (mainRect.width / window.innerWidth) * 100,
            sectionSpacing: spacings
          };
        });

        // Verify based on page type
        const issues = this.verifyMetrics(metrics, pageType, viewport.name);
        
        this.results.push({
          page: pagePath,
          viewport: viewport.name,
          passed: issues.length === 0,
          metrics,
          issues
        });

        console.log(`✓ Verified ${pagePath} on ${viewport.name}`);
        
      } catch (error) {
        console.error(`✗ Error verifying ${pagePath} on ${viewport.name}:`, error);
        this.results.push({
          page: pagePath,
          viewport: viewport.name,
          passed: false,
          metrics: {} as LayoutMetrics,
          issues: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    }

    await page.close();
  }

  private verifyMetrics(metrics: LayoutMetrics, pageType: string, viewport: string): string[] {
    const issues: string[] = [];

    // Common checks for all page types
    if (!metrics.hasEdgePadding) {
      issues.push('Content touching viewport edges (no edge padding)');
    }

    // Page-specific checks
    switch (pageType) {
      case 'dashboard':
      case 'executive':
        // Dashboards should use most of the viewport
        if (metrics.viewportUsage < 95) {
          issues.push(`Dashboard only using ${metrics.viewportUsage.toFixed(1)}% of viewport (should be >95%)`);
        }
        
        // But should still have some edge padding
        if (metrics.mainPaddingLeft === 0 && metrics.mainPaddingRight === 0) {
          issues.push('Dashboard has no horizontal padding');
        } else if (metrics.mainPaddingLeft > 48 || metrics.mainPaddingRight > 48) {
          issues.push('Dashboard has excessive padding (>48px)');
        }
        break;

      case 'form':
        // Forms should be constrained on desktop
        if (viewport === 'desktop' && metrics.mainWidth > 768) {
          issues.push(`Form is too wide (${metrics.mainWidth}px) - should be constrained`);
        }
        break;

      case 'table':
        // Tables can use full width but need proper padding
        if (metrics.mainPaddingLeft < 16 || metrics.mainPaddingRight < 16) {
          issues.push('Table has insufficient padding (<16px)');
        }
        break;
    }

    // Check section spacing consistency
    if (metrics.sectionSpacing.length > 0) {
      const avgSpacing = metrics.sectionSpacing.reduce((a, b) => a + b, 0) / metrics.sectionSpacing.length;
      const inconsistent = metrics.sectionSpacing.some(s => Math.abs(s - avgSpacing) > avgSpacing * 0.5);
      
      if (inconsistent) {
        issues.push('Inconsistent spacing between sections');
      }
    }

    return issues;
  }

  generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VISUAL VERIFICATION REPORT');
    console.log('='.repeat(60));

    let totalPassed = 0;
    let totalFailed = 0;

    // Group by page
    const pageGroups = this.results.reduce((acc, result) => {
      if (!acc[result.page]) acc[result.page] = [];
      acc[result.page].push(result);
      return acc;
    }, {} as Record<string, VerificationResult[]>);

    for (const [page, results] of Object.entries(pageGroups)) {
      console.log(`\n📄 ${page}`);
      
      for (const result of results) {
        const status = result.passed ? '✅' : '❌';
        console.log(`  ${status} ${result.viewport}`);
        
        if (result.metrics.viewportUsage) {
          console.log(`     Viewport usage: ${result.metrics.viewportUsage.toFixed(1)}%`);
        }
        
        if (result.issues.length > 0) {
          result.issues.forEach(issue => {
            console.log(`     ⚠️  ${issue}`);
          });
          totalFailed++;
        } else {
          totalPassed++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed`);
    
    if (totalFailed > 0) {
      console.log('\n❌ Visual verification failed! Fix issues before marking task complete.');
      console.log('\n📸 Screenshots saved to: tests/screenshots/visual-verification/');
      process.exit(1);
    } else {
      console.log('\n✅ All visual verifications passed!');
    }
  }
}

// Main execution
async function main() {
  const verifier = new VisualVerifier();
  
  try {
    await verifier.initialize();
    
    // Get pages to verify from command line args or use defaults
    const pagesToVerify = process.argv.slice(2);
    
    if (pagesToVerify.length === 0) {
      // Default pages to check
      console.log('No pages specified. Checking common layouts...\n');
      await verifier.verifyPage('/dashboard', 'dashboard');
      await verifier.verifyPage('/executive', 'executive');
      await verifier.verifyPage('/form-project', 'form');
      await verifier.verifyPage('/decisions', 'table');
    } else {
      // Verify specified pages
      for (const pageArg of pagesToVerify) {
        const [path, type] = pageArg.split(':');
        await verifier.verifyPage(path, (type as any) || 'dashboard');
      }
    }
    
    verifier.generateReport();
    
  } catch (error) {
    console.error('Visual verification failed:', error);
    process.exit(1);
  } finally {
    await verifier.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}