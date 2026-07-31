/**
 * Claude Cache Monitoring Example
 *
 * Demonstrates the complete caching workflow with automatic monitoring
 *
 * Usage:
 *   npx tsx scripts/cache-example.ts
 *
 * Then check stats:
 *   npm run cache:stats
 */

import {
  createCachedClient,
  buildCachedSystemPrompt,
  createTrackedCachedRequest,
  CachePreset,
  calculateCacheStats,
  logCacheStats
} from './claude-cache-helper';
import { CacheMonitor, formatSummary, getRecommendations } from './cache-monitor';

async function main() {
  console.log('🚀 Claude Cache Monitoring Example\n');
  console.log('This example demonstrates:');
  console.log('  1. Making cached requests');
  console.log('  2. Automatic performance tracking');
  console.log('  3. Viewing cache statistics');
  console.log('  4. Getting optimization recommendations\n');

  const client = createCachedClient();

  // Example 1: First request (cache MISS - creates cache)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Request 1: Create API endpoint (cache MISS expected)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response1 = await createTrackedCachedRequest(
    client,
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: buildCachedSystemPrompt(CachePreset.DATABASE),
      messages: [
        {
          role: 'user',
          content: 'What are the key steps to create a new API endpoint for budget line items?'
        }
      ]
    },
    {
      preset: 'database',
      context: 'example-api-endpoint-creation'
    }
  );

  const stats1 = calculateCacheStats(response1.usage);
  logCacheStats(stats1);

  console.log('\n📄 Response preview:');
  if (response1.content[0].type === 'text') {
    console.log(response1.content[0].text.substring(0, 200) + '...\n');
  }

  // Wait a bit
  console.log('⏳ Waiting 2 seconds before next request...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 2: Second request (cache HIT expected)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Request 2: Add RLS policies (cache HIT expected)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response2 = await createTrackedCachedRequest(
    client,
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: buildCachedSystemPrompt(CachePreset.DATABASE),
      messages: [
        {
          role: 'user',
          content: 'What RLS policies should I add for the budget_lines table?'
        }
      ]
    },
    {
      preset: 'database',
      context: 'example-rls-policy-creation'
    }
  );

  const stats2 = calculateCacheStats(response2.usage);
  logCacheStats(stats2);

  console.log('\n📄 Response preview:');
  if (response2.content[0].type === 'text') {
    console.log(response2.content[0].text.substring(0, 200) + '...\n');
  }

  // Example 3: Non-database request (smaller cache)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Request 3: Documentation question (basic preset)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response3 = await createTrackedCachedRequest(
    client,
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: buildCachedSystemPrompt(CachePreset.BASIC),
      messages: [
        {
          role: 'user',
          content: 'What are the key rules in the CRITICAL-NEXTJS-ROUTING-RULES.md file?'
        }
      ]
    },
    {
      preset: 'basic',
      context: 'example-documentation-query'
    }
  );

  const stats3 = calculateCacheStats(response3.usage);
  logCacheStats(stats3);

  console.log('\n📄 Response preview:');
  if (response3.content[0].type === 'text') {
    console.log(response3.content[0].text.substring(0, 200) + '...\n');
  }

  // Show aggregate statistics
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 AGGREGATE STATISTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const monitor = CacheMonitor.getInstance();
  const summary = monitor.getSummary();

  console.log(formatSummary(summary));

  // Show recommendations
  const recommendations = getRecommendations(summary);
  if (recommendations.length > 0) {
    console.log('\n💡 Recommendations:\n');
    recommendations.forEach(rec => console.log(rec + '\n'));
  }

  // Show how to view stats
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 NEXT STEPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('View detailed statistics:');
  console.log('  npm run cache:stats\n');

  console.log('View recent requests:');
  console.log('  npm run cache:recent\n');

  console.log('Export data for analysis:');
  console.log('  npm run cache:export\n');

  console.log('Reset all statistics:');
  console.log('  npm run cache:reset\n');

  console.log('Data stored in:');
  console.log('  .cache-monitor/cache-stats.jsonl');
  console.log('  .cache-monitor/cache-summary.json\n');
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Example completed successfully!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export default main;
