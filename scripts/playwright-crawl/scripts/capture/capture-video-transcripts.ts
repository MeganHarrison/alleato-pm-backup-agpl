/**
 * Procore Training Video Transcript + Metadata Scraper
 *
 * Extends the existing screenshot scraper to capture:
 * 1. Full transcript text from training video pages
 * 2. Downloadable transcript files (.vtt, .srt, etc.)
 * 3. Video asset URLs and hosting metadata (direct from network traffic)
 *
 * Target pages: https://support.procore.com/references/videos/training-videos?wchannelid=...&wmediaid=...
 *
 * Usage: npx playwright test capture-video-transcripts.ts
 */

import { test, Page, Request, Response, Download } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Output directory structure
const OUTPUT_DIR = './procore-video-data';
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const TRANSCRIPTS_DIR = path.join(OUTPUT_DIR, 'transcripts');
const METADATA_DIR = path.join(OUTPUT_DIR, 'metadata');

/**
 * Type definitions for video extraction results
 */
interface TranscriptDownload {
  url: string | null;
  filename: string | null;
  mime: string | null;
  bytes: number | null;
  localPath?: string | null;
}

interface VideoMetadata {
  wchannelid?: string | null;
  wmediaid?: string | null;
  asset_urls: string[];  // Direct .mp4, .m3u8, .ts URLs
  player_urls: string[]; // Embed/iframe/player endpoints
  host_hints: string[];  // Hosting domains extracted from asset URLs
}

interface VideoExtractionResult {
  source: string;
  content_type: string;
  url: string;
  title: string | null;
  transcript_text: string | null;
  transcript_hash?: string | null; // SHA-256 of transcript for deduplication
  transcript_download?: TranscriptDownload;
  video?: VideoMetadata;
  screenshots: string[];
  extracted_at: string;
}

/**
 * Setup output directory structure
 */
function setupDirectories() {
  [OUTPUT_DIR, SCREENSHOTS_DIR, TRANSCRIPTS_DIR, METADATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Classify URL to determine content type
 */
function classifyUrl(url: string): 'procore_training_video' | 'procore_doc' | 'unknown' {
  const urlObj = new URL(url);

  // Training video pages have both wchannelid and wmediaid params
  if (
    urlObj.hostname === 'support.procore.com' &&
    urlObj.pathname.includes('/videos/') &&
    urlObj.searchParams.has('wmediaid')
  ) {
    return 'procore_training_video';
  }

  // Regular documentation pages
  if (urlObj.hostname === 'support.procore.com' && urlObj.pathname.includes('/references/')) {
    return 'procore_doc';
  }

  return 'unknown';
}

/**
 * Extract video parameters from URL
 */
function extractVideoParams(url: string): { wchannelid?: string; wmediaid?: string } {
  const urlObj = new URL(url);
  return {
    wchannelid: urlObj.searchParams.get('wchannelid') || undefined,
    wmediaid: urlObj.searchParams.get('wmediaid') || undefined,
  };
}

/**
 * Extract transcript text from DOM
 *
 * Strategy:
 * 1. Find the "Transcript" heading
 * 2. Collect paragraph text blocks following it
 * 3. Filter out UI noise (buttons, navigation, etc.)
 */
async function extractTranscriptText(page: Page): Promise<string | null> {
  try {
    // First, check if transcript label exists
    const transcriptLabel = page.getByText('Transcript', { exact: true });
    const hasTranscript = await transcriptLabel.count();

    if (hasTranscript === 0) {
      console.log('  No transcript label found on page');
      return null;
    }

    // Extract transcript text using DOM traversal
    const transcriptText = await page.evaluate(() => {
      // Find the transcript header element
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT
      );

      let transcriptHeader: HTMLElement | null = null;
      while (walker.nextNode()) {
        const el = walker.currentNode as HTMLElement;
        if (el && el.textContent?.trim() === 'Transcript') {
          transcriptHeader = el;
          break;
        }
      }

      if (!transcriptHeader) return null;

      // Find the container holding the transcript
      const container = transcriptHeader.closest('section, article, div') ?? transcriptHeader.parentElement;
      if (!container) return null;

      // Collect text blocks that look like transcript paragraphs
      const blocks = Array.from(container.querySelectorAll('p, div, span'))
        .map(n => (n.textContent ?? '').trim())
        .filter(t => t.length > 30) // Filter short strings (likely UI elements)
        .filter(t => !/Keyboard Shortcuts|Auto-scroll|Next Episode|Previous Episode|Download transcript/i.test(t));

      // De-duplicate while preserving order
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const block of blocks) {
        if (!seen.has(block)) {
          seen.add(block);
          unique.push(block);
        }
      }

      if (unique.length === 0) return null;

      // Join paragraphs and remove footer content if present
      const joined = unique.join('\n\n');
      const cleaned = joined.split('© Copyright')[0].trim();

      return cleaned || joined;
    });

    if (!transcriptText || transcriptText.length < 50) {
      console.log('  Transcript extraction yielded insufficient content');
      return null;
    }

    console.log(`  ✓ Extracted transcript: ${transcriptText.length} characters`);
    return transcriptText.trim();

  } catch (error) {
    console.error('  ✗ Error extracting transcript text:', error);
    return null;
  }
}

