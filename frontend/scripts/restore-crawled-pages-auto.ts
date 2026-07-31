#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';
import { glob } from 'glob';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

async function getOrCreateSourceId() {
  // For crawled_pages, source_id is just a string identifier
  // We'll use 'procore-docs' as the source_id
  const sourceId = 'procore-docs';
  console.log('✅ Using source_id:', sourceId);
  return sourceId;
}

async function restoreCrawledPages() {
  console.log('🔄 Starting automated crawled_pages restoration...\n');
  
  // Get the source ID
  const sourceId = await getOrCreateSourceId();
  if (!sourceId) {
    console.error('❌ Could not ensure source exists. Exiting.');
    return;
  }
  
  // Find all detailed report files
  const reportFiles = glob.sync('**/detailed-report.json', {
    ignore: ['**/node_modules/**'],
    cwd: resolve(__dirname, '../..'),
    absolute: true
  });
  
  console.log(`📂 Found ${reportFiles.length} report files to process\n`);
  
  const allPages = new Map<string, any>(); // Use Map to deduplicate by URL
  
  // Process each report file
  for (const reportFile of reportFiles) {
    console.log(`📄 Processing: ${reportFile.replace(resolve(__dirname, '../..'), '.')}`);
    
    try {
      const reportData = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
      const pages = Array.isArray(reportData) ? reportData : [reportData];
      
      pages.forEach((page: CrawlReport) => {
        if (page.url && !allPages.has(page.url)) {
          const category = extractCategoryFromUrl(page.url, page.pageName || '');
          allPages.set(page.url, {
            url: page.url,
            content: page.pageName || page.analysis?.title || 'Untitled',
            category,
            source_id: sourceId,
            created_at: page.timestamp || new Date().toISOString(),
            chunk_number: 0,
            embedding: null,
            metadata: {
              title: page.pageName || page.analysis?.title || 'Untitled',
              pageName: page.pageName,
              links: page.linkDetails?.length || 0,
              hasAnalysis: !!page.analysis
            }
          });
        }
      });
      
      console.log(`  ✅ Extracted ${pages.length} pages`);
    } catch (error) {
      console.error(`  ❌ Error processing ${reportFile}:`, error);
    }
  }
  
  // Also find individual metadata.json files
  const metadataFiles = glob.sync('**/pages/**/metadata.json', {
    ignore: ['**/node_modules/**'],
    cwd: resolve(__dirname, '../..'),
    absolute: true
  });
  
  console.log(`\n📂 Found ${metadataFiles.length} metadata files to process\n`);
  
  for (const metadataFile of metadataFiles) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
      if (metadata.url && !allPages.has(metadata.url)) {
        const category = metadata.category || extractCategoryFromUrl(metadata.url, metadata.pageName || '');
        allPages.set(metadata.url, {
          url: metadata.url,
          content: metadata.pageName || metadata.analysis?.title || 'Untitled',
          category,
          source_id: sourceId,
          created_at: metadata.timestamp || new Date().toISOString(),
          chunk_number: 0,
          embedding: null,
          metadata: {
            title: metadata.pageName || metadata.analysis?.title || 'Untitled',
            pageName: metadata.pageName,
            links: metadata.links || 0,
            hasAnalysis: !!metadata.analysis
          }
        });
      }
    } catch (error) {
      // Silent error for individual files
    }
  }
  
  console.log(`\n📊 Total unique pages found: ${allPages.size}`);
  
  // Filter out procore pay pages
  const pagesToInsert = Array.from(allPages.values()).filter(page => 
    page.category?.toLowerCase() !== 'procore pay'
  );
  
  console.log(`📊 Pages after filtering (excluding procore pay): ${pagesToInsert.length}`);
  
  // Count by category
  const categoryCounts = pagesToInsert.reduce((acc, page) => {
    acc[page.category] = (acc[page.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n📈 Pages by category:');
  Object.entries(categoryCounts).sort(([,a], [,b]) => (b as number) - (a as number)).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  
  console.log(`\n📝 About to insert ${pagesToInsert.length} records...`);
  
  // Insert in batches
  const batchSize = 50; // Smaller batch size for safety
  let inserted = 0;
  let errors = 0;
  
  console.log('\n🚀 Starting insertion...');
  
  for (let i = 0; i < pagesToInsert.length; i += batchSize) {
    const batch = pagesToInsert.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('crawled_pages')
      .insert(batch);
    
    if (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${inserted}/${pagesToInsert.length})`);
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n🎉 Restoration complete!');
  console.log(`✅ Successfully inserted: ${inserted} records`);
  console.log(`❌ Failed insertions: ${errors} records`);
  
  // Verify final count
  const { count } = await supabase
    .from('crawled_pages')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Total records now in crawled_pages table: ${count}`);
}

// Run immediately without confirmation
restoreCrawledPages().catch(console.error);