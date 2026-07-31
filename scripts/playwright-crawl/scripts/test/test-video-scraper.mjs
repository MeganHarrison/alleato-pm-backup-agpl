#!/usr/bin/env node
/**
 * Quick test script for video transcript scraper
 * Usage: node test-video-scraper.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, 'procore-video-data-test');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const TRANSCRIPTS_DIR = path.join(OUTPUT_DIR, 'transcripts');

function setupDirectories() {
  [OUTPUT_DIR, SCREENSHOTS_DIR, TRANSCRIPTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

async function extractTranscriptText(page) {
  try {
    const hasTranscript = await page.getByText('Transcript', { exact: true }).count();
    if (hasTranscript === 0) {
      console.log('  No transcript label found');
      return null;
    }

    const transcriptText = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let transcriptHeader = null;

      while (walker.nextNode()) {
        const el = walker.currentNode;
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

      const seen = new Set();
      const unique = [];
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

    if (transcriptText && transcriptText.length > 50) {
      console.log(`  ✓ Extracted transcript: ${transcriptText.length} characters`);
      return transcriptText.trim();
    }

    return null;
  } catch (error) {
    console.error('  ✗ Error extracting transcript:', error.message);
    return null;
  }
}

async function discoverVideoAssets(page) {
  const assetUrls = new Set();
  const playerUrls = new Set();

  const requestHandler = (req) => {
    const url = req.url();
    if (/\.m3u8|\.mp4|\.ts|manifest|playlist/i.test(url)) {
      assetUrls.add(url);
      console.log(`  📹 Found video asset: ${url.substring(0, 80)}...`);
    }
    if (/wistia|vimeo|brightcove|jwplayer|mux|cloudfront|embed|player/i.test(url)) {
      playerUrls.add(url);
      console.log(`  🎬 Found player call: ${url.substring(0, 80)}...`);
    }
  };

  page.on('request', requestHandler);

  try {
    const playBtn = page.locator('button[aria-label^="Play"]');
    const btnCount = await playBtn.count();
    if (btnCount > 0) {
      console.log('  ▶️  Clicking play button...');
      await playBtn.first().click({ timeout: 8000 }).catch(() => {
        console.log('  ⚠️  Play button click timed out');
      });
    }

    await page.waitForTimeout(5000);
  } catch (error) {
    console.log('  ⚠️  Error during video playback:', error.message);
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
        .filter(Boolean)
    )
  );

  console.log(`  📊 Discovered ${asset_urls.length} asset URLs, ${player_urls.length} player URLs`);
  console.log(`  🌐 Hosting domains: ${host_hints.join(', ') || 'none detected'}`);

  return { asset_urls, player_urls, host_hints };
}

async function extractVideo(page, url) {
  console.log(`\n🎥 Processing: ${url}`);

  const urlObj = new URL(url);
  const wmediaid = urlObj.searchParams.get('wmediaid') || 'unknown';

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const title = await page.title();
  console.log(`  📄 Title: ${title}`);

  const transcriptText = await extractTranscriptText(page);
  const transcriptHash = transcriptText
    ? crypto.createHash('sha256').update(transcriptText).digest('hex')
    : null;

  const videoAssets = await discoverVideoAssets(page);

  // Save transcript to file
  if (transcriptText) {
    const transcriptPath = path.join(TRANSCRIPTS_DIR, `${wmediaid}.txt`);
    fs.writeFileSync(transcriptPath, transcriptText);
    console.log(`  💾 Saved transcript: ${transcriptPath}`);
  }

  // Take screenshot
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${wmediaid}-full-page.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  📸 Saved screenshot: ${screenshotPath}`);

  const result = {
    url,
    title,
    wmediaid,
    transcript_text: transcriptText,
    transcript_hash: transcriptHash,
    video_asset_urls: videoAssets.asset_urls,
    video_player_urls: videoAssets.player_urls,
    video_host_domains: videoAssets.host_hints,
    extracted_at: new Date().toISOString(),
  };

  // Save metadata
  const metadataPath = path.join(OUTPUT_DIR, `${wmediaid}.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(result, null, 2));
  console.log(`  💾 Saved metadata: ${metadataPath}`);

  return result;
}

async function main() {
  console.log('🚀 Starting Procore Video Transcript Scraper Test\n');

  setupDirectories();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  try {
    const testUrl = 'https://support.procore.com/references/videos/training-videos?wchannelid=vtsli1z4on&wmediaid=9uu5aap1ox';

    const result = await extractVideo(page, testUrl);

    console.log('\n✅ Extraction Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Title: ${result.title}`);
    console.log(`Transcript: ${result.transcript_text ? 'Yes' : 'No'} (${result.transcript_text?.length || 0} chars)`);
    console.log(`Video Assets: ${result.video_asset_urls.length}`);
    console.log(`Hosting: ${result.video_host_domains.join(', ') || 'Unknown'}`);
    console.log(`Hash: ${result.transcript_hash?.substring(0, 16)}...`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📁 Output files created:');
    console.log(`   Transcript: ${TRANSCRIPTS_DIR}/${result.wmediaid}.txt`);
    console.log(`   Screenshot: ${SCREENSHOTS_DIR}/${result.wmediaid}-full-page.png`);
    console.log(`   Metadata: ${OUTPUT_DIR}/${result.wmediaid}.json`);

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