/**
 * Download transcript file if "Download transcript" button exists
 *
 * Captures network traffic when download button is clicked to get:
 * - Transcript file URL
 * - File size and mime type
 * - Actual file content
 */
async function downloadTranscriptIfAvailable(
  page: Page,
  mediaId: string
): Promise<TranscriptDownload | null> {
  try {
    const downloadBtn = page.locator('button[aria-label*="Download transcript"]');
    const btnCount = await downloadBtn.count();

    if (btnCount === 0) {
      console.log('  No download transcript button found');
      return null;
    }

    let captured: TranscriptDownload = {
      url: null,
      filename: null,
      mime: null,
      bytes: null,
    };

    // Listen for download-related network responses
    const responseHandler = async (resp: Response) => {
      const url = resp.url();
      const headers = resp.headers();
      const ct = headers['content-type'] || '';
      const cd = headers['content-disposition'] || '';

      // Check if this looks like a transcript file
      const looksLikeTranscript =
        /vtt|srt|text\/plain|application\/pdf|octet-stream/i.test(ct) ||
        /transcript|caption|subtitles|\.vtt|\.srt/i.test(url);

      if (!looksLikeTranscript) return;

      try {
        const buffer = await resp.body();
        captured.url = url;
        captured.bytes = buffer?.byteLength ?? 0;
        captured.mime = ct || null;

        // Extract filename from content-disposition header
        const filenameMatch = cd.match(/filename="?([^"]+)"?/i);
        if (filenameMatch?.[1]) {
          captured.filename = filenameMatch[1];
        } else {
          // Generate filename from URL or use media ID
          const urlFilename = url.split('/').pop()?.split('?')[0];
          captured.filename = urlFilename || `transcript-${mediaId}.vtt`;
        }

        // Save the transcript file to disk
        if (buffer && captured.filename) {
          const savePath = path.join(TRANSCRIPTS_DIR, captured.filename);
          fs.writeFileSync(savePath, buffer);
          captured.localPath = savePath;
          console.log(`  ✓ Downloaded transcript: ${captured.filename} (${captured.bytes} bytes)`);
        }
      } catch (err) {
        console.error('  ✗ Error processing transcript response:', err);
      }
    };

    // Also listen for browser download events
    let downloadEvent: Download | null = null;
    const downloadHandler = async (download: Download) => {
      try {
        const filename = download.suggestedFilename();
        const savePath = path.join(TRANSCRIPTS_DIR, filename);

        await download.saveAs(savePath);
        const stats = fs.statSync(savePath);

        captured.url = download.url();
        captured.filename = filename;
        captured.bytes = stats.size;
        captured.localPath = savePath;

        console.log(`  ✓ Saved browser download: ${filename} (${stats.size} bytes)`);
        downloadEvent = download;
      } catch (err) {
        console.error('  ✗ Error handling download event:', err);
      }
    };

    page.on('response', responseHandler);
    page.on('download', downloadHandler);

    // Click the download button
    await downloadBtn.first().click({ timeout: 10000 });

    // Wait for download to complete
    await page.waitForTimeout(2000);

    page.off('response', responseHandler);
    page.off('download', downloadHandler);

    return captured.url ? captured : null;

  } catch (error) {
    console.error('  ✗ Error downloading transcript:', error);
    return null;
  }
}

