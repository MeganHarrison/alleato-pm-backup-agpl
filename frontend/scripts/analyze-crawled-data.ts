#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import { resolve, join } from 'path';
import fs from 'fs';
import { glob } from 'glob';

dotenv.config({ path: resolve(__dirname, '../.env') });

interface CrawlReport {
  url: string;
  pageName: string;
  category?: string;
  timestamp?: string;
  analysis?: any;
  linkDetails?: Array<{ href: string; text: string }>;
}

function extractCategoryFromUrl(url: string, pageName: string): string {
  const urlLower = url.toLowerCase();
  const pageNameLower = pageName.toLowerCase();
  
  // Check URL patterns
  if (urlLower.includes('/budget') || pageNameLower.includes('budget')) return 'budget';
  if (urlLower.includes('/commitment') || pageNameLower.includes('commitment')) return 'commitments';
  if (urlLower.includes('/contract') || pageNameLower.includes('contract')) return 'contracts';
  if (urlLower.includes('/prime-contract') || pageNameLower.includes('prime contract')) return 'prime-contracts';
  if (urlLower.includes('/purchase-order') || pageNameLower.includes('purchase order')) return 'purchase-orders';
  if (urlLower.includes('/subcontract') || pageNameLower.includes('subcontract')) return 'subcontracts';
  if (urlLower.includes('/change-event') || pageNameLower.includes('change event')) return 'change-events';
  if (urlLower.includes('/change-order') || pageNameLower.includes('change order')) return 'change-orders';
  if (urlLower.includes('/direct-cost') || pageNameLower.includes('direct cost')) return 'direct-costs';
  if (urlLower.includes('/directory') || pageNameLower.includes('directory')) return 'directory';
  if (urlLower.includes('/daily-log') || pageNameLower.includes('daily log')) return 'daily-log';
  if (urlLower.includes('/drawing') || pageNameLower.includes('drawing')) return 'drawings';
  if (urlLower.includes('/document') || pageNameLower.includes('document')) return 'documents';
  if (urlLower.includes('/punch-list') || pageNameLower.includes('punch list')) return 'punch-list';
  if (urlLower.includes('/rfi') || pageNameLower.includes('rfi')) return 'rfis';
  if (urlLower.includes('/api') || pageNameLower.includes('api')) return 'api-docs';
  if (urlLower.includes('/tutorial') || pageNameLower.includes('tutorial')) return 'tutorials';
  if (urlLower.includes('/video') || pageNameLower.includes('video')) return 'videos';
  if (urlLower.includes('/faq') || pageNameLower.includes('faq')) return 'faq';
  if (urlLower.includes('/procore-pay') || pageNameLower.includes('procore pay')) return 'procore pay';
  
  return 'general';
}

async function analyzeCrawledData() {
  console.log('🔍 Analyzing available crawled data...\n');
  
  // Find all detailed report files
  const reportFiles = glob.sync('**/detailed-report.json', {
    ignore: ['**/node_modules/**'],
    cwd: resolve(__dirname, '../..'),
    absolute: true
  });
  
  console.log(`📂 Found ${reportFiles.length} detailed report files:\n`);
  
  const allPages = new Map<string, any>(); // Use Map to deduplicate by URL
  
  // Process each report file
  for (const reportFile of reportFiles) {
    console.log(`📄 ${reportFile.replace(resolve(__dirname, '../..'), '.')}`);
    
    try {
      const reportData = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
      const pages = Array.isArray(reportData) ? reportData : [reportData];
      
      pages.forEach((page: CrawlReport) => {
        if (page.url && !allPages.has(page.url)) {
          const category = extractCategoryFromUrl(page.url, page.pageName || '');
          allPages.set(page.url, {
            url: page.url,
            title: page.pageName || page.analysis?.title || 'Untitled',
            category
          });
        }
      });
      
      console.log(`  ✅ Contains ${pages.length} pages`);
    } catch (error) {
      console.error(`  ❌ Error reading file`);
    }
  }
  
  // Also find individual metadata.json files
  const metadataFiles = glob.sync('**/pages/**/metadata.json', {
    ignore: ['**/node_modules/**'],
    cwd: resolve(__dirname, '../..'),
    absolute: true
  });
  
  console.log(`\n📂 Found ${metadataFiles.length} individual metadata files`);
  
  let metadataCount = 0;
  for (const metadataFile of metadataFiles) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
      if (metadata.url && !allPages.has(metadata.url)) {
        const category = metadata.category || extractCategoryFromUrl(metadata.url, metadata.pageName || '');
        allPages.set(metadata.url, {
          url: metadata.url,
          title: metadata.pageName || metadata.analysis?.title || 'Untitled',
          category
        });
        metadataCount++;
      }
    } catch (error) {
      // Silent error
    }
  }
  console.log(`  ✅ Added ${metadataCount} additional unique pages from metadata files`);
  
  console.log(`\n📊 Total unique pages found: ${allPages.size}`);
  
  // Filter out procore pay pages
  const pagesToRestore = Array.from(allPages.values()).filter(page => 
    page.category?.toLowerCase() !== 'procore pay'
  );
  
  console.log(`📊 Pages after filtering (excluding procore pay): ${pagesToRestore.length}`);
  
  // Count by category
  const categoryCounts = pagesToRestore.reduce((acc, page) => {
    acc[page.category] = (acc[page.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n📈 Pages by category:');
  Object.entries(categoryCounts).sort(([,a], [,b]) => (b as number) - (a as number)).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  
  console.log('\n💡 Summary:');
  console.log(`  - Total unique URLs found: ${allPages.size}`);
  console.log(`  - URLs to restore (excl. procore pay): ${pagesToRestore.length}`);
  console.log(`  - Categories found: ${Object.keys(categoryCounts).length}`);
  
  console.log('\n✅ Analysis complete!');
  console.log('💡 To restore this data, run: npx tsx scripts/restore-crawled-pages.ts');
}

// Run the analysis
analyzeCrawledData().catch(console.error);