/**
 * Crawl: Change Events "Add To" Workflow
 *
 * Captures the full workflow for creating a CCO or Prime Contract PCO
 * from the Change Events list view by selecting rows and using "Add to".
 *
 * Workflow captured:
 * 1. List view with checkbox selection
 * 2. "Add to" dropdown menu (Commitment / Commitment CO / Prime Contract PCO)
 * 3. Commitment sub-selection → form
 * 4. Commitment CO → form
 * 5. Prime Contract PCO → form
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const COMPANY_ID = '562949953443325';
const PROJECT_ID = '562949955214671';  // From user's URL (MH project)
const BASE_URL = `https://us02.procore.com/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/change-events/events`;

const PROCORE_EMAIL = process.env.PROCORE_USER || 'bclymer@alleatogroup.com';
const PROCORE_PASSWORD = process.env.PROCORE_PASSWORD || 'Clymer926!';

const AUTH_FILE = path.join(__dirname, '../utils/auth.json');
const OUTPUT_DIR = path.join(__dirname, '../../../..', '.claude/procore-manifests/change-events');
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');
const DOM_DIR = path.join(OUTPUT_DIR, 'dom');

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function ensureDirs() {
  [OUTPUT_DIR, SCREENSHOT_DIR, DOM_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

async function shot(page, name, description = '') {
  await page.waitForTimeout(1500);
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  fs.writeFileSync(path.join(DOM_DIR, `${name}.html`), await page.content());
  console.log(`  📸 ${name} — ${description}`);
  return file;
}

async function extractFormFields(page) {
  return page.evaluate(() => {
    const results = [];
    const sections = document.querySelectorAll('fieldset, [class*="section"], [class*="form-group"], [class*="field-group"]');

    if (sections.length) {
      sections.forEach(section => {
        const title = section.querySelector('legend, h2, h3, h4, label')?.textContent?.trim();
        const inputs = section.querySelectorAll('input, select, textarea, [role="combobox"], [role="listbox"]');
        inputs.forEach(el => {
          const label = el.id
            ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim()
            : el.closest('[class*="field"]')?.querySelector('label')?.textContent?.trim();
          results.push({
            section: title || 'General',
            label: label || el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('aria-label') || '',
            name: el.getAttribute('name') || el.id || '',
            type: el.tagName === 'SELECT' ? 'select' : (el.getAttribute('type') || el.tagName.toLowerCase()),
            required: el.required || el.getAttribute('aria-required') === 'true',
            placeholder: el.getAttribute('placeholder') || '',
          });
        });
      });
    } else {
      // Fallback: grab all inputs
      document.querySelectorAll('input, select, textarea').forEach(el => {
        const label = el.id
          ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim()
          : el.closest('[class*="row"], [class*="field"]')?.querySelector('label')?.textContent?.trim();
        results.push({
          section: 'General',
          label: label || el.getAttribute('placeholder') || el.getAttribute('name') || '',
          name: el.getAttribute('name') || el.id || '',
          type: el.tagName === 'SELECT' ? 'select' : (el.getAttribute('type') || el.tagName.toLowerCase()),
          required: el.required,
          placeholder: el.getAttribute('placeholder') || '',
        });
      });
    }
    return results;
  });
}

async function login(page) {
  console.log('  🔐 Logging in to Procore...');
  await page.goto('https://login.procore.com/');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[type="email"], input[name="email"], #email', PROCORE_EMAIL);
  await page.click('button[type="submit"], button:has-text("Continue"), button:has-text("Next")');
  await page.waitForTimeout(1500);

  await page.fill('input[type="password"], input[name="password"], #password', PROCORE_PASSWORD);
  await page.click('button[type="submit"], button:has-text("Log In"), button:has-text("Sign In")');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('  ✅ Logged in');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Change Events "Add To" Workflow Crawler\n');
  ensureDirs();

  const manifest = { capturedAt: new Date().toISOString(), workflows: {} };

  const browser = await chromium.launch({ headless: false, slowMo: 100 });

  // Try saved auth first
  let context;
  if (fs.existsSync(AUTH_FILE)) {
    console.log('  📂 Using saved auth session...');
    context = await browser.newContext({
      storageState: AUTH_FILE,
      viewport: { width: 1440, height: 900 },
    });
  } else {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  }

  const page = await context.newPage();

  // ── 1. Navigate to Change Events list ───────────────────────────────────────
  console.log('\n1️⃣  Loading Change Events list...');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check if we need to login
  if (page.url().includes('login') || page.url().includes('auth')) {
    await login(page);
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }

  await shot(page, 'list-add-to-01-initial', 'Change Events list — initial state');

  // ── 2. Select a row checkbox ────────────────────────────────────────────────
  console.log('\n2️⃣  Selecting a row via checkbox...');

  // AG Grid uses .ag-checkbox-input for row checkboxes
  // The header select-all checkbox is .ag-header-select-all .ag-checkbox-input
  // Row checkboxes are .ag-row .ag-checkbox-input
  const checkboxSelectors = [
    // AG Grid row checkboxes
    '.ag-row .ag-checkbox-input',
    '.ag-row .ag-input-field-input.ag-checkbox-input',
    // Procore custom checkbox
    '.StyledCheckboxContainer-core-12_34_0__sc-u63tye-0 input[type="checkbox"]',
    '.checkbox input[type="checkbox"]',
    // Fallback
    '.ag-cell input[type="checkbox"]',
  ];

  let checkboxFound = false;
  for (const sel of checkboxSelectors) {
    const cb = page.locator(sel).first();
    if (await cb.count() > 0) {
      await cb.click({ force: true });
      await page.waitForTimeout(500);
      checkboxFound = true;
      console.log(`  ✅ Checked row using selector: ${sel}`);
      break;
    }
  }

  if (!checkboxFound) {
    // Try clicking the first AG Grid row near the checkbox column (leftmost cell)
    console.log('  ⚠️  No checkbox found, trying AG Grid row cell click...');
    const firstCell = page.locator('.ag-row:first-child .ag-cell:first-child').first();
    if (await firstCell.count() > 0) {
      const box = await firstCell.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        checkboxFound = true;
        console.log('  ✅ Clicked first AG Grid cell');
      }
    }
  }

  await page.waitForTimeout(1000);
  await shot(page, 'list-add-to-02-row-selected', 'Row checkbox checked — "Add to" should appear in toolbar');

  // ── 3. Click "Add to" button ────────────────────────────────────────────────
  console.log('\n3️⃣  Clicking "Add to" button...');

  const addToSelectors = [
    'button:has-text("Add to")',
    'button:has-text("Add To")',
    '[class*="bulk"] button:has-text("Add")',
    'text=Add to',
  ];

  let addToClicked = false;
  for (const sel of addToSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0) {
      const isDisabled = await btn.isDisabled();
      if (isDisabled) {
        console.log(`  ⚠️  "Add to" button found but disabled — checkbox may not be checked`);
        // Try force-clicking to reveal the dropdown anyway
        await btn.click({ force: true });
      } else {
        await btn.click();
      }
      addToClicked = true;
      console.log(`  ✅ Clicked "Add to" via: ${sel}`);
      break;
    }
  }

  if (!addToClicked) {
    console.log('  ⚠️  "Add to" button not found — row may not be selected or button is hidden');
  }

  await page.waitForTimeout(1000);
  await shot(page, 'list-add-to-03-dropdown-open', '"Add to" dropdown open — Commitment / Commitment CO / Prime Contract PCO');

  // Extract the dropdown options
  const dropdownOptions = await page.evaluate(() => {
    const options = [];
    const items = document.querySelectorAll('[role="menuitem"], [role="option"], .dropdown-item, li[class*="menu"]');
    items.forEach(el => options.push(el.textContent?.trim()));
    return options.filter(Boolean);
  });
  console.log('  📋 Dropdown options found:', dropdownOptions);

  manifest.workflows['add-to-dropdown'] = {
    description: 'Add to dropdown options visible after selecting row(s)',
    trigger: 'Check row checkbox → click "Add to" button',
    options: dropdownOptions,
    screenshot: 'screenshots/list-add-to-03-dropdown-open.png',
  };

  // ── 4. Capture "Prime Contract PCO" flow ─────────────────────────────────────
  console.log('\n4️⃣  Exploring Prime Contract PCO option...');

  const pcoPcoSelectors = [
    'text=Prime Contract PCO',
    '[role="menuitem"]:has-text("Prime Contract PCO")',
    'li:has-text("Prime Contract PCO")',
  ];

  let pcoPcoClicked = false;
  for (const sel of pcoPcoSelectors) {
    const item = page.locator(sel).first();
    if (await item.count() > 0) {
      await item.click();
      pcoPcoClicked = true;
      console.log('  ✅ Clicked "Prime Contract PCO"');
      break;
    }
  }

  if (pcoPcoClicked) {
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    await shot(page, 'list-add-to-04-prime-contract-pco-form', 'Prime Contract PCO creation form');

    const pcoFields = await extractFormFields(page);
    manifest.workflows['prime-contract-pco-form'] = {
      description: 'Form for creating a Prime Contract Potential Change Order from a Change Event',
      url: page.url(),
      fields: pcoFields,
      screenshot: 'screenshots/list-add-to-04-prime-contract-pco-form.png',
    };

    // Scroll through full form
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await shot(page, 'list-add-to-04b-prime-contract-pco-form-mid', 'Prime Contract PCO form — mid section');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'list-add-to-04c-prime-contract-pco-form-bottom', 'Prime Contract PCO form — bottom section');

    console.log(`  📋 Captured ${pcoFields.length} form fields`);
  }

  // Go back to list
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // ── 5. Re-select row and open "Add to" → Commitment CO ─────────────────────
  console.log('\n5️⃣  Exploring Commitment CO option...');

  for (const sel of checkboxSelectors) {
    const cb = page.locator(sel).first();
    if (await cb.count() > 0) { await cb.click({ force: true }); break; }
  }
  await page.waitForTimeout(800);

  for (const sel of addToSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0) { await btn.click(); break; }
  }
  await page.waitForTimeout(800);

  const ccoCandidates = [
    'text=Commitment CO',
    '[role="menuitem"]:has-text("Commitment CO")',
    'li:has-text("Commitment CO")',
  ];

  let ccoClicked = false;
  for (const sel of ccoCandidates) {
    const item = page.locator(sel).first();
    if (await item.count() > 0) {
      // This option may have a submenu — first screenshot the hover state
      await item.hover();
      await page.waitForTimeout(600);
      await shot(page, 'list-add-to-05-commitment-co-submenu', 'Commitment CO submenu (subcontract list)');

      await item.click();
      ccoClicked = true;
      console.log('  ✅ Clicked "Commitment CO"');
      break;
    }
  }

  if (ccoClicked) {
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    await shot(page, 'list-add-to-05b-commitment-co-form', 'Commitment CO creation form');

    const ccoFields = await extractFormFields(page);
    manifest.workflows['commitment-co-form'] = {
      description: 'Form for creating a Commitment Change Order from a Change Event',
      url: page.url(),
      fields: ccoFields,
      screenshot: 'screenshots/list-add-to-05b-commitment-co-form.png',
    };

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await shot(page, 'list-add-to-05c-commitment-co-form-mid', 'Commitment CO form — mid');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'list-add-to-05d-commitment-co-form-bottom', 'Commitment CO form — bottom');

    console.log(`  📋 Captured ${ccoFields.length} form fields`);
  }

  // Go back to list
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // ── 6. Re-select row and open "Add to" → Commitment ─────────────────────────
  console.log('\n6️⃣  Exploring Commitment option...');

  for (const sel of checkboxSelectors) {
    const cb = page.locator(sel).first();
    if (await cb.count() > 0) { await cb.click({ force: true }); break; }
  }
  await page.waitForTimeout(800);

  for (const sel of addToSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0) { await btn.click(); break; }
  }
  await page.waitForTimeout(800);

  const commitmentCandidates = [
    'text=Commitment\n',
    '[role="menuitem"]:has-text("Commitment")',
    'li:has-text("Commitment")',
  ];

  // Use the first exact match (not "Commitment CO")
  let commitmentClicked = false;
  const menuItems = await page.locator('[role="menuitem"], li[class*="menu"]').all();
  for (const item of menuItems) {
    const text = (await item.textContent())?.trim();
    if (text === 'Commitment') {
      await item.hover();
      await page.waitForTimeout(600);
      await shot(page, 'list-add-to-06-commitment-submenu', 'Commitment submenu (subcontract/PO list)');
      await item.click();
      commitmentClicked = true;
      console.log('  ✅ Clicked "Commitment"');
      break;
    }
  }

  if (commitmentClicked) {
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    await shot(page, 'list-add-to-06b-commitment-form', 'Commitment addition form/modal');

    const commitmentFields = await extractFormFields(page);
    manifest.workflows['commitment-form'] = {
      description: 'Form for adding a Change Event to a Commitment',
      url: page.url(),
      fields: commitmentFields,
      screenshot: 'screenshots/list-add-to-06b-commitment-form.png',
    };
    console.log(`  📋 Captured ${commitmentFields.length} form fields`);
  }

  // ── 7. Capture the "Send Requests for Quote" button workflow ─────────────────
  console.log('\n7️⃣  Capturing "Send Requests for Quote" button state...');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  for (const sel of checkboxSelectors) {
    const cb = page.locator(sel).first();
    if (await cb.count() > 0) { await cb.click({ force: true }); break; }
  }
  await page.waitForTimeout(800);
  await shot(page, 'list-add-to-07-selection-bar', 'Full selection action bar with "Add to" and "Send Requests for Quote" buttons visible');

  // Save manifest
  const manifestPath = path.join(OUTPUT_DIR, 'manifest-add-to-workflow.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('\n✅ Crawl complete!');
  console.log(`📁 Screenshots: ${SCREENSHOT_DIR}`);
  console.log(`📄 Manifest:    ${manifestPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('❌ Crawl failed:', err);
  process.exit(1);
});
