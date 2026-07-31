#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Sample data for different tools
const samplePages = [
  // Budget Tool
  {
    url: 'https://support.procore.com/en/products/project-level/budget/user-guide/budget-line-items',
    title: 'Budget Line Items',
    tool: 'budget',
    chunks: 15,
    withEmbeddings: 15,
  },
  {
    url: 'https://support.procore.com/en/products/project-level/budget/user-guide/budget-modifications',
    title: 'Budget Modifications',
    tool: 'budget',
    chunks: 12,
    withEmbeddings: 12,
  },
  {
    url: 'https://support.procore.com/en/products/project-level/budget/user-guide/budget-forecasting',
    title: 'Budget Forecasting',
    tool: 'budget',
    chunks: 20,
    withEmbeddings: 18,
  },
  {
    url: 'https://support.procore.com/en/products/project-level/budget/tutorials/import-budget',
    title: 'Import Budget Tutorial',
    tool: 'budget',
    chunks: 8,
    withEmbeddings: 8,
  },
  
  // Commitments Tool
  {
    url: 'https://support.procore.com/en/products/project-level/commitments/user-guide/create-commitment',
    title: 'Create Commitment',
    tool: 'commitments',
    chunks: 10,
    withEmbeddings: 10,
  },
  {
    url: 'https://support.procore.com/en/products/project-level/commitments/user-guide/commitment-change-orders',
    title: 'Commitment Change Orders',
    tool: 'commitments',
    chunks: 15,
    withEmbeddings: 14,
  },
  {
    url: 'https://support.procore.com/en/products/project-level/commitments/user-guide/schedule-of-values',
    title: 'Schedule of Values',
    tool: 'commitments',
    chunks: 18,
    withEmbeddings: 17,
  },
  
  // Directory Tool
  {
    url: 'https://support.procore.com/en/products/project-level/directory/user-guide/add-user-to-project',
    title: 'Add User to Project',
    tool: 'directory',
    chunks: 6,
    withEmbeddings: 6,
  },
  {
    url: 'https://support.procore.com/en/products/project-level/directory/user-guide/manage-permissions',
    title: 'Manage Permissions',
    tool: 'directory',
    chunks: 12,
    withEmbeddings: 12,
  },
  {
    url: 'https://support.procore.com/en/products/company-level/directory/user-guide/company-directory',
    title: 'Company Directory',
    tool: 'directory',
    chunks: 8,
    withEmbeddings: 8,
  },
  
  // Change Events
  {
    url: 'https://support.procore.com/en/products/project-level/change-events/user-guide/create-change-event',
    title: 'Create Change Event',
    tool: 'change-events',
    chunks: 10,
    withEmbeddings: 10,
  },
  {
    url: 'https://support.procore.com/en/products/project-level/change-events/user-guide/change-event-line-items',
    title: 'Change Event Line Items',
    tool: 'change-events',
    chunks: 14,
    withEmbeddings: 13,
  },
  
  // Documents Tool
  {
    url: 'https://support.procore.com/en/products/project-level/documents/user-guide/upload-files',
    title: 'Upload Files',
    tool: 'documents',
    chunks: 8,
    withEmbeddings: 8,
  },
  {
    url: 'https://support.procore.com/en/products/project-level/documents/user-guide/document-versioning',
    title: 'Document Versioning',
    tool: 'documents',
    chunks: 12,
    withEmbeddings: 11,
  },
  
  // Drawings Tool
  {
    url: 'https://support.procore.com/en/products/project-level/drawings/user-guide/upload-drawings',
    title: 'Upload Drawings',
    tool: 'drawings',
    chunks: 10,
    withEmbeddings: 10,
  },
  
  // RFIs Tool
  {
    url: 'https://support.procore.com/en/products/project-level/rfis/user-guide/create-rfi',
    title: 'Create RFI',
    tool: 'rfis',
    chunks: 12,
    withEmbeddings: 12,
  },
  {
    url: 'https://support.procore.com/en/products/project-level/rfis/user-guide/respond-to-rfi',
    title: 'Respond to RFI',
    tool: 'rfis',
    chunks: 8,
    withEmbeddings: 8,
  },
  
  // Daily Log
  {
    url: 'https://support.procore.com/en/products/project-level/daily-log/user-guide/create-daily-log-entry',
    title: 'Create Daily Log Entry',
    tool: 'daily-log',
    chunks: 10,
    withEmbeddings: 9,
  },
  
  // Punch List
  {
    url: 'https://support.procore.com/en/products/project-level/punch-list/user-guide/create-punch-item',
    title: 'Create Punch Item',
    tool: 'punch-list',
    chunks: 8,
    withEmbeddings: 8,
  },
  
  // Direct Costs
  {
    url: 'https://support.procore.com/en/products/project-level/direct-costs/user-guide/create-direct-cost',
    title: 'Create Direct Cost',
    tool: 'direct-costs',
    chunks: 10,
    withEmbeddings: 10,
  },
  
  // Resource pages
  {
    url: 'https://support.procore.com/en/tutorials/getting-started-with-procore',
    title: 'Getting Started with Procore',
    tool: null,
    resourceType: 'tutorials',
    chunks: 15,
    withEmbeddings: 15,
  },
  {
    url: 'https://support.procore.com/en/videos/budget-overview-video',
    title: 'Budget Overview Video',
    tool: null,
    resourceType: 'videos',
    chunks: 5,
    withEmbeddings: 5,
  },
  {
    url: 'https://support.procore.com/en/faq/how-do-i-create-a-project',
    title: 'How Do I Create a Project?',
    tool: null,
    resourceType: 'faq',
    chunks: 3,
    withEmbeddings: 3,
  },
  {
    url: 'https://developers.procore.com/reference/rest/v1/projects',
    title: 'Projects API Reference',
    tool: null,
    resourceType: 'api-docs',
    chunks: 20,
    withEmbeddings: 18,
  },
];

