/**
 * Procore Public Documentation Screenshot Capture
 * 
 * This script captures screenshots from Procore's public support documentation.
 * No authentication required - these are publicly accessible help pages.
 * 
 * Usage: npx playwright test capture-public-docs.ts
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Output directory for screenshots
const OUTPUT_DIR = './procore-screenshots';
const SCREENSHOT_DELAY = 1000; // Wait for page to stabilize

// Procore documentation structure - comprehensive list of tools/modules
const PROCORE_MODULES = {
  // Project Management Tools
  projectManagement: [
    { name: 'project-overview', url: 'https://support.procore.com/products/online/user-guide/project-level/home' },
    { name: 'daily-log', url: 'https://support.procore.com/products/online/user-guide/project-level/daily-log' },
    { name: 'directory', url: 'https://support.procore.com/products/online/user-guide/project-level/directory' },
    { name: 'documents', url: 'https://support.procore.com/products/online/user-guide/project-level/documents' },
    { name: 'drawings', url: 'https://support.procore.com/products/online/user-guide/project-level/drawings' },
    { name: 'emails', url: 'https://support.procore.com/products/online/user-guide/project-level/emails' },
    { name: 'meetings', url: 'https://support.procore.com/products/online/user-guide/project-level/meetings' },
    { name: 'photos', url: 'https://support.procore.com/products/online/user-guide/project-level/photos' },
    { name: 'reports', url: 'https://support.procore.com/products/online/user-guide/project-level/reports' },
    { name: 'schedule', url: 'https://support.procore.com/products/online/user-guide/project-level/schedule' },
    { name: 'specifications', url: 'https://support.procore.com/products/online/user-guide/project-level/specifications' },
    { name: 'tasks', url: 'https://support.procore.com/products/online/user-guide/project-level/tasks' },
  ],
  
  // Quality & Safety Tools
  qualitySafety: [
    { name: 'inspections', url: 'https://support.procore.com/products/online/user-guide/project-level/inspections' },
    { name: 'incidents', url: 'https://support.procore.com/products/online/user-guide/project-level/incidents' },
    { name: 'observations', url: 'https://support.procore.com/products/online/user-guide/project-level/observations' },
    { name: 'action-plans', url: 'https://support.procore.com/products/online/user-guide/project-level/action-plans' },
    { name: 'punch-list', url: 'https://support.procore.com/products/online/user-guide/project-level/punch-list' },
  ],
  
  // Project Financials
  projectFinancials: [
    { name: 'budget', url: 'https://support.procore.com/products/online/user-guide/project-level/budget' },
    { name: 'change-events', url: 'https://support.procore.com/products/online/user-guide/project-level/change-events' },
    { name: 'change-orders', url: 'https://support.procore.com/products/online/user-guide/project-level/change-orders' },
    { name: 'commitments', url: 'https://support.procore.com/products/online/user-guide/project-level/commitments' },
    { name: 'direct-costs', url: 'https://support.procore.com/products/online/user-guide/project-level/direct-costs' },
    { name: 'invoicing', url: 'https://support.procore.com/products/online/user-guide/project-level/invoicing' },
    { name: 'prime-contracts', url: 'https://support.procore.com/products/online/user-guide/project-level/prime-contract' },
  ],
  
  // Design Coordination
  designCoordination: [
    { name: 'coordination-issues', url: 'https://support.procore.com/products/online/user-guide/project-level/coordination-issues' },
    { name: 'models', url: 'https://support.procore.com/products/online/user-guide/project-level/models' },
    { name: 'rfi', url: 'https://support.procore.com/products/online/user-guide/project-level/rfi' },
    { name: 'submittals', url: 'https://support.procore.com/products/online/user-guide/project-level/submittals' },
  ],
  
  // Company Level Tools
  companyLevel: [
    { name: 'company-directory', url: 'https://support.procore.com/products/online/user-guide/company-level/directory' },
    { name: 'admin', url: 'https://support.procore.com/products/online/user-guide/company-level/admin' },
    { name: 'portfolio', url: 'https://support.procore.com/products/online/user-guide/company-level/portfolio' },
  ],
  
  // Bidding & Preconstruction  
  bidding: [
    { name: 'bidding', url: 'https://support.procore.com/products/online/user-guide/project-level/bidding' },
    { name: 'estimating', url: 'https://support.procore.com/products/online/user-guide/project-level/estimating' },
  ],
};

// Create output directory structure
function setupDirectories() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  Object.keys(PROCORE_MODULES).forEach(category => {
    const categoryDir = path.join(OUTPUT_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }
  });
}

// Capture full page screenshot
async function captureFullPage(page: Page, name: string, category: string) {
  const filePath = path.join(OUTPUT_DIR, category, `${name}.png`);
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(SCREENSHOT_DELAY);
  
  // Hide cookie banners and modals if present
  await page.evaluate(() => {
    const selectors = [
      '.cookie-banner',
      '.modal-backdrop',
      '[data-testid="cookie-consent"]',
      '.intercom-lightweight-app',
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    });
  });
  
  // Capture full page
  await page.screenshot({
    path: filePath,
    fullPage: true,
  });
  
  console.log(`✓ Captured: ${filePath}`);
  return filePath;
}

// Extract all images from a page
async function extractImages(page: Page, name: string, category: string) {
  const imagesDir = path.join(OUTPUT_DIR, category, `${name}-images`);
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  // Get all image URLs from the page
  const imageUrls = await page.evaluate(() => {
    const images: string[] = [];
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.dataset.src;
      if (src && !src.includes('data:') && !src.includes('avatar')) {
        images.push(src);
      }
    });
    return [...new Set(images)]; // Remove duplicates
  });
  
  console.log(`Found ${imageUrls.length} images on ${name}`);
  return imageUrls;
}

// Main test to capture all documentation
test('Capture Procore Public Documentation', async ({ page }) => {
  setupDirectories();
  
  const results: { category: string; name: string; url: string; screenshot: string; images: string[] }[] = [];
  
  for (const [category, modules] of Object.entries(PROCORE_MODULES)) {
    console.log(`\n📁 Processing category: ${category}`);
    
    for (const module of modules) {
      try {
        console.log(`  → Navigating to: ${module.name}`);
        await page.goto(module.url, { waitUntil: 'networkidle', timeout: 30000 });
        
        const screenshot = await captureFullPage(page, module.name, category);
        const images = await extractImages(page, module.name, category);
        
        results.push({
          category,
          name: module.name,
          url: module.url,
          screenshot,
          images,
        });
        
        // Also capture tutorial subpages if available
        const tutorialLinks = await page.evaluate(() => {
          const links: string[] = [];
          document.querySelectorAll('a[href*="/tutorials/"]').forEach(a => {
            const href = (a as HTMLAnchorElement).href;
            if (href && !links.includes(href)) {
              links.push(href);
            }
          });
          return links.slice(0, 5); // Limit to first 5 tutorials per module
        });
        
        for (let i = 0; i < tutorialLinks.length; i++) {
          try {
            await page.goto(tutorialLinks[i], { waitUntil: 'networkidle', timeout: 30000 });
            await captureFullPage(page, `${module.name}-tutorial-${i + 1}`, category);
          } catch (e) {
            console.log(`    ⚠ Could not capture tutorial: ${tutorialLinks[i]}`);
          }
        }
        
      } catch (error) {
        console.error(`  ✗ Error capturing ${module.name}: ${error}`);
      }
    }
  }
  
  // Save results manifest
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Manifest saved to: ${manifestPath}`);
});

// Test to specifically capture embedded UI screenshots from help articles
test('Extract UI Screenshots from Help Articles', async ({ page }) => {
  const screenshotDir = path.join(OUTPUT_DIR, 'ui-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  
  // These pages typically have the most UI screenshots
  const keyPages = [
    'https://support.procore.com/products/online/user-guide/project-level/budget/tutorials',
    'https://support.procore.com/products/online/user-guide/project-level/rfi/tutorials',
    'https://support.procore.com/products/online/user-guide/project-level/submittals/tutorials',
    'https://support.procore.com/products/online/user-guide/project-level/change-orders/tutorials',
    'https://support.procore.com/products/online/user-guide/project-level/daily-log/tutorials',
    'https://support.procore.com/products/online/user-guide/project-level/drawings/tutorials',
    'https://support.procore.com/products/online/user-guide/project-level/punch-list/tutorials',
  ];
  
  for (const pageUrl of keyPages) {
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle' });
      
      // Get all tutorial links
      const tutorialLinks = await page.$$eval('a[href*="/tutorials/"]', anchors => 
        anchors.map(a => (a as HTMLAnchorElement).href)
      );
      
      const uniqueLinks = [...new Set(tutorialLinks)].slice(0, 10);
      
      for (const link of uniqueLinks) {
        try {
          await page.goto(link, { waitUntil: 'networkidle' });
          
          // Download all images that look like UI screenshots
          const images = await page.$$eval('img[src*="support.procore.com"]', imgs =>
            imgs.map(img => ({
              src: img.src,
              alt: img.alt,
              width: img.naturalWidth,
            })).filter(img => img.width > 400) // Filter for larger images (likely screenshots)
          );
          
          for (const img of images) {
            console.log(`Found UI screenshot: ${img.alt || 'unnamed'} (${img.width}px)`);
          }
          
        } catch (e) {
          console.log(`Could not process: ${link}`);
        }
      }
    } catch (e) {
      console.log(`Could not process page: ${pageUrl}`);
    }
  }
});
