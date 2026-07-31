import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, 'design-review-screenshots');

test.describe('Schedule Page Design Review', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to schedule page
    await page.goto('http://localhost:3000/67/schedule');
    await page.waitForLoadState('networkidle');
  });

  test('Capture initial state (loading or error or content)', async ({ page }) => {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-initial-state.png'),
      fullPage: true
    });
  });

  test('Capture Grid tab', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(2000);

    // Try to click Grid tab if visible
    const gridTab = page.getByRole('tab', { name: /grid/i });
    if (await gridTab.isVisible()) {
      await gridTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-grid-tab.png'),
      fullPage: true
    });
  });

  test('Capture Board tab', async ({ page }) => {
    await page.waitForTimeout(2000);

    const boardTab = page.getByRole('tab', { name: /board/i });
    if (await boardTab.isVisible()) {
      await boardTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-board-tab.png'),
      fullPage: true
    });
  });

  test('Capture Schedule tab', async ({ page }) => {
    await page.waitForTimeout(2000);

    const scheduleTab = page.getByRole('tab', { name: /schedule/i });
    if (await scheduleTab.isVisible()) {
      await scheduleTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-schedule-tab.png'),
      fullPage: true
    });
  });

  test('Capture Timeline tab', async ({ page }) => {
    await page.waitForTimeout(2000);

    const timelineTab = page.getByRole('tab', { name: /timeline/i });
    if (await timelineTab.isVisible()) {
      await timelineTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-timeline-tab.png'),
      fullPage: true
    });
  });

  test('Capture Calendar tab', async ({ page }) => {
    await page.waitForTimeout(2000);

    const calendarTab = page.getByRole('tab', { name: /calendar/i });
    if (await calendarTab.isVisible()) {
      await calendarTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-calendar-tab.png'),
      fullPage: true
    });
  });

  test('Capture hover states on Grid tab', async ({ page }) => {
    await page.waitForTimeout(2000);

    const gridTab = page.getByRole('tab', { name: /grid/i });
    if (await gridTab.isVisible()) {
      await gridTab.click();
      await page.waitForTimeout(1000);

      // Hover over a task row if visible
      const firstRow = page.locator('tr').nth(1);
      if (await firstRow.isVisible()) {
        await firstRow.hover();
        await page.waitForTimeout(500);
      }
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '07-grid-hover-state.png'),
      fullPage: true
    });
  });
});
