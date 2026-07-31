/**
 * Claude Cache Performance Monitor
 *
 * Tracks cache performance, costs, and hit rates over time
 * Provides analytics and recommendations for optimization
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const MONITOR_DIR = join(process.cwd(), '.cache-monitor');
const STATS_FILE = join(MONITOR_DIR, 'cache-stats.jsonl');
const SUMMARY_FILE = join(MONITOR_DIR, 'cache-summary.json');

// Ensure monitor directory exists
if (!existsSync(MONITOR_DIR)) {
  mkdirSync(MONITOR_DIR, { recursive: true });
}

/**
 * Cache event data structure
 */
export interface CacheEvent {
  timestamp: string;
  requestId: string;
  model: string;
  preset: string;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
  cost: number;
  latency?: number; // Time to first token (ms)
  context?: string; // Optional context (e.g., "budget-api-creation")
}

/**
 * Aggregated cache statistics
 */
export interface CacheSummary {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalCost: number;
  estimatedSavings: number;
  totalTokensRead: number;
  totalTokensWritten: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  averageLatency?: number;
  byPreset: Record<string, PresetStats>;
  byDay: Record<string, DailyStats>;
  lastUpdated: string;
}

interface PresetStats {
  requests: number;
  hits: number;
  misses: number;
  hitRate: number;
  cost: number;
  savings: number;
}

interface DailyStats {
  date: string;
  requests: number;
  hits: number;
  cost: number;
  savings: number;
}

/**
 * Cache monitor class
 */
export class CacheMonitor {
  private static instance: CacheMonitor;

  private constructor() {}

  static getInstance(): CacheMonitor {
    if (!this.instance) {
      this.instance = new CacheMonitor();
    }
    return this.instance;
  }

  /**
   * Record a cache event
   */
  recordEvent(event: CacheEvent): void {
    // Append to JSONL file (one JSON object per line)
    const eventLine = JSON.stringify(event) + '\n';
    writeFileSync(STATS_FILE, eventLine, { flag: 'a' });

    // Update summary
    this.updateSummary(event);
  }

  /**
   * Create cache event from API response
   */
  createEvent(
    usage: Anthropic.Messages.Usage,
    options: {
      requestId?: string;
      model?: string;
      preset?: string;
      latency?: number;
      context?: string;
    } = {}
  ): CacheEvent {
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;

    // Pricing for Sonnet 4.5 (adjust if using different model)
    const BASE_INPUT_PRICE = 3.0 / 1_000_000;
    const CACHE_WRITE_PRICE = 3.75 / 1_000_000;
    const CACHE_READ_PRICE = 0.30 / 1_000_000;
    const OUTPUT_PRICE = 15.0 / 1_000_000;

    const cost =
      (inputTokens * BASE_INPUT_PRICE) +
      (cacheWriteTokens * CACHE_WRITE_PRICE) +
      (cacheReadTokens * CACHE_READ_PRICE) +
      (outputTokens * OUTPUT_PRICE);

    return {
      timestamp: new Date().toISOString(),
      requestId: options.requestId || this.generateRequestId(),
      model: options.model || 'claude-sonnet-4-5',
      preset: options.preset || 'unknown',
      cacheReadTokens,
      cacheWriteTokens,
      inputTokens,
      outputTokens,
      cacheHit: cacheReadTokens > 0,
      cost,
      latency: options.latency,
      context: options.context
    };
  }

  /**
   * Update summary statistics
   */
  private updateSummary(event: CacheEvent): void {
    const summary = this.loadSummary();

    // Overall stats
    summary.totalRequests++;
    if (event.cacheHit) {
      summary.cacheHits++;
    } else {
      summary.cacheMisses++;
    }
    summary.hitRate = summary.cacheHits / summary.totalRequests;
    summary.totalCost += event.cost;
    summary.totalTokensRead += event.cacheReadTokens;
    summary.totalTokensWritten += event.cacheWriteTokens;
    summary.totalInputTokens += event.inputTokens + event.cacheReadTokens + event.cacheWriteTokens;
    summary.totalOutputTokens += event.outputTokens;

    // Calculate savings (what would have been paid without caching)
    const BASE_INPUT_PRICE = 3.0 / 1_000_000;
    const hypotheticalCost = event.cacheReadTokens * BASE_INPUT_PRICE;
    const actualCacheCost = event.cacheReadTokens * (0.30 / 1_000_000);
    const savings = hypotheticalCost - actualCacheCost;
    summary.estimatedSavings += savings;

    // By preset
    if (!summary.byPreset[event.preset]) {
      summary.byPreset[event.preset] = {
        requests: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        cost: 0,
        savings: 0
      };
    }
    const presetStats = summary.byPreset[event.preset];
    presetStats.requests++;
    if (event.cacheHit) presetStats.hits++;
    else presetStats.misses++;
    presetStats.hitRate = presetStats.hits / presetStats.requests;
    presetStats.cost += event.cost;
    presetStats.savings += savings;

    // By day
    const dateKey = event.timestamp.split('T')[0];
    if (!summary.byDay[dateKey]) {
      summary.byDay[dateKey] = {
        date: dateKey,
        requests: 0,
        hits: 0,
        cost: 0,
        savings: 0
      };
    }
    const dayStats = summary.byDay[dateKey];
    dayStats.requests++;
    if (event.cacheHit) dayStats.hits++;
    dayStats.cost += event.cost;
    dayStats.savings += savings;

    // Average latency
    if (event.latency) {
      const totalLatency = (summary.averageLatency || 0) * (summary.totalRequests - 1);
      summary.averageLatency = (totalLatency + event.latency) / summary.totalRequests;
    }

    summary.lastUpdated = new Date().toISOString();

    this.saveSummary(summary);
  }

