import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = "./outputs/modals";
const AUTH_FILE = "./auth.json";
const PROJECT_ID = "562949954728542";
const COMPANY_ID = "562949953443325";
const BASE_URL = "https://us02.procore.com";

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Modal configurations
const MODAL_CONFIGS = [
  {
    name: "rfi-create",
    pageUrl: `/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/rfi`,
    triggerSelectors: [
      'button:has-text("Create RFI")',
      'button:has-text("New RFI")',
      'button:has-text("Add RFI")',
      'button[data-testid="create-rfi"]',
      'a[href*="rfi/create"]',
      'button[aria-label*="Create RFI"]'
    ],
    waitForModal: 'form[action*="rfi"], [role="dialog"]:has-text("RFI"), .modal:has-text("RFI")'
  },
  {
    name: "submittal-create",
    pageUrl: `/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/submittal_log`,
    triggerSelectors: [
      'button:has-text("Create Submittal")',
      'button:has-text("New Submittal")',
      'button:has-text("Add Submittal")',
      'button[data-testid="create-submittal"]',
      'a[href*="submittal/create"]'
    ],
    waitForModal: 'form[action*="submittal"], [role="dialog"]:has-text("Submittal"), .modal:has-text("Submittal")'
  },
  {
    name: "change-order-create",
    pageUrl: `/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/contracts/change_orders`,
    triggerSelectors: [
      'button:has-text("Create Change Order")',
      'button:has-text("New Change Order")',
      'button:has-text("Add Change Order")',
      'button[data-testid="create-change-order"]',
      'a[href*="change_order/create"]'
    ],
    waitForModal: 'form[action*="change_order"], [role="dialog"]:has-text("Change Order"), .modal:has-text("Change Order")'
  },
  {
    name: "document-upload",
    pageUrl: `/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/documents`,
    triggerSelectors: [
      'button:has-text("Upload")',
      'button:has-text("Upload Files")',
      'button:has-text("Add Files")',
      'button[data-testid="upload-document"]',
      'button[aria-label*="Upload"]'
    ],
    waitForModal: '[role="dialog"]:has-text("Upload"), .modal:has-text("Upload"), [class*="upload-modal"]'
  },
  {
    name: "meeting-create",
    pageUrl: `/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/meetings`,
    triggerSelectors: [
      'button:has-text("Create Meeting")',
      'button:has-text("New Meeting")',
      'button:has-text("Add Meeting")',
      'button[data-testid="create-meeting"]'
    ],
    waitForModal: 'form[action*="meeting"], [role="dialog"]:has-text("Meeting"), .modal:has-text("Meeting")'
  },
  {
    name: "punch-item-create",
    pageUrl: `/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/punch_list`,
    triggerSelectors: [
      'button:has-text("Create Punch Item")',
      'button:has-text("New Punch Item")',
      'button:has-text("Add Punch Item")',
      'button[data-testid="create-punch-item"]'
    ],
    waitForModal: 'form[action*="punch"], [role="dialog"]:has-text("Punch"), .modal:has-text("Punch")'
  }
];

async function captureModal(page, config) {
  console.log(`\n📍 Attempting to capture ${config.name} modal...`);
  
  try {
    // Navigate to the page
    console.log(`Navigating to: ${BASE_URL}${config.pageUrl}`);
    await page.goto(`${BASE_URL}${config.pageUrl}`, { waitUntil: "networkidle", timeout: 60000 });
    
    // Wait for page to stabilize
    await page.waitForTimeout(3000);
    
    // Try each trigger selector
    let modalOpened = false;
    for (const selector of config.triggerSelectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          console.log(`Found element with selector: ${selector}`);
          await element.click();
          
          // Wait for modal to appear
          try {
            await page.waitForSelector(config.waitForModal, { timeout: 5000 });
            modalOpened = true;
            console.log("✅ Modal opened successfully!");
            break;
          } catch (e) {
            console.log("Modal did not appear with this trigger, trying next...");
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (modalOpened) {
      // Wait a bit for modal to fully render
      await page.waitForTimeout(2000);
      
      // Capture modal screenshot
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${config.name}-modal.png`),
        fullPage: true
      });
      
      // Save modal HTML
      const html = await page.content();
      fs.writeFileSync(path.join(OUTPUT_DIR, `${config.name}-modal.html`), html);
      
      // Extract modal content and fields
      const modalData = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"], .modal, [class*="modal"]:not(.modal-backdrop)');
        if (!modal) return null;
        
        // Get form fields
        const inputs = modal.querySelectorAll('input, textarea, select');
        const fields = Array.from(inputs).map(input => ({
          type: input.tagName.toLowerCase(),
          name: input.getAttribute('name') || input.getAttribute('id') || '',
          label: input.getAttribute('aria-label') || input.getAttribute('placeholder') || '',
          required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true'
        }));
        
        // Get labels
        const labels = Array.from(modal.querySelectorAll('label')).map(label => ({
          text: label.textContent?.trim() || '',
          for: label.getAttribute('for') || ''
        }));
        
        // Get buttons
        const buttons = Array.from(modal.querySelectorAll('button')).map(button => ({
          text: button.textContent?.trim() || '',
          type: button.getAttribute('type') || 'button'
        }));
        
        return {
          title: modal.querySelector('h1, h2, h3, [role="heading"]')?.textContent?.trim() || 'Unknown',
          fields,
          labels,
          buttons,
          hasForm: modal.querySelector('form') !== null
        };
      });
      
      // Save metadata
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${config.name}-metadata.json`),
        JSON.stringify({
          name: config.name,
          url: `${BASE_URL}${config.pageUrl}`,
          captureDate: new Date().toISOString(),
          modalFound: true,
          modalData
        }, null, 2)
      );
      
      console.log(`✅ Captured ${config.name} modal successfully!`);
      
      // Close modal if possible
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch (e) {
        // Ignore if escape doesn't work
      }
      
    } else {
      console.log(`❌ Could not open ${config.name} modal`);
      
      // Still capture the page state
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${config.name}-page.png`),
        fullPage: true
      });
      
      // Save metadata about failure
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${config.name}-metadata.json`),
        JSON.stringify({
          name: config.name,
          url: `${BASE_URL}${config.pageUrl}`,
          captureDate: new Date().toISOString(),
          modalFound: false,
          error: "Could not trigger modal with any selector"
        }, null, 2)
      );
    }
    
  } catch (error) {
    console.error(`❌ Error capturing ${config.name}:`, error.message);
    
    // Save error metadata
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${config.name}-error.json`),
      JSON.stringify({
        name: config.name,
        url: `${BASE_URL}${config.pageUrl}`,
        captureDate: new Date().toISOString(),
        error: error.message
      }, null, 2)
    );
  }
}

(async () => {
  console.log("Starting modal dialog capture...");
  
  const browser = await chromium.launch({
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });

  // Create context with stored auth
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Capture each modal
    for (const config of MODAL_CONFIGS) {
      await captureModal(page, config);
    }
    
    console.log("\n✅ Modal capture process completed!");
    console.log(`📁 Files saved to: ${OUTPUT_DIR}/`);
    
  } catch (error) {
    console.error("❌ Fatal error:", error.message);
  }
  
  await browser.close();
})();