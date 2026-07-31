import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = 'auth.json';
const OUTPUT_DIR = './change-events-capture';
const PROJECT_ID = '562949954728542';
const BASE_URL = `https://us02.procore.com/${PROJECT_ID}/project/change_events`;

interface CaptureMetadata {
  url: string;
  timestamp: string;
  title: string;
  description: string;
}

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function capturePageState(
  page: Page,
  name: string,
  description: string
): Promise<void> {
  const timestamp = new Date().toISOString();
  const pageDir = path.join(OUTPUT_DIR, name);
  await ensureDir(pageDir);

  // Wait for page to be stable
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Capture screenshot
  await page.screenshot({
    path: path.join(pageDir, 'screenshot.png'),
    fullPage: true,
  });

  // Capture DOM
  const html = await page.content();
  fs.writeFileSync(path.join(pageDir, 'dom.html'), html);

  // Capture metadata
  const metadata: CaptureMetadata = {
    url: page.url(),
    timestamp,
    title: await page.title(),
    description,
  };
  fs.writeFileSync(
    path.join(pageDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log(`✓ Captured: ${name}`);
}

async function extractFormFields(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    const fields: any[] = [];

    // Find all form inputs, selects, textareas
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach((element) => {
      const input = element as HTMLInputElement;

      // Safely try to find label
      let label = null;
      if (input.id && input.id.length > 0) {
        try {
          // Escape special characters in the ID for querySelector
          const escapedId = CSS.escape(input.id);
          label = document.querySelector(`label[for="${escapedId}"]`);
        } catch (e) {
          // If querySelector fails, skip label lookup
        }
      }

      const fieldGroup = input.closest('[class*="field"], [class*="form-group"]');

      fields.push({
        label: label?.textContent?.trim() || input.placeholder || input.name,
        name: input.name || input.id,
        type: input.type || element.tagName.toLowerCase(),
        required: input.required || input.hasAttribute('required'),
        placeholder: input.placeholder,
        value: input.value,
        id: input.id,
        className: input.className,
        // Check for validation attributes
        pattern: input.pattern,
        minLength: input.minLength,
        maxLength: input.maxLength,
        min: input.min,
        max: input.max,
      });
    });

    return fields;
  });
}

async function main() {
  console.log('🚀 Starting Change Events Capture...\n');

  // Ensure output directory exists
  await ensureDir(OUTPUT_DIR);

  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    // 1. Capture main Change Events list page
    console.log('1️⃣ Capturing Change Events list...');
    await page.goto(`${BASE_URL}/events`);
    await capturePageState(
      page,
      '01-change-events-list',
      'Main change events list view with all events'
    );

    // 2. Capture Create New Change Event form
    console.log('2️⃣ Capturing Create New form...');
    await page.goto(`${BASE_URL}/events/new`);
    await page.waitForTimeout(3000); // Wait for form to load
    await capturePageState(
      page,
      '02-create-form-initial',
      'Create new change event form - initial state'
    );

    // Extract form fields
    const formFields = await extractFormFields(page);
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '02-create-form-initial', 'form-fields.json'),
      JSON.stringify(formFields, null, 2)
    );

    // 3. Try to capture different sections of the form by scrolling
    console.log('3️⃣ Capturing form sections...');

    // Scroll through form to capture all sections
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '02-create-form-initial', 'form-top.png'),
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '02-create-form-initial', 'form-middle.png'),
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '02-create-form-initial', 'form-bottom.png'),
    });

    // 4. Check for existing change events and capture detail view
    console.log('4️⃣ Checking for existing change events...');
    await page.goto(`${BASE_URL}/events`);
    await page.waitForTimeout(2000);

    // Try to find and click the first change event
    const firstEvent = await page.locator('table tbody tr').first();
    const eventExists = await firstEvent.count() > 0;

    if (eventExists) {
      console.log('   Found existing change events, capturing detail view...');
      await firstEvent.click();
      await page.waitForTimeout(2000);
      await capturePageState(
        page,
        '03-change-event-detail',
        'Change event detail view'
      );

      // Capture tabs if they exist
      const tabs = await page.locator('[role="tab"], .tab, [class*="tab"]').all();
      for (let i = 0; i < tabs.length && i < 5; i++) {
        try {
          await tabs[i].click();
          await page.waitForTimeout(1000);
          const tabText = await tabs[i].textContent();
          await capturePageState(
            page,
            `04-detail-tab-${i + 1}-${tabText?.trim().toLowerCase().replace(/\s+/g, '-')}`,
            `Change event detail - ${tabText} tab`
          );
        } catch (error) {
          console.log(`   Could not capture tab ${i + 1}`);
        }
      }
    }

    // 5. Capture any dropdowns or modals on the create form
    console.log('5️⃣ Exploring form dropdowns...');
    await page.goto(`${BASE_URL}/events/new`);
    await page.waitForTimeout(2000);

    // Try to find and open select dropdowns
    const selects = await page.locator('select, [role="combobox"]').all();
    for (let i = 0; i < Math.min(selects.length, 5); i++) {
      try {
        await selects[i].click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, '02-create-form-initial', `dropdown-${i + 1}.png`),
        });
        await page.keyboard.press('Escape');
      } catch (error) {
        console.log(`   Could not capture dropdown ${i + 1}`);
      }
    }

    // 6. Look for action buttons and menus
    console.log('6️⃣ Capturing action menus...');
    await page.goto(`${BASE_URL}/events`);
    await page.waitForTimeout(2000);

    // Look for action buttons (three dots, etc.)
    const actionButtons = await page.locator('[aria-label*="action"], [aria-label*="menu"], button[class*="action"]').all();
    if (actionButtons.length > 0) {
      try {
        await actionButtons[0].click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, '01-change-events-list', 'action-menu.png'),
        });
      } catch (error) {
        console.log('   Could not capture action menu');
      }
    }

    // 7. Capture any filter or search options
    console.log('7️⃣ Capturing filters...');
    const filterButtons = await page.locator('button:has-text("Filter"), button:has-text("Search"), [aria-label*="filter"]').all();
    if (filterButtons.length > 0) {
      try {
        await filterButtons[0].click();
        await page.waitForTimeout(1000);
        await capturePageState(
          page,
          '05-filters-panel',
          'Change events filter panel'
        );
      } catch (error) {
        console.log('   Could not capture filters');
      }
    }

    console.log('\n✅ Capture complete!');
    console.log(`📁 All data saved to: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('❌ Error during capture:', error);
  } finally {
    await browser.close();
  }
}

main();