  /**
   * Load summary from disk
   */
  private loadSummary(): CacheSummary {
    if (existsSync(SUMMARY_FILE)) {
      const content = readFileSync(SUMMARY_FILE, 'utf-8');
      return JSON.parse(content);
    }

    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      totalCost: 0,
      estimatedSavings: 0,
      totalTokensRead: 0,
      totalTokensWritten: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byPreset: {},
      byDay: {},
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Save summary to disk
   */
  private saveSummary(summary: CacheSummary): void {
    writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));
  }

  /**
   * Get current summary
   */
  getSummary(): CacheSummary {
    return this.loadSummary();
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 10): CacheEvent[] {
    if (!existsSync(STATS_FILE)) {
      return [];
    }

    const lines = readFileSync(STATS_FILE, 'utf-8')
      .split('\n')
      .filter(Boolean);

    return lines
      .slice(-limit)
      .map(line => JSON.parse(line))
      .reverse();
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    if (existsSync(STATS_FILE)) {
      writeFileSync(STATS_FILE, '');
    }
    if (existsSync(SUMMARY_FILE)) {
      writeFileSync(SUMMARY_FILE, '');
    }
  }

  /**
   * Export data for analysis
   */
  exportData(): { events: CacheEvent[]; summary: CacheSummary } {
    const events = existsSync(STATS_FILE)
      ? readFileSync(STATS_FILE, 'utf-8')
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line))
      : [];

    const summary = this.getSummary();

    return { events, summary };
  }
}

/**
 * Format cache summary for display
 */
