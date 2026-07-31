/**
 * Procore Video Transcript Scraper with Supabase Integration
 *
 * This script:
 * 1. Extracts transcripts and video metadata from Procore training videos
 * 2. Stores results in Supabase database
 * 3. Supports deduplication using transcript hashes
 *
 * Usage: npx playwright test capture-video-with-supabase.ts
 */

import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  upsertVideoTranscript,
  getVideoTranscriptByMediaId,
  getTranscriptStats,
  type ProcoreVideoTranscript,
} from '../../lib/supabase-video-storage';

// Re-use extraction functions from the base script
// (In production, these would be refactored into a shared module)

const OUTPUT_DIR = './procore-video-data';
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const TRANSCRIPTS_DIR = path.join(OUTPUT_DIR, 'transcripts');

function setupDirectories() {
  [OUTPUT_DIR, SCREENSHOTS_DIR, TRANSCRIPTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function extractVideoParams(url: string): { wchannelid?: string; wmediaid?: string } {
  const urlObj = new URL(url);
  return {
    wchannelid: urlObj.searchParams.get('wchannelid') || undefined,
    wmediaid: urlObj.searchParams.get('wmediaid') || undefined,
  };
}

async function extractTranscriptText(page: Page): Promise<string | null> {
  try {
    const transcriptLabel = page.getByText('Transcript', { exact: true });
    const hasTranscript = await transcriptLabel.count();
    if (hasTranscript === 0) return null;

    const transcriptText = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let transcriptHeader: HTMLElement | null = null;

      while (walker.nextNode()) {
        const el = walker.currentNode as HTMLElement;
        if (el && el.textContent?.trim() === 'Transcript') {
          transcriptHeader = el;
          break;
        }
      }

      if (!transcriptHeader) return null;

      const container = transcriptHeader.closest('section, article, div') ?? transcriptHeader.parentElement;
      if (!container) return null;

      const blocks = Array.from(container.querySelectorAll('p, div, span'))
        .map(n => (n.textContent ?? '').trim())
        .filter(t => t.length > 30)
        .filter(t => !/Keyboard Shortcuts|Auto-scroll|Next Episode|Previous Episode|Download transcript/i.test(t));

      const seen = new Set<string>();
      const unique: string[] = [];
      for (const block of blocks) {
        if (!seen.has(block)) {
          seen.add(block);
          unique.push(block);
        }
      }

      if (unique.length === 0) return null;
      const joined = unique.join('\n\n');
      return joined.split('© Copyright')[0].trim() || joined;
    });

    return transcriptText?.trim() || null;
  } catch {
    return null;
  }
}

async function downloadTranscriptFile(page: Page, mediaId: string): Promise<{
  url: string | null;
  filename: string | null;
}> {
  try {
    const downloadBtn = page.locator('button[aria-label*="Download transcript"]');
    if (await downloadBtn.count() === 0) return { url: null, filename: null };

    let result = { url: null as string | null, filename: null as string | null };

    const responseHandler = async (resp: any) => {
      const url = resp.url();
      const headers = resp.headers();
      const ct = headers['content-type'] || '';
      const cd = headers['content-disposition'] || '';

      const looksLikeTranscript =
        /vtt|srt|text\/plain|application\/pdf|octet-stream/i.test(ct) ||
        /transcript|caption|subtitles|\.vtt|\.srt/i.test(url);

      if (!looksLikeTranscript) return;

      result.url = url;
      const filenameMatch = cd.match(/filename="?([^"]+)"?/i);
      result.filename = filenameMatch?.[1] || `transcript-${mediaId}.vtt`;

      try {
        const buffer = await resp.body();
        if (buffer) {
          const savePath = path.join(TRANSCRIPTS_DIR, result.filename);
          fs.writeFileSync(savePath, buffer);
          console.log(`  ✓ Downloaded: ${result.filename}`);
        }
      } catch {}
    };

    page.on('response', responseHandler);
    await downloadBtn.first().click({ timeout: 10000 });
    await page.waitForTimeout(2000);
    page.off('response', responseHandler);

    return result;
  } catch {
    return { url: null, filename: null };
  }
}