/**
 * Discover video asset URLs from network traffic
 *
 * This is the KEY function that reveals the actual video hosting platform.
 * We capture all video-related network requests to identify:
 * - Direct video files (.mp4, .m3u8, .ts)
 * - Player/embed endpoints
 * - CDN/hosting domains
 */
async function discoverVideoAssets(page: Page): Promise<{
  asset_urls: string[];
  player_urls: string[];
  host_hints: string[];
}> {
  const assetUrls = new Set<string>();
  const playerUrls = new Set<string>();

  const isVideoAsset = (url: string): boolean => {
    return (
      /\.m3u8(\?|$)/i.test(url) ||
      /\.mp4(\?|$)/i.test(url) ||
      /\.ts(\?|$)/i.test(url) ||
      /manifest|playlist/i.test(url)
    );
  };

  const isPlayerCall = (url: string): boolean => {
    return /wistia|vimeo|brightcove|jwplayer|mux|cloudfront|embed|player/i.test(url);
  };

  const requestHandler = (req: Request) => {
    const url = req.url();
    if (isVideoAsset(url)) {
      assetUrls.add(url);
      console.log(`  📹 Found video asset: ${url.substring(0, 100)}...`);
    }
    if (isPlayerCall(url)) {
      playerUrls.add(url);
      console.log(`  🎬 Found player call: ${url.substring(0, 100)}...`);
    }
  };

  page.on('request', requestHandler);

  try {
    // Try to trigger video loading by clicking play button
    const playBtn = page.locator('button[aria-label^="Play Video"], button[aria-label^="Play"]');
    const playBtnCount = await playBtn.count();

    if (playBtnCount > 0) {
      console.log('  ▶️  Clicking play button to trigger video loading...');
      await playBtn.first().click({ timeout: 8000 }).catch(() => {
        console.log('  ⚠️  Play button click failed or timed out');
      });
    }

    // Wait for video requests to fire
    await page.waitForTimeout(5000);

  } catch (error) {
    console.log('  ⚠️  Error triggering video playback:', error);
  } finally {
    page.off('request', requestHandler);
  }

  const asset_urls = Array.from(assetUrls);
  const player_urls = Array.from(playerUrls);

  // Extract unique hosting domains from asset URLs
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

  console.log(`  📊 Discovered ${asset_urls.length} asset URLs, ${player_urls.length} player URLs`);
  console.log(`  🌐 Hosting domains: ${host_hints.join(', ') || 'none detected'}`);

  return { asset_urls, player_urls, host_hints };
}

/**
 * Capture screenshots of the video page
 */
async function captureScreenshots(page: Page, mediaId: string): Promise<string[]> {
  const screenshots: string[] = [];

  try {
    // Full page screenshot
    const fullPagePath = path.join(SCREENSHOTS_DIR, `${mediaId}-full-page.png`);
    await page.screenshot({ path: fullPagePath, fullPage: true });
    screenshots.push(fullPagePath);
    console.log(`  📸 Captured full page screenshot`);

    // Transcript section screenshot (if visible)
    try {
      const transcriptSection = page.locator('text=Transcript').locator('..');
      if (await transcriptSection.isVisible()) {
        const transcriptPath = path.join(SCREENSHOTS_DIR, `${mediaId}-transcript.png`);
        await transcriptSection.screenshot({ path: transcriptPath });
        screenshots.push(transcriptPath);
        console.log(`  📸 Captured transcript section screenshot`);
      }
    } catch {
      // Transcript screenshot optional
    }

    // Video player screenshot
    try {
      const videoPlayer = page.locator('video, iframe[src*="wistia"], iframe[src*="player"]').first();
      if (await videoPlayer.isVisible()) {
        const playerPath = path.join(SCREENSHOTS_DIR, `${mediaId}-player.png`);
        await videoPlayer.screenshot({ path: playerPath });
        screenshots.push(playerPath);
        console.log(`  📸 Captured video player screenshot`);
      }
    } catch {
      // Player screenshot optional
    }

  } catch (error) {
    console.error('  ✗ Error capturing screenshots:', error);
  }

  return screenshots;
}