export function formatSummary(summary: CacheSummary): string {
  const lines: string[] = [];

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📊 CLAUDE CACHE PERFORMANCE SUMMARY');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  // Overall stats
  lines.push('📈 Overall Statistics:');
  lines.push(`  Total Requests:    ${summary.totalRequests.toLocaleString()}`);
  lines.push(`  Cache Hits:        ${summary.cacheHits.toLocaleString()} (${(summary.hitRate * 100).toFixed(1)}%)`);
  lines.push(`  Cache Misses:      ${summary.cacheMisses.toLocaleString()}`);
  lines.push('');

  // Token stats
  lines.push('🎯 Token Usage:');
  lines.push(`  Total Input:       ${summary.totalInputTokens.toLocaleString()} tokens`);
  lines.push(`  Total Output:      ${summary.totalOutputTokens.toLocaleString()} tokens`);
  lines.push(`  Cache Reads:       ${summary.totalTokensRead.toLocaleString()} tokens`);
  lines.push(`  Cache Writes:      ${summary.totalTokensWritten.toLocaleString()} tokens`);
  if (summary.averageLatency) {
    lines.push(`  Avg Latency:       ${summary.averageLatency.toFixed(0)}ms`);
  }
  lines.push('');

  // Cost analysis
  lines.push('💰 Cost Analysis:');
  lines.push(`  Total Cost:        $${summary.totalCost.toFixed(4)}`);
  lines.push(`  Estimated Savings: $${summary.estimatedSavings.toFixed(4)}`);
  if (summary.totalCost > 0) {
    const savingsPercent = (summary.estimatedSavings / (summary.totalCost + summary.estimatedSavings)) * 100;
    lines.push(`  Savings Rate:      ${savingsPercent.toFixed(1)}%`);
  }
  lines.push('');

  // By preset
  if (Object.keys(summary.byPreset).length > 0) {
    lines.push('📋 By Preset:');
    for (const [preset, stats] of Object.entries(summary.byPreset)) {
      lines.push(`  ${preset}:`);
      lines.push(`    Requests: ${stats.requests.toLocaleString()} | Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      lines.push(`    Cost: $${stats.cost.toFixed(4)} | Savings: $${stats.savings.toFixed(4)}`);
    }
    lines.push('');
  }

  // Recent days
  const recentDays = Object.values(summary.byDay)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  if (recentDays.length > 0) {
    lines.push('📅 Recent Activity (Last 7 Days):');
    for (const day of recentDays) {
      const hitRate = day.hits / day.requests * 100;
      lines.push(`  ${day.date}: ${day.requests} reqs | ${hitRate.toFixed(0)}% hits | $${day.cost.toFixed(4)} | saved $${day.savings.toFixed(4)}`);
    }
    lines.push('');
  }

  lines.push(`Last Updated: ${new Date(summary.lastUpdated).toLocaleString()}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return lines.join('\n');
}

/**
 * Display recommendations based on cache performance
 */
export function getRecommendations(summary: CacheSummary): string[] {
  const recommendations: string[] = [];

  // Low hit rate
  if (summary.totalRequests > 10 && summary.hitRate < 0.5) {
    recommendations.push(
      '⚠️  Cache hit rate is below 50%. Check if:\n' +
      '   - Content is truly static (no timestamps/random IDs)\n' +
      '   - Requests are within 5-minute TTL window\n' +
      '   - Cache breakpoints are consistently placed'
    );
  }

  // Good hit rate
  if (summary.totalRequests > 10 && summary.hitRate > 0.8) {
    recommendations.push(
      '✅ Excellent cache hit rate! Your caching strategy is working well.'
    );
  }

  // High cache write cost
  const avgWriteTokens = summary.totalTokensWritten / Math.max(summary.cacheMisses, 1);
  if (avgWriteTokens > 200000) {
    recommendations.push(
      '💡 High cache write volume detected. Consider:\n' +
      '   - Using 1-hour TTL for long-running sessions\n' +
      '   - Splitting large context into smaller sections\n' +
      '   - Removing unnecessary cached content'
    );
  }

  // Significant savings
  if (summary.estimatedSavings > 1) {
    recommendations.push(
      `💰 Great! You've saved $${summary.estimatedSavings.toFixed(2)} through caching.`
    );
  }

  // Few requests
  if (summary.totalRequests < 5) {
    recommendations.push(
      '📊 Limited data available. Keep using caching to gather more statistics.'
    );
  }

  return recommendations;
}

const __filename = fileURLToPath(import.meta.url);

/**
 * CLI interface
 */
if (process.argv[1] === __filename) {
  const monitor = CacheMonitor.getInstance();
  const command = process.argv[2];

  switch (command) {
    case 'summary':
    case 'stats':
      const summary = monitor.getSummary();
      console.log(formatSummary(summary));

      const recommendations = getRecommendations(summary);
      if (recommendations.length > 0) {
        console.log('\n💡 Recommendations:\n');
        recommendations.forEach(rec => console.log(rec + '\n'));
      }
      break;

    case 'recent':
      const limit = parseInt(process.argv[3]) || 10;
      const events = monitor.getRecentEvents(limit);
      console.log(`\n📋 Last ${events.length} Cache Events:\n`);
      events.forEach(event => {
        const hit = event.cacheHit ? '✅ HIT ' : '❌ MISS';
        console.log(`${hit} | ${event.timestamp} | ${event.preset}`);
        console.log(`  Read: ${event.cacheReadTokens.toLocaleString()} | Write: ${event.cacheWriteTokens.toLocaleString()} | Cost: $${event.cost.toFixed(4)}`);
        if (event.context) console.log(`  Context: ${event.context}`);
        console.log('');
      });
      break;

    case 'export':
      const { events: allEvents, summary: exportSummary } = monitor.exportData();
      const exportPath = join(MONITOR_DIR, `cache-export-${Date.now()}.json`);
      writeFileSync(exportPath, JSON.stringify({ events: allEvents, summary: exportSummary }, null, 2));
      console.log(`✅ Exported data to: ${exportPath}`);
      break;

    case 'reset':
      monitor.reset();
      console.log('✅ Cache statistics reset');
      break;

    default:
      console.log('Claude Cache Monitor\n');
      console.log('Usage:');
      console.log('  npm run cache:stats     - View cache statistics summary');
      console.log('  npm run cache:recent    - View recent cache events');
      console.log('  npm run cache:export    - Export all data to JSON');
      console.log('  npm run cache:reset     - Reset all statistics');
  }
}

export default CacheMonitor;
