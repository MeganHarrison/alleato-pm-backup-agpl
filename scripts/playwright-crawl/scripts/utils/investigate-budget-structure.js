import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// Procore credentials
const PROCORE_EMAIL = "bclymer@alleatogroup.com";
const PROCORE_PASSWORD = "Clymer926!";

// Budget URL
const BUDGET_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949955214786/tools/budgets";

async function investigateBudgetStructure() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('🔐 Logging into Procore...');

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

    // Navigate to budget
    console.log('📍 Navigating to Budget module...');
    await page.goto(BUDGET_URL, {
      waitUntil: "networkidle",
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    console.log('\n🔍 INVESTIGATING PAGE STRUCTURE\n');
    console.log('='.repeat(60));

    // 1. Find all navigation/tab elements
    console.log('\n1️⃣  NAVIGATION & TABS:');
    const navElements = await page.evaluate(() => {
      const elements = [];

      // Look for various tab/nav patterns
      const selectors = [
        '[role="tab"]',
        '[role="tablist"] *',
        '.tab',
        '.tabs li',
        '.nav-item',
        'nav a',
        '[aria-selected]',
        '[class*="tab"]',
        '[class*="nav"]'
      ];

      selectors.forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              elements.push({
                text: el.textContent.trim().substring(0, 100),
                selector: sel,
                tag: el.tagName,
                classes: el.className,
                id: el.id || null,
                href: el.href || null
              });
            }
          });
        } catch (e) {}
      });

      return elements;
    });

    if (navElements.length > 0) {
      console.log('   Found navigation elements:');
      navElements.slice(0, 20).forEach(el => {
        console.log(`   - "${el.text}" (${el.tag}, selector: ${el.selector})`);
      });
    } else {
      console.log('   ❌ No traditional tabs/navigation found');
    }

    // 2. Find all clickable buttons
    console.log('\n2️⃣  BUTTONS & CLICKABLES:');
    const buttons = await page.evaluate(() => {
      const btns = [];
      document.querySelectorAll('button').forEach(btn => {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          btns.push({
            text: btn.textContent.trim(),
            classes: btn.className,
            id: btn.id || null,
            ariaLabel: btn.getAttribute('aria-label')
          });
        }
      });
      return btns;
    });

    console.log(`   Found ${buttons.length} visible buttons:`);
    buttons.slice(0, 30).forEach(btn => {
      const label = btn.text || btn.ariaLabel || '(unlabeled)';
      console.log(`   - "${label}"`);
    });

    // 3. Check URL structure and available routes
    console.log('\n3️⃣  URL STRUCTURE ANALYSIS:');
    console.log(`   Current URL: ${page.url()}`);

    // Check if there are hash-based routes
    const hasHash = page.url().includes('#');
    console.log(`   Hash routing: ${hasHash ? 'YES' : 'NO'}`);

    // 4. Find dropdown menus
    console.log('\n4️⃣  DROPDOWN MENUS:');
    const dropdowns = await page.evaluate(() => {
      const drops = [];
      document.querySelectorAll('select, [class*="dropdown"], [aria-haspopup]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          drops.push({
            text: el.textContent.trim().substring(0, 50),
            tag: el.tagName,
            classes: el.className
          });
        }
      });
      return drops;
    });

    console.log(`   Found ${dropdowns.length} dropdowns:`);
    dropdowns.forEach(d => {
      console.log(`   - "${d.text}" (${d.tag})`);
    });

    // 5. Check for iframe/embedded content
    console.log('\n5️⃣  EMBEDDED CONTENT:');
    const frames = await page.frames();
    console.log(`   Total frames: ${frames.length}`);
    if (frames.length > 1) {
      for (let i = 1; i < frames.length; i++) {
        try {
          const frameUrl = frames[i].url();
          console.log(`   - Frame ${i}: ${frameUrl}`);
        } catch (e) {}
      }
    }

    // 6. Look for more menu/settings
    console.log('\n6️⃣  MORE/SETTINGS MENUS:');
    const moreMenus = await page.$$('[class*="more"], [class*="kebab"], [aria-label*="more"], [aria-label*="menu"]');
    console.log(`   Found ${moreMenus.length} "more" menu triggers`);

    // 7. Check for specific text in page
    console.log('\n7️⃣  SEARCHING FOR KEY TERMS:');
    const searchTerms = ['Details', 'Forecast', 'Forecasting', 'Snapshot', 'Change History', 'History'];
    for (const term of searchTerms) {
      const found = await page.evaluate((searchTerm) => {
        return document.body.textContent.includes(searchTerm);
      }, term);
      console.log(`   "${term}": ${found ? '✅ FOUND' : '❌ Not found'}`);
    }

    // 8. Extract all unique hrefs
    console.log('\n8️⃣  ALL LINKS (hrefs):');
    const allLinks = await page.evaluate(() => {
      const links = new Set();
      document.querySelectorAll('a[href]').forEach(a => {
        if (a.href.includes('procore.com') && !a.href.includes('javascript:')) {
          links.add(a.href);
        }
      });
      return Array.from(links);
    });

    console.log(`   Total unique links: ${allLinks.length}`);
    const budgetLinks = allLinks.filter(l => l.includes('budget'));
    if (budgetLinks.length > 0) {
      console.log('   Budget-related links:');
      budgetLinks.forEach(link => {
        console.log(`   - ${link}`);
      });
    }

    // 9. Check main navigation/menu
    console.log('\n9️⃣  MAIN TOOL MENU:');
    const toolMenus = await page.evaluate(() => {
      const menus = [];
      // Look for Procore's tool navigation
      document.querySelectorAll('[class*="tool"], [class*="menu"] a, nav a').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          menus.push({
            text: el.textContent.trim(),
            href: el.href
          });
        }
      });
      return menus;
    });

    const uniqueTools = [...new Set(toolMenus.map(t => t.text))];
    console.log(`   Available tools: ${uniqueTools.slice(0, 20).join(', ')}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 RECOMMENDATIONS:\n');

    if (budgetLinks.length === 0) {
      console.log('⚠️  No additional budget URLs found in links');
      console.log('   The views may be:');
      console.log('   - Behind dropdowns/modals (need to click to reveal)');
      console.log('   - Dynamically loaded (not present in initial DOM)');
      console.log('   - Under different URL paths');
      console.log('   - Behind specific user permissions');
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      navigation: navElements,
      buttons: buttons,
      dropdowns: dropdowns,
      allLinks: allLinks,
      budgetLinks: budgetLinks,
      toolMenus: uniqueTools
    };

    fs.writeFileSync(
      './procore-budget-crawl/budget-structure-investigation.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n✅ Investigation complete!');
    console.log('📄 Report saved to: ./procore-budget-crawl/budget-structure-investigation.json');

    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will remain open for 60 seconds for manual inspection...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

investigateBudgetStructure().catch(console.error);