/**
 * Main extraction function for Procore training video pages
 */
async function extractProcoreTrainingVideo(page: Page, url: string): Promise<VideoExtractionResult> {
  console.log(`\n🎥 Processing training video: ${url}`);

  const videoParams = extractVideoParams(url);
  const mediaId = videoParams.wmediaid || 'unknown';

  // Navigate to the page
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Extract page title
  const title = await page.title().catch(() => null);
  console.log(`  📄 Title: ${title}`);

  // Extract transcript text from DOM
  const transcriptText = await extractTranscriptText(page);

  // Generate hash of transcript for deduplication
  const transcriptHash = transcriptText
    ? crypto.createHash('sha256').update(transcriptText).digest('hex')
    : null;

  // Download transcript file if available
  const transcriptDownload = await downloadTranscriptIfAvailable(page, mediaId);

  // Discover video assets from network traffic
  const videoAssets = await discoverVideoAssets(page);

  // Capture screenshots
  const screenshots = await captureScreenshots(page, mediaId);

  const result: VideoExtractionResult = {
    source: 'procore_support',
    content_type: 'video_transcript',
    url,
    title,
    transcript_text: transcriptText,
    transcript_hash: transcriptHash,
    transcript_download: transcriptDownload || undefined,
    video: {
      wchannelid: videoParams.wchannelid,
      wmediaid: videoParams.wmediaid,
      asset_urls: videoAssets.asset_urls,
      player_urls: videoAssets.player_urls,
      host_hints: videoAssets.host_hints,
    },
    screenshots,
    extracted_at: new Date().toISOString(),
  };

  // Save metadata to JSON file
  const metadataPath = path.join(METADATA_DIR, `${mediaId}.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(result, null, 2));
  console.log(`  💾 Saved metadata to: ${metadataPath}`);

  // Save transcript text to separate file for easy reading
  if (transcriptText) {
    const transcriptTextPath = path.join(TRANSCRIPTS_DIR, `${mediaId}.txt`);
    fs.writeFileSync(transcriptTextPath, transcriptText);
    console.log(`  💾 Saved transcript text to: ${transcriptTextPath}`);
  }

  return result;
}

/**
 * Test: Extract single training video
 */
test('Extract Procore Training Video - Example', async ({ page }) => {
  setupDirectories();

  const exampleUrl = 'https://support.procore.com/references/videos/training-videos?wchannelid=vtsli1z4on&wmediaid=9uu5aap1ox';

  const result = await extractProcoreTrainingVideo(page, exampleUrl);

  console.log('\n✅ Extraction Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Title: ${result.title}`);
  console.log(`Transcript: ${result.transcript_text ? 'Yes' : 'No'} (${result.transcript_text?.length || 0} chars)`);
  console.log(`Download: ${result.transcript_download?.url ? 'Yes' : 'No'}`);
  console.log(`Video Assets: ${result.video?.asset_urls.length || 0}`);
  console.log(`Hosting: ${result.video?.host_hints.join(', ') || 'Unknown'}`);
  console.log(`Screenshots: ${result.screenshots.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

/**
 * Test: Batch extract multiple training videos
 */
test('Extract Multiple Training Videos', async ({ page }) => {
  setupDirectories();

  // Example URLs - add more as needed
  const videoUrls = [
    'https://support.procore.com/references/videos/training-videos?wchannelid=vtsli1z4on&wmediaid=9uu5aap1ox',
    // Add more video URLs here
  ];

  const results: VideoExtractionResult[] = [];

  for (const url of videoUrls) {
    try {
      const result = await extractProcoreTrainingVideo(page, url);
      results.push(result);

      // Small delay between requests to be respectful
      await page.waitForTimeout(3000);
    } catch (error) {
      console.error(`✗ Failed to process ${url}:`, error);
    }
  }

  // Save consolidated results
  const consolidatedPath = path.join(OUTPUT_DIR, 'all-videos.json');
  fs.writeFileSync(consolidatedPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 Saved consolidated results: ${consolidatedPath}`);
  console.log(`✅ Processed ${results.length} videos successfully`);
});
