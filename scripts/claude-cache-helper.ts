/**
 * Claude Prompt Caching Helper
 *
 * Utilities for creating optimally-cached Claude API requests
 * See: docs/CLAUDE-CACHING-STRATEGY.md
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { CacheMonitor } from './cache-monitor';

// Project root (adjust if script is moved)
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Cacheable content loader
 * Loads static content that should be cached across requests
 */
export class CacheableContent {
  private static _claudeMd: string | null = null;
  private static _rules: string | null = null;
  private static _dbTypes: string | null = null;

  /**
   * Load CLAUDE.md (core instructions)
   * ~4,500 tokens - changes monthly
   */
  static get claudeMd(): string {
    if (!this._claudeMd) {
      this._claudeMd = readFileSync(join(PROJECT_ROOT, 'CLAUDE.md'), 'utf-8');
    }
    return this._claudeMd;
  }

  /**
   * Load mandatory rules (gates)
   * ~15,000 tokens - changes weekly
   */
  static get rules(): string {
    if (!this._rules) {
      const ruleFiles = [
        'SUPABASE-GATE.md',
        'CRITICAL-NEXTJS-ROUTING-RULES.md',
        'E2E-TESTING-STANDARDS.md',
        'AUTHENTICATION-NEVER-ASK-AGAIN.md',
        'FILE-ORGANIZATION-GATE.md',
        'ROOT-CAUSE-GATE.md',
        'NEXTJS-DEBUG-PROTOCOL.md',
        'USE-AVAILABLE-TOOLS.md',
        'BASH-EXECUTION-RULES.md',
        'PLAYWRIGHT-GATE.md',
        'SCAFFOLD-FIRST.md',
        'ROUTE-CONFLICT-FIX-SUMMARY.md'
      ];

      this._rules = ruleFiles
        .map(f => {
          try {
            const content = readFileSync(join(PROJECT_ROOT, '.claude/rules', f), 'utf-8');
            return `# ${f}\n\n${content}`;
          } catch (err) {
            console.warn(`Warning: Could not load rule file ${f}`);
            return '';
          }
        })
        .filter(Boolean)
        .join('\n\n---\n\n');
    }
    return this._rules;
  }

  /**
   * Load database types
   * ~136,000 tokens - changes on migration only
   */
  static get dbTypes(): string {
    if (!this._dbTypes) {
      const typesPath = join(PROJECT_ROOT, 'frontend/src/types/database.types.ts');
      this._dbTypes = readFileSync(typesPath, 'utf-8');
    }
    return this._dbTypes;
  }

  /**
   * Clear cached content (call after migrations or doc updates)
   */
  static clearCache(): void {
    this._claudeMd = null;
    this._rules = null;
    this._dbTypes = null;
  }

  /**
   * Get estimated token count (rough approximation)
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Cache configuration presets
 */
export enum CachePreset {
  /** CLAUDE.md + Rules only (no DB work) */
  BASIC = 'basic',
  /** CLAUDE.md + Rules + DB Types (most common) */
  DATABASE = 'database',
  /** CLAUDE.md + Rules + DB Types + Custom context */
  CUSTOM = 'custom'
}

/**
 * Build cached system prompt blocks
 */
export function buildCachedSystemPrompt(
  preset: CachePreset = CachePreset.DATABASE,
  customContext?: string
): Anthropic.Messages.TextBlockParam[] {
  const blocks: Anthropic.Messages.TextBlockParam[] = [];

  // Block 1: CLAUDE.md (core instructions)
  blocks.push({
    type: 'text',
    text: CacheableContent.claudeMd,
    cache_control: { type: 'ephemeral' }
  });

  // Block 2: Mandatory rules
  blocks.push({
    type: 'text',
    text: CacheableContent.rules,
    cache_control: { type: 'ephemeral' }
  });

  // Block 3: Database types (if needed)
  if (preset === CachePreset.DATABASE || preset === CachePreset.CUSTOM) {
    blocks.push({
      type: 'text',
      text: `# Database Schema\n\n\`\`\`typescript\n${CacheableContent.dbTypes}\n\`\`\``,
      cache_control: { type: 'ephemeral' }
    });
  }

  // Block 4: Custom context (optional)
  if (preset === CachePreset.CUSTOM && customContext) {
    blocks.push({
      type: 'text',
      text: customContext,
      cache_control: { type: 'ephemeral' }
    });
  }

  return blocks;
}

/**
 * Add cache control to the last message in a conversation
 * Useful for multi-turn caching
 */
export function cacheConversationHistory(
  messages: Anthropic.Messages.MessageParam[]
): Anthropic.Messages.MessageParam[] {
  if (messages.length === 0) return messages;

  const lastMessage = messages[messages.length - 1];

  // If last message is user message with text content
  if (lastMessage.role === 'user') {
    const content = lastMessage.content;

    // Handle string content
    if (typeof content === 'string') {
      return [
        ...messages.slice(0, -1),
        {
          ...lastMessage,
          content: [
            {
              type: 'text',
              text: content,
              cache_control: { type: 'ephemeral' }
            }
          ]
        }
      ];
    }

    // Handle array content - add cache_control to last block
    if (Array.isArray(content) && content.length > 0) {
      const lastBlock = content[content.length - 1];
      if (lastBlock.type === 'text') {
        return [
          ...messages.slice(0, -1),
          {
            ...lastMessage,
            content: [
              ...content.slice(0, -1),
              {
                ...lastBlock,
                cache_control: { type: 'ephemeral' }
              }
            ]
          }
        ];
      }
    }
  }

  return messages;
}

/**
 * Create a Claude client with caching enabled
 */
export function createCachedClient(apiKey?: string): Anthropic {
  return new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY
  });
}

