/**
 * AI-Powered Screenshot Analysis
 * 
 * Uses OpenAI's Vision API to analyze Procore screenshots and extract:
 * - UI patterns and components
 * - Color schemes
 * - Information architecture
 * - Potential improvements
 * 
 * Usage:
 *   OPENAI_API_KEY=sk-xxx npx ts-node scripts/analyze-screenshots.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AnalysisResult {
  summary: string;
  components: {
    type: string;
    description: string;
    location: string;
  }[];
  colorPalette: string[];
  informationArchitecture: string;
  uxObservations: string[];
  improvementSuggestions: string[];
  rebuildComplexity: 'low' | 'medium' | 'high' | 'very_high';
  estimatedHours: number;
}

async function analyzeScreenshot(imagePath: string): Promise<AnalysisResult> {
  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/png';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a senior UX designer and frontend developer analyzing screenshots of Procore, a construction management software. 
        
Your task is to analyze the UI and provide structured insights for a potential rebuild. Focus on:
1. Identifying UI components and patterns
2. Understanding the information architecture
3. Noting UX strengths and weaknesses
4. Estimating rebuild complexity

Respond in JSON format only.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this Procore screenshot and provide a structured analysis.

Return a JSON object with these fields:
{
  "summary": "Brief description of what this page/feature does",
  "components": [
    {"type": "component type", "description": "what it does", "location": "where on page"}
  ],
  "colorPalette": ["#hex1", "#hex2", ...],
  "informationArchitecture": "How information is organized on this page",
  "uxObservations": ["observation 1", "observation 2", ...],
  "improvementSuggestions": ["suggestion 1", "suggestion 2", ...],
  "rebuildComplexity": "low|medium|high|very_high",
  "estimatedHours": number
}`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content) as AnalysisResult;
}

async function processUnanalyzedScreenshots(limit: number = 10) {
  // Get screenshots that haven't been analyzed
  const { data: screenshots, error } = await supabase
    .from('procore_screenshots')
    .select('id, name, category, viewport_path, fullpage_path')
    .is('ai_analysis', null)
    .limit(limit);

  if (error) throw error;

  if (!screenshots || screenshots.length === 0) {
    console.log('✅ All screenshots have been analyzed!');
    return;
  }

  console.log(`\n🤖 Analyzing ${screenshots.length} screenshots...\n`);

  for (const screenshot of screenshots) {
    const imagePath = screenshot.viewport_path || screenshot.fullpage_path;
    
    if (!imagePath || !fs.existsSync(imagePath)) {
      console.log(`⚠ Skipping ${screenshot.name}: Image not found at ${imagePath}`);
      continue;
    }

    try {
      console.log(`→ Analyzing: ${screenshot.category}/${screenshot.name}`);
      
      const analysis = await analyzeScreenshot(imagePath);
      
      // Update database with analysis
      await supabase
        .from('procore_screenshots')
        .update({
          ai_analysis: analysis,
          description: analysis.summary,
          color_palette: analysis.colorPalette,
        })
        .eq('id', screenshot.id);

      console.log(`  ✓ Complexity: ${analysis.rebuildComplexity}, Est: ${analysis.estimatedHours}h`);
      console.log(`  ✓ Components: ${analysis.components.length} detected`);
      console.log(`  ✓ Suggestions: ${analysis.improvementSuggestions.length}`);
      
      // Rate limiting - OpenAI has limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`  ✗ Error analyzing ${screenshot.name}:`, error);
    }
  }

  console.log('\n✅ Analysis complete!\n');
}

async function generateRebuildReport() {
  // Get all analyzed screenshots
  const { data: screenshots, error } = await supabase
    .from('procore_screenshots')
    .select('name, category, ai_analysis, description')
    .not('ai_analysis', 'is', null);

  if (error) throw error;

  if (!screenshots || screenshots.length === 0) {
    console.log('No analyzed screenshots found. Run analysis first.');
    return;
  }

  // Aggregate insights
  const report = {
    totalScreenshots: screenshots.length,
    byCategory: {} as Record<string, any>,
    allComponents: [] as string[],
    allSuggestions: [] as string[],
    totalEstimatedHours: 0,
    complexityBreakdown: {
      low: 0,
      medium: 0,
      high: 0,
      very_high: 0,
    },
  };

  for (const screenshot of screenshots) {
    const analysis = screenshot.ai_analysis as AnalysisResult;
    
    // Category breakdown
    if (!report.byCategory[screenshot.category]) {
      report.byCategory[screenshot.category] = {
        count: 0,
        totalHours: 0,
        suggestions: [],
      };
    }
    report.byCategory[screenshot.category].count++;
    report.byCategory[screenshot.category].totalHours += analysis.estimatedHours || 0;
    
    // Aggregate data
    analysis.components?.forEach(c => {
      if (!report.allComponents.includes(c.type)) {
        report.allComponents.push(c.type);
      }
    });
    
    analysis.improvementSuggestions?.forEach(s => {
      if (!report.allSuggestions.includes(s)) {
        report.allSuggestions.push(s);
      }
    });
    
    report.totalEstimatedHours += analysis.estimatedHours || 0;
    report.complexityBreakdown[analysis.rebuildComplexity || 'medium']++;
  }

  // Output report
  console.log('\n' + '═'.repeat(60));
  console.log('   PROCORE REBUILD ANALYSIS REPORT');
  console.log('═'.repeat(60));
  
  console.log(`\n📊 OVERVIEW`);
  console.log(`   Screenshots analyzed: ${report.totalScreenshots}`);
  console.log(`   Total estimated hours: ${report.totalEstimatedHours}`);
  console.log(`   Estimated weeks (1 dev): ${Math.ceil(report.totalEstimatedHours / 40)}`);
  console.log(`   Estimated weeks (2 devs): ${Math.ceil(report.totalEstimatedHours / 80)}`);
  
  console.log(`\n📈 COMPLEXITY BREAKDOWN`);
  console.log(`   Low: ${report.complexityBreakdown.low}`);
  console.log(`   Medium: ${report.complexityBreakdown.medium}`);
  console.log(`   High: ${report.complexityBreakdown.high}`);
  console.log(`   Very High: ${report.complexityBreakdown.very_high}`);
  
  console.log(`\n📁 BY CATEGORY`);
  for (const [category, data] of Object.entries(report.byCategory)) {
    console.log(`   ${category}: ${data.count} screens, ${data.totalHours}h`);
  }
  
  console.log(`\n🧩 UNIQUE COMPONENTS DETECTED (${report.allComponents.length})`);
  report.allComponents.slice(0, 15).forEach(c => console.log(`   • ${c}`));
  if (report.allComponents.length > 15) {
    console.log(`   ... and ${report.allComponents.length - 15} more`);
  }
  
  console.log(`\n💡 TOP IMPROVEMENT SUGGESTIONS`);
  report.allSuggestions.slice(0, 10).forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
  
  console.log('\n' + '═'.repeat(60) + '\n');

  // Save report to file
  const reportPath = path.join(process.cwd(), 'procore-rebuild-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Full report saved to: ${reportPath}\n`);
}

async function main() {
  const command = process.argv[2];

  if (!process.env.SUPABASE_URL || !process.env.OPENAI_API_KEY) {
    console.error('❌ Missing environment variables: SUPABASE_URL, OPENAI_API_KEY');
    process.exit(1);
  }

  switch (command) {
    case 'analyze':
      const limit = parseInt(process.argv[3]) || 10;
      await processUnanalyzedScreenshots(limit);
      break;
    case 'report':
      await generateRebuildReport();
      break;
    default:
      console.log(`
AI Screenshot Analysis

Usage:
  npx ts-node scripts/analyze-screenshots.ts <command>

Commands:
  analyze [limit]  Analyze unprocessed screenshots (default: 10)
  report           Generate rebuild analysis report

Environment Variables:
  SUPABASE_URL       Your Supabase project URL
  SUPABASE_SERVICE_KEY  Supabase service role key
  OPENAI_API_KEY     OpenAI API key
      `);
  }
}

main().catch(console.error);
