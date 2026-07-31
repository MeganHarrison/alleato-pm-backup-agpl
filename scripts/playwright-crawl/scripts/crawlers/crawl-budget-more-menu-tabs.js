import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./procore-budget-crawl";
const WAIT_TIME = 3000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");

// Procore credentials
const PROCORE_EMAIL = "bclymer@alleatogroup.com";
const PROCORE_PASSWORD = "Clymer926!";

// Base URL
const BASE_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949955214786/tools/budgets";

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .substring(0, 150);
}

async function analyzePageStructure(page) {
  return await page.evaluate(() => {
    const components = {
      buttons: document.querySelectorAll('button').length,
      forms: document.querySelectorAll('form').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
      tables: document.querySelectorAll('table').length,
      tabs: document.querySelectorAll('[role="tab"], .tab').length
    };

    const tables = Array.from(document.querySelectorAll('table')).map((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = table.querySelectorAll('tbody tr').length;
      return {
        index: index + 1,
        headers,
        rows
      };
    });

    const tabs = Array.from(document.querySelectorAll('[role="tab"], .tab, [class*="tab"]'))
      .filter(tab => {
        const rect = tab.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map(tab => ({
        text: tab.textContent.trim(),
        isSelected: tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('active')
      }));

    return {
      components,
      tables,
      tabs,
      title: document.title
    };
  });
}

async function captureView(page, viewName, description) {
  try {
    console.log(`   📸 Capturing: ${description}`);

    // Create page directory
    const pageDir = path.join(SCREENSHOT_DIR, viewName);
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

    // Wait for content to load
    await page.waitForTimeout(WAIT_TIME);

    // Capture screenshot
    const screenshotPath = path.join(pageDir, "screenshot.png");
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      timeout: 60000
    });

    // Save DOM
    const htmlContent = await page.content();
    fs.writeFileSync(path.join(pageDir, "dom.html"), htmlContent);

    // Analyze page
    const analysis = await analyzePageStructure(page);

    // Save metadata
    const metadata = {
      viewName,
      description,
      baseUrl: BASE_URL,
      timestamp: new Date().toISOString(),
      analysis,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`   ✅ Captured - Tables: ${analysis.tables.length}, Tabs: ${analysis.tabs.length}`);
    return metadata;
  } catch (error) {
    console.error(`   ❌ Error capturing ${viewName}:`, error.message);
    return null;
  }
}