/**
 * Usage tracking for cache performance
 */
export interface CacheStats {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
  totalInputTokens: number;
  estimatedCost: number;
}

/**
 * Calculate cache statistics from API response
 */
export function calculateCacheStats(usage: Anthropic.Messages.Usage): CacheStats {
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;

  const totalInputTokens = cacheReadTokens + cacheWriteTokens + inputTokens;
  const cacheHit = cacheReadTokens > 0;

  // Pricing for Sonnet 4.5 (adjust if using different model)
  const BASE_INPUT_PRICE = 3.0 / 1_000_000; // $3/MTok
  const CACHE_WRITE_PRICE = 3.75 / 1_000_000; // $3.75/MTok
  const CACHE_READ_PRICE = 0.30 / 1_000_000; // $0.30/MTok
  const OUTPUT_PRICE = 15.0 / 1_000_000; // $15/MTok

  const estimatedCost =
    (inputTokens * BASE_INPUT_PRICE) +
    (cacheWriteTokens * CACHE_WRITE_PRICE) +
    (cacheReadTokens * CACHE_READ_PRICE) +
    (outputTokens * OUTPUT_PRICE);

  return {
    cacheReadTokens,
    cacheWriteTokens,
    inputTokens,
    outputTokens,
    cacheHit,
    totalInputTokens,
    estimatedCost
  };
}

/**
 * Pretty print cache statistics
 */
export function logCacheStats(stats: CacheStats): void {
  console.log('\n📊 Cache Performance:');
  console.log(`  ${stats.cacheHit ? '✅ Cache HIT' : '❌ Cache MISS (creating new cache)'}`);
  console.log(`  Cache read:  ${stats.cacheReadTokens.toLocaleString()} tokens`);
  console.log(`  Cache write: ${stats.cacheWriteTokens.toLocaleString()} tokens`);
  console.log(`  New input:   ${stats.inputTokens.toLocaleString()} tokens`);
  console.log(`  Output:      ${stats.outputTokens.toLocaleString()} tokens`);
  console.log(`  Total input: ${stats.totalInputTokens.toLocaleString()} tokens`);
  console.log(`  Est. cost:   $${stats.estimatedCost.toFixed(4)}`);

  if (stats.cacheHit) {
    const savingsPercent = ((stats.cacheReadTokens / stats.totalInputTokens) * 100).toFixed(0);
    console.log(`  💰 Saved ~${savingsPercent}% on input tokens`);
  }
}

/**
 * Create a tracked cached request (with automatic monitoring)
 */
export async function createTrackedCachedRequest(
  client: Anthropic,
  params: Anthropic.Messages.MessageCreateParams,
  options: {
    preset?: string;
    context?: string;
    enableMonitoring?: boolean;
  } = {}
): Promise<Anthropic.Messages.Message> {
  const startTime = Date.now();

  const response = await client.messages.create(params);

  const latency = Date.now() - startTime;

  // Auto-track if monitoring is enabled (default: true)
  if (options.enableMonitoring !== false) {
    const monitor = CacheMonitor.getInstance();
    const event = monitor.createEvent(response.usage, {
      model: params.model,
      preset: options.preset || 'unknown',
      latency,
      context: options.context
    });
    monitor.recordEvent(event);
  }

  return response;
}

/**
 * Example usage
 */
export async function exampleUsage() {
  const client = createCachedClient();

  // Example 1: Database work
  const response1 = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: buildCachedSystemPrompt(CachePreset.DATABASE),
    messages: [
      {
        role: 'user',
        content: 'Create a new API endpoint for budget line items'
      }
    ]
  });

  const stats1 = calculateCacheStats(response1.usage);
  logCacheStats(stats1);

  // Example 2: Multi-turn conversation (reuses cache)
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: 'Create a new API endpoint for budget line items' },
    { role: 'assistant', content: response1.content[0].type === 'text' ? response1.content[0].text : '' },
    { role: 'user', content: 'Now add RLS policies for that table' }
  ];

  const response2 = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: buildCachedSystemPrompt(CachePreset.DATABASE),
    messages: cacheConversationHistory(messages)
  });

  const stats2 = calculateCacheStats(response2.usage);
  logCacheStats(stats2);
}

// Run example if executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}