async function discoverVideoAssets(page: Page): Promise<{
  asset_urls: string[];
  player_urls: string[];
  host_hints: string[];
}> {
  const assetUrls = new Set<string>();
  const playerUrls = new Set<string>();

  const requestHandler = (req: any) => {
    const url = req.url();
    if (/\.m3u8|\.mp4|\.ts|manifest|playlist/i.test(url)) {
      assetUrls.add(url);
    }
    if (/wistia|vimeo|brightcove|jwplayer|mux|cloudfront|embed|player/i.test(url)) {
      playerUrls.add(url);
    }
  };

  page.on('request', requestHandler);

  try {
    const playBtn = page.locator('button[aria-label^="Play"]');
    if (await playBtn.count() > 0) {
      await playBtn.first().click({ timeout: 8000 }).catch(() => {});
    }
    await page.waitForTimeout(5000);
  } finally {
    page.off('request', requestHandler);
  }

  const asset_urls = Array.from(assetUrls);
  const player_urls = Array.from(playerUrls);
  const host_hints = Array.from(
    new Set(
      asset_urls
        .map(url => {
          try {
            return new URL(url).hostname;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as string[]
    )
  );

  return { asset_urls, player_urls, host_hints };
}

/**
 * Main extraction function that stores to Supabase
 */
async function extractAndStoreVideo(page: Page, url: string): Promise<string | null> {
  console.log(`\n🎥 Processing: ${url}`);

  const videoParams = extractVideoParams(url);
  const mediaId = videoParams.wmediaid || 'unknown';

  // Check if already processed
  if (videoParams.wmediaid) {
    const existing = await getVideoTranscriptByMediaId(videoParams.wmediaid);
    if (existing && existing.transcript_text) {
      console.log(`  ⏭️  Already processed (found in database)`);
      return existing.id || null;
    }
  }

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const title = await page.title().catch(() => null);
  const transcriptText = await extractTranscriptText(page);
  const transcriptHash = transcriptText
    ? crypto.createHash('sha256').update(transcriptText).digest('hex')
    : null;

  const transcriptDownload = await downloadTranscriptFile(page, mediaId);
  const videoAssets = await discoverVideoAssets(page);

  // Capture screenshot paths (relative to output dir)
  const screenshots: string[] = [];
  try {
    const fullPagePath = path.join(SCREENSHOTS_DIR, `${mediaId}-full-page.png`);
    await page.screenshot({ path: fullPagePath, fullPage: true });
    screenshots.push(fullPagePath);
  } catch {}

  // Prepare data for Supabase
  const videoData: ProcoreVideoTranscript = {
    url,
    title,
    wmediaid: videoParams.wmediaid || null,
    wchannelid: videoParams.wchannelid || null,
    transcript_text: transcriptText,
    transcript_hash: transcriptHash,
    transcript_download_url: transcriptDownload.url,
    transcript_filename: transcriptDownload.filename,
    video_asset_urls: videoAssets.asset_urls,
    video_player_urls: videoAssets.player_urls,
    video_host_domains: videoAssets.host_hints,
    screenshots,
    metadata: {
      extracted_at: new Date().toISOString(),
      source: 'procore_support',
      content_type: 'video_transcript',
    },
  };

  // Store in Supabase
  const recordId = await upsertVideoTranscript(videoData);

  console.log(`  ✅ Stored to Supabase: ${recordId}`);
  console.log(`  📊 Transcript: ${transcriptText ? 'Yes' : 'No'} (${transcriptText?.length || 0} chars)`);
  console.log(`  🌐 Hosting: ${videoAssets.host_hints.join(', ') || 'Unknown'}`);

  return recordId;
}

/**
 * Test: Extract single video and store to Supabase
 */
test('Extract and Store Single Video', async ({ page }) => {
  setupDirectories();

  const videoUrl = 'https://support.procore.com/references/videos/training-videos?wchannelid=vtsli1z4on&wmediaid=9uu5aap1ox';

  const recordId = await extractAndStoreVideo(page, videoUrl);

  if (recordId) {
    console.log(`\n✅ Success! Record ID: ${recordId}`);
  }

  // Show stats
  const stats = await getTranscriptStats();
  console.log('\n📊 Database Stats:');
  console.log(`   Total videos: ${stats.total_videos}`);
  console.log(`   With transcripts: ${stats.videos_with_transcripts}`);
  console.log(`   With downloads: ${stats.videos_with_downloads}`);
  console.log(`   Hosting platforms: ${stats.unique_hosts.join(', ')}`);
  console.log(`   Total transcript chars: ${stats.total_transcript_chars.toLocaleString()}`);
});

/**
 * Test: Batch process multiple videos
 */
test('Batch Process Multiple Videos', async ({ page }) => {
  setupDirectories();

  const videoUrls = [
    'https://support.procore.com/references/videos/training-videos?wchannelid=vtsli1z4on&wmediaid=9uu5aap1ox',
    // Add more URLs here
  ];

  const processedIds: string[] = [];

  for (const url of videoUrls) {
    try {
      const id = await extractAndStoreVideo(page, url);
      if (id) processedIds.push(id);

      // Respectful delay between requests
      await page.waitForTimeout(3000);
    } catch (error) {
      console.error(`✗ Failed: ${url}`, error);
    }
  }

  console.log(`\n✅ Batch complete: ${processedIds.length}/${videoUrls.length} processed`);

  // Final stats
  const stats = await getTranscriptStats();
  console.log('\n📊 Final Stats:');
  console.log(`   Total videos: ${stats.total_videos}`);
  console.log(`   Total characters: ${stats.total_transcript_chars.toLocaleString()}`);
});
