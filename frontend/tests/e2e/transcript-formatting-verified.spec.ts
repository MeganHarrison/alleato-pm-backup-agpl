import { test, expect } from '@playwright/test';

test.describe('Transcript Formatting - VERIFICATION TEST', () => {
  test.use({ storageState: './tests/.auth/user.json' });

  test('transcript should have proper paragraph breaks and readable formatting', async ({ page }) => {
    console.log('=== NAVIGATING TO MEETING PAGE ===');
    await page.goto('http://localhost:3004/60/meetings/01KCF4KC2B5DD8BP8STFVTZ3TS');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('=== TAKING BEFORE SCREENSHOT ===');
    await page.screenshot({
      path: 'tests/screenshots/transcript-formatting-FIXED.png',
      fullPage: true
    });

    // Find the Full Transcript section
    const transcriptHeading = page.locator('text=Full Transcript').first();
    await expect(transcriptHeading).toBeVisible({ timeout: 10000 });

    // Scroll to the transcript section
    await transcriptHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Take a close-up screenshot of just the transcript section
    await page.screenshot({
      path: 'tests/screenshots/transcript-section-CLOSEUP.png',
      fullPage: false
    });

    // Get the transcript container
    const transcriptContainer = page.locator('text=Full Transcript').locator('..').locator('..').locator('div.border.border-neutral-200').first();

    // Count paragraph elements within the transcript
    const paragraphs = await transcriptContainer.locator('p').count();
    console.log('=== PARAGRAPH COUNT ===');
    console.log('Number of <p> tags in transcript:', paragraphs);

    // The transcript should have multiple paragraphs, not be one big block
    // If it's properly formatted, there should be at least 10 paragraphs
    expect(paragraphs).toBeGreaterThan(10);

    // Check that strong tags exist (for speaker names/timestamps)
    const strongTags = await transcriptContainer.locator('strong').count();
    console.log('Number of <strong> tags (speaker labels):', strongTags);
    expect(strongTags).toBeGreaterThan(5);

    // Get some sample text to verify formatting
    const firstParagraph = await transcriptContainer.locator('p').first().textContent();
    console.log('=== FIRST PARAGRAPH SAMPLE ===');
    console.log(firstParagraph?.substring(0, 200));

    console.log('=== TEST PASSED: Transcript is properly formatted! ===');
  });
});