async function seedCrawledPages() {
  try {
    // First ensure the source exists
    console.log('📦 Checking for procore-docs source...');
    const { data: existingSource } = await supabase
      .from('sources')
      .select('*')
      .eq('source_id', 'procore-docs')
      .single();
    
    if (!existingSource) {
      console.log('Creating procore-docs source...');
      const { error: sourceError } = await supabase
        .from('sources')
        .insert({
          source_id: 'procore-docs',
          summary: 'Procore documentation pages',
          total_word_count: 0
        });
      
      if (sourceError) {
        console.error('Error creating source:', sourceError);
        return;
      }
    }

    console.log('🧹 Clearing existing crawled_pages data...');
    const { error: deleteError } = await supabase
      .from('crawled_pages')
      .delete()
      .gte('id', 0); // Delete all records
    
    if (deleteError) {
      console.error('Error clearing data:', deleteError);
      return;
    }

    console.log('🌱 Seeding crawled_pages table...');
    
    const allChunks = [];
    
    for (const page of samplePages) {
      // Create chunks for each page
      for (let i = 0; i < page.chunks; i++) {
        const hasEmbedding = i < page.withEmbeddings;
        
        allChunks.push({
          url: page.url,
          source_id: 'procore-docs', // Use a fixed source_id
          chunk_number: i,
          content: `Sample content for ${page.title} - Chunk ${i + 1}`,
          embedding: hasEmbedding ? `[${new Array(1536).fill(0.1).join(',')}]` : null,
          category: page.tool || page.resourceType || null,
          metadata: {
            tool: page.tool || null,
            resourceType: page.resourceType || null,
            title: page.title,
            chunkIndex: i,
            totalChunks: page.chunks,
          },
          created_at: new Date().toISOString(),
        });
      }
    }
    
    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const { error } = await supabase
        .from('crawled_pages')
        .insert(batch);
      
      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        return;
      }
      
      console.log(`✅ Inserted batch ${i / batchSize + 1} of ${Math.ceil(allChunks.length / batchSize)}`);
    }
    
    console.log(`\n✅ Successfully seeded ${allChunks.length} chunks across ${samplePages.length} pages`);
    
    // Summary
    const toolPages = samplePages.filter(p => p.tool).length;
    const resourcePages = samplePages.filter(p => p.resourceType).length;
    console.log(`\n📊 Summary:`);
    console.log(`   - Tool pages: ${toolPages}`);
    console.log(`   - Resource pages: ${resourcePages}`);
    console.log(`   - Total chunks: ${allChunks.length}`);
    console.log(`   - Chunks with embeddings: ${allChunks.filter(c => c.embedding).length}`);
    
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

// Run the seed function
seedCrawledPages();