async function exploreMoreMenu(page) {
  const capturedViews = [];

  try {
    console.log('\n🔍 STEP 1: Looking for "More" tab menu...\n');

    // Navigate to base URL
    await page.goto(BASE_URL, {
      waitUntil: "networkidle",
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    // Capture the main budget view first
    console.log('📍 Capturing main budget view...');
    const mainView = await captureView(page, 'budget-main-table-view', 'Main Budget Table View');
    if (mainView) capturedViews.push(mainView);

    // Try to find and click the "More" tab dropdown
    console.log('\n🔍 STEP 2: Searching for "More" tab button...\n');

    const moreTabSelectors = [
      'button:has-text("More")',
      '[class*="DropdownTab"]:has-text("More")',
      '[class*="dropdown-tab"]:has-text("More")',
      '.tab:has-text("More")',
      '[role="tab"]:has-text("More")'
    ];

    let moreMenuOpened = false;

    for (const selector of moreTabSelectors) {
      try {
        const elements = await page.$$(selector);

        for (const element of elements) {
          try {
            const isVisible = await element.isVisible();
            const text = await element.textContent();

            console.log(`   Trying selector: ${selector}`);
            console.log(`   Text: "${text?.trim()}", Visible: ${isVisible}`);

            if (isVisible && text?.trim() === 'More') {
              console.log(`   ✅ Found "More" tab! Clicking...`);
              await element.click();
              await page.waitForTimeout(2000);

              // Check if a menu appeared
              const menuVisible = await page.evaluate(() => {
                const menus = document.querySelectorAll('[role="menu"], .dropdown-menu, [class*="menu"]');
                for (const menu of menus) {
                  const rect = menu.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    return true;
                  }
                }
                return false;
              });

              if (menuVisible) {
                console.log(`   ✅ More menu opened successfully!`);
                moreMenuOpened = true;
                break;
              } else {
                console.log(`   ⚠️  Click registered but no menu appeared`);
              }
            }
          } catch (err) {
            console.log(`   ⚠️  Error with element: ${err.message}`);
          }
        }

        if (moreMenuOpened) break;
      } catch (err) {
        console.log(`   ⚠️  Selector failed: ${selector} - ${err.message}`);
      }
    }

    if (!moreMenuOpened) {
      console.log('\n❌ Could not open "More" menu. Trying alternative approach...\n');

      // Alternative: Look for tabs directly visible on page
      console.log('🔍 STEP 3: Looking for tabs visible on the page...\n');

      const visibleTabs = await page.evaluate(() => {
        const tabs = [];
        const selectors = [
          '[role="tab"]',
          '.tab',
          '[class*="tab"]',
          'a[href*="budget"]'
        ];

        selectors.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                tabs.push({
                  text: el.textContent.trim(),
                  tag: el.tagName,
                  classes: el.className,
                  href: el.href || null
                });
              }
            });
          } catch (e) {}
        });

        return tabs;
      });

      console.log(`   Found ${visibleTabs.length} visible tabs/links:`);
      visibleTabs.forEach(tab => {
        console.log(`   - "${tab.text}" (${tab.tag})`);
      });

      // Try clicking on tabs that match our target views
      const targetTabs = ['Details', 'Forecast', 'Forecasting', 'Snapshot', 'Change History', 'History'];

      for (const targetText of targetTabs) {
        console.log(`\n   Looking for "${targetText}" tab...`);

        const tabSelectors = [
          `button:has-text("${targetText}")`,
          `a:has-text("${targetText}")`,
          `[role="tab"]:has-text("${targetText}")`,
          `.tab:has-text("${targetText}")`
        ];

        for (const selector of tabSelectors) {
          try {
            const element = await page.$(selector);
            if (element && await element.isVisible()) {
              console.log(`   ✅ Found "${targetText}" tab! Clicking...`);
              await element.click();
              await page.waitForTimeout(WAIT_TIME);

              const viewName = `budget-${sanitizeFilename(targetText)}-tab`;
              const view = await captureView(page, viewName, `${targetText} Tab`);
              if (view) capturedViews.push(view);

              // Navigate back to main view
              await page.goto(BASE_URL, { waitUntil: "networkidle" });
              await page.waitForTimeout(2000);
              break;
            }
          } catch (err) {
            // Continue to next selector
          }
        }
      }
    } else {
      // More menu is open - extract menu items
      console.log('\n🔍 STEP 4: Extracting menu items from "More" menu...\n');

      const menuItems = await page.evaluate(() => {
        const items = [];
        const menuSelectors = [
          '[role="menu"] a',
          '[role="menu"] button',
          '.dropdown-menu a',
          '.dropdown-menu button',
          '[class*="menu-item"]',
          '[class*="MenuItem"]'
        ];

        menuSelectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(item => {
            const rect = item.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              items.push({
                text: item.textContent.trim(),
                href: item.href || null,
                tag: item.tagName
              });
            }
          });
        });

        return items;
      });

      console.log(`   Found ${menuItems.length} menu items:`);
      menuItems.forEach(item => {
        console.log(`   - "${item.text}" (${item.tag})`);
      });

      // Click on each menu item and capture
      for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];

        if (!item.text) continue;

        console.log(`\n   [${i + 1}/${menuItems.length}] Clicking: "${item.text}"`);

        try {
          // Find and click the menu item
          const itemElement = await page.evaluateHandle((itemText) => {
            const menuSelectors = [
              '[role="menu"] a',
              '[role="menu"] button',
              '.dropdown-menu a',
              '.dropdown-menu button'
            ];

            for (const sel of menuSelectors) {
              const elements = document.querySelectorAll(sel);
              for (const el of elements) {
                if (el.textContent.trim() === itemText) {
                  return el;
                }
              }
            }
            return null;
          }, item.text);

          if (itemElement) {
            await itemElement.click();
            await page.waitForTimeout(WAIT_TIME);

            const viewName = `budget-more-${sanitizeFilename(item.text)}`;
            const view = await captureView(page, viewName, `More Menu: ${item.text}`);
            if (view) capturedViews.push(view);

            // Go back and reopen menu
            await page.goto(BASE_URL, { waitUntil: "networkidle" });
            await page.waitForTimeout(2000);

            // Reopen More menu
            const moreButton = await page.$('button:has-text("More")');
            if (moreButton && await moreButton.isVisible()) {
              await moreButton.click();
              await page.waitForTimeout(1500);
            }
          }
        } catch (err) {
          console.error(`   ❌ Error clicking "${item.text}":`, err.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Fatal error in exploreMoreMenu:', error);
  }

  return capturedViews;
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('🚀 Budget More Menu Crawler');
    console.log('🔐 Logging into Procore...\n');

    // Login
    await page.goto('https://login.procore.com/');
    await page.waitForTimeout(2000);

    await page.fill('input[type="email"]', PROCORE_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.fill('input[type="password"]', PROCORE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    console.log('✅ Logged in successfully\n');

    // Explore More menu
    const capturedViews = await exploreMoreMenu(page);

    // Generate report
    console.log('\n📊 Generating report...\n');

    const report = {
      timestamp: new Date().toISOString(),
      totalCaptured: capturedViews.length,
      views: capturedViews
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'more-menu-crawl-results.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('✅ Crawl complete!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📊 Captured ${capturedViews.length} views`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
