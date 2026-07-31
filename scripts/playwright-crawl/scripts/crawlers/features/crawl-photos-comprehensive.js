import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./playwright-procore-crawl/procore-crawls/photos/crawl-photos";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URLs - Photos specific
const START_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/photos";
const PROJECT_ID = "562949954728542";
const COMPANY_ID = "562949953443325";

// Procore credentials
const PROCORE_EMAIL = "bclymer@alleatogroup.com";
const PROCORE_PASSWORD = "Clymer926!";

// Check if URL is relevant to photos feature
function isRelevantUrl(url) {
  const lowerUrl = url.toLowerCase();

  // Must be on procore.com
  if (!url.includes('procore.com')) return false;

  // Exclude external links, auth pages, help pages
  if (url.includes('login.procore.com')) return false;
  if (url.includes('support.procore.com')) return false;
  if (url.includes('help.procore.com')) return false;
  if (url.includes('javascript:')) return false;
  if (url.includes('#') && url.indexOf('#') === url.length - 1) return false;

  // Include photos related pages
  if (lowerUrl.includes('photos')) return true;
  if (lowerUrl.includes('photo')) return true;
  if (lowerUrl.includes('image')) return true;
  if (lowerUrl.includes('album')) return true;
  if (lowerUrl.includes('gallery')) return true;

  // Include project pages that might contain photo entries
  if (url.includes(PROJECT_ID) && (
    lowerUrl.includes('media') ||
    lowerUrl.includes('upload') ||
    lowerUrl.includes('attach') ||
    lowerUrl.includes('picture') ||
    lowerUrl.includes('snap') ||
    lowerUrl.includes('capture')
  )) return true;

  // Include configuration and settings pages for photos
  if (url.includes('configuration') && url.includes(PROJECT_ID)) return true;
  if (url.includes('settings') && url.includes(PROJECT_ID)) return true;

  return false;
}

// Create directories
[OUTPUT_DIR, SCREENSHOT_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Store all page information for sitemap generation
const siteMap = [];
const visitedUrls = new Set();
const urlQueue = [];

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .substring(0, 150);
}

function generatePageId(url, name) {
  const sanitized = sanitizeFilename(name || url);
  return sanitized || "unknown_page";
}

// Enhanced page analysis for Photos
async function analyzePageStructure(page) {
  return await page.evaluate(() => {
    // Analyze UI components
    const components = {
      buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn').length,
      forms: document.querySelectorAll('form').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
      tables: document.querySelectorAll('table').length,
      modals: document.querySelectorAll('.modal, .dialog, .popup, [role="dialog"]').length,
      navigation: document.querySelectorAll('nav, .nav, .navigation, [role="navigation"]').length,
      cards: document.querySelectorAll('.card, .panel, .widget').length,
      lists: document.querySelectorAll('ul, ol').length,
      tabs: document.querySelectorAll('[role="tab"], .tab, .tabs li').length,
      dropdowns: document.querySelectorAll('select, .dropdown').length,
      icons: document.querySelectorAll('i[class*="icon"], .icon, svg').length,
      // Photos specific components
      imageElements: document.querySelectorAll('img, [class*="image"], [class*="photo"]').length,
      thumbnails: document.querySelectorAll('[class*="thumbnail"], [class*="thumb"]').length,
      galleries: document.querySelectorAll('[class*="gallery"], [class*="grid"]').length,
      albums: document.querySelectorAll('[class*="album"], [class*="folder"]').length,
      uploadButtons: document.querySelectorAll('[class*="upload"], input[type="file"]').length,
      lightboxes: document.querySelectorAll('[class*="lightbox"], [class*="modal-image"]').length,
      mediaPlayers: document.querySelectorAll('video, [class*="video"]').length
    };

    // Analyze tables
    const tables = Array.from(document.querySelectorAll('table')).map((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = table.querySelectorAll('tbody tr').length;
      return {
        index: index + 1,
        headers,
        rows,
        classes: table.className,
        id: table.id || null
      };
    });

    // Analyze forms (important for photo upload forms)
    const forms = Array.from(document.querySelectorAll('form')).map((form, index) => {
      const fields = Array.from(form.querySelectorAll('input, textarea, select')).map(field => ({
        name: field.name || field.id,
        type: field.type || field.tagName.toLowerCase(),
        placeholder: field.placeholder || null,
        required: field.required
      }));
      return {
        index: index + 1,
        action: form.action,
        method: form.method,
        fields,
        classes: form.className
      };
    });

    // Look for photos specific sections
    const photosSections = [];
    const sectionSelectors = [
      '[class*="photo"]',
      '[class*="image"]',
      '[class*="gallery"]',
      '[class*="album"]',
      '[class*="upload"]',
      '[class*="thumbnail"]',
      '[class*="grid"]',
      '[class*="media"]',
      '[data-section]',
      '.photo-section',
      '.media-section'
    ];

    sectionSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        photosSections.push({
          selector: sel,
          text: el.textContent.trim().substring(0, 100),
          classes: el.className
        });
      });
    });

    // Count actual images on page
    const imageCount = document.querySelectorAll('img').length;
    const backgroundImages = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.backgroundImage && style.backgroundImage !== 'none';
    }).length;

    return {
      components,
      tables,
      forms,
      photosSections,
      imageCount,
      backgroundImages,
      title: document.title,
      h1: document.querySelector('h1')?.textContent.trim() || null,
      h2s: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim())
    };
  });
}

// Extract all clickable elements and links
async function extractLinks(page, currentUrl) {
  return await page.evaluate((baseUrl) => {
    const links = [];
    const clickables = [];

    // Extract all anchor links
    document.querySelectorAll('a[href]').forEach((link, index) => {
      const href = link.href;
      const text = link.textContent.trim();
      const isExternal = !href.includes('procore.com');

      if (!isExternal && href !== baseUrl && !href.includes('javascript:') && !href.includes('#')) {
        links.push({
          href,
          text,
          classes: link.className,
          id: link.id || null,
          index
        });
      }
    });

    // Extract clickable buttons and elements
    document.querySelectorAll('button, [role="button"], .btn, [onclick]').forEach((el, index) => {
      const text = el.textContent.trim();
      const id = el.id || el.className;

      clickables.push({
        text,
        id,
        type: el.tagName.toLowerCase(),
        classes: el.className,
        hasDropdown: el.querySelector('[class*="dropdown"], [class*="menu"]') !== null,
        index
      });
    });

    // Extract dropdown menus and three-dot menus
    const dropdowns = [];
    document.querySelectorAll('[class*="dropdown"], [class*="menu"], [class*="more"], [aria-haspopup]').forEach((el, index) => {
      dropdowns.push({
        text: el.textContent.trim().substring(0, 50),
        classes: el.className,
        id: el.id || null,
        hasMenu: el.querySelector('ul, [role="menu"]') !== null,
        index
      });
    });

    // Extract tabs (photos may have tabs for different views)
    const tabs = [];
    document.querySelectorAll('[role="tab"], .tab, [class*="tab-"]').forEach((el, index) => {
      tabs.push({
        text: el.textContent.trim(),
        isActive: el.classList.contains('active') || el.getAttribute('aria-selected') === 'true',
        classes: el.className,
        index
      });
    });

    // Extract photo/image items for potential detail views
    const photoItems = [];
    document.querySelectorAll('[class*="photo-item"], [class*="image-item"], [class*="thumbnail"], [data-photo-id]').forEach((el, index) => {
      photoItems.push({
        classes: el.className,
        dataId: el.dataset.photoId || el.dataset.id || null,
        hasImage: el.querySelector('img') !== null,
        index
      });
    });

    return { links, clickables, dropdowns, tabs, photoItems };
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "photos") {
  try {
    console.log(`\n  Capturing: ${pageName}`);
    console.log(`   URL: ${url}`);

    // Navigate to page
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(WAIT_TIME);

    // Create page directory
    const pageId = generatePageId(url, pageName);
    const pageDir = path.join(SCREENSHOT_DIR, pageId);
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

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

    // Analyze page structure
    const analysis = await analyzePageStructure(page);

    // Extract all links and clickables
    const { links, clickables, dropdowns, tabs, photoItems } = await extractLinks(page, url);

    // Save metadata
    const metadata = {
      url,
      pageName,
      category,
      pageId,
      timestamp: new Date().toISOString(),
      analysis,
      links: links.length,
      linkDetails: links,
      clickables: clickables.length,
      clickableDetails: clickables,
      dropdowns: dropdowns.length,
      dropdownDetails: dropdowns,
      tabs: tabs.length,
      tabDetails: tabs,
      photoItems: photoItems.length,
      photoItemDetails: photoItems,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    siteMap.push(metadata);
    console.log(`   [OK] Captured: ${links.length} links, ${clickables.length} clickables, ${dropdowns.length} dropdowns, ${tabs.length} tabs, ${photoItems.length} photo items`);

    // Add new relevant links to queue
    links.forEach(link => {
      if (!visitedUrls.has(link.href) && !urlQueue.includes(link.href) && isRelevantUrl(link.href)) {
        urlQueue.push(link.href);
      }
    });

    return { metadata, links, clickables, dropdowns, tabs, photoItems };
  } catch (error) {
    console.error(`   [ERROR] Error capturing ${pageName}:`, error.message);
    return null;
  }
}

// Click and capture dropdown/menu items
async function captureDropdowns(page, pageUrl, pageName) {
  console.log(`\n   Looking for dropdowns and menus on: ${pageName}`);

  try {
    // Look for three-dot menus, settings, and dropdown triggers
    const dropdownSelectors = [
      '[data-test-id*="more"]',
      '[class*="more-options"]',
      '[class*="kebab"]',
      '[class*="three-dot"]',
      'button[aria-label*="more"]',
      'button[aria-label*="options"]',
      'button[aria-label*="settings"]',
      'button[aria-haspopup="menu"]',
      '[class*="dropdown-toggle"]',
      'button:has(svg[class*="dots"])',
      'button:has([class*="icon-more"])'
    ];

    for (const selector of dropdownSelectors) {
      const elements = await page.$$(selector);

      for (let i = 0; i < elements.length; i++) {
        try {
          const element = elements[i];
          const text = await element.textContent();
          const isVisible = await element.isVisible();

          if (!isVisible) continue;

          console.log(`   Found dropdown trigger: "${text?.trim() || 'unlabeled'}"`);

          // Click to open dropdown
          await element.click();
          await page.waitForTimeout(1000);

          // Capture the opened dropdown
          const dropdownPageId = generatePageId(pageUrl, `${pageName}_dropdown_${i}`);
          const dropdownDir = path.join(SCREENSHOT_DIR, dropdownPageId);
          if (!fs.existsSync(dropdownDir)) {
            fs.mkdirSync(dropdownDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(dropdownDir, "screenshot.png"),
            fullPage: true
          });

          // Extract menu items
          const menuItems = await page.evaluate(() => {
            const items = [];
            // Look for visible menu items
            const menuSelectors = [
              '[role="menu"] a',
              '[role="menu"] button',
              '.dropdown-menu a',
              '.dropdown-menu button',
              '[class*="menu-item"]',
              'ul[class*="dropdown"] a',
              'ul[class*="menu"] a'
            ];

            menuSelectors.forEach(sel => {
              document.querySelectorAll(sel).forEach(item => {
                const rect = item.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  items.push({
                    text: item.textContent.trim(),
                    href: item.href || null,
                    type: item.tagName.toLowerCase()
                  });
                }
              });
            });

            return items;
          });

          console.log(`   Found ${menuItems.length} menu items`);

          // Save dropdown metadata
          fs.writeFileSync(
            path.join(dropdownDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              dropdownIndex: i,
              menuItems,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          // Click each menu item and capture if it's a link
          for (let j = 0; j < menuItems.length; j++) {
            const menuItem = menuItems[j];
            if (menuItem.href && !visitedUrls.has(menuItem.href)) {
              urlQueue.push(menuItem.href);
            }
          }

          // Close dropdown (click outside or press escape)
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

        } catch (err) {
          console.error(`   [WARN] Error with dropdown ${i}:`, err.message);
          // Try to recover by pressing Escape
          await page.keyboard.press('Escape');
        }
      }
    }
  } catch (error) {
    console.error(`   [ERROR] Error capturing dropdowns:`, error.message);
  }
}

// Click and capture tabs
async function captureTabs(page, pageUrl, pageName) {
  console.log(`\n   Looking for tabs on: ${pageName}`);

  try {
    const tabSelectors = [
      '[role="tab"]',
      '.tab',
      '[class*="tab-item"]',
      '[data-tab]',
      '.nav-tabs a',
      '.tabs-list button'
    ];

    for (const selector of tabSelectors) {
      const tabs = await page.$$(selector);

      for (let i = 0; i < tabs.length; i++) {
        try {
          const tab = tabs[i];
          const text = await tab.textContent();
          const isVisible = await tab.isVisible();

          if (!isVisible) continue;

          console.log(`   Found tab: "${text?.trim() || 'unlabeled'}"`);

          // Click the tab
          await tab.click();
          await page.waitForTimeout(1500);

          // Capture the tab content
          const tabPageId = generatePageId(pageUrl, `${pageName}_tab_${sanitizeFilename(text || String(i))}`);
          const tabDir = path.join(SCREENSHOT_DIR, tabPageId);
          if (!fs.existsSync(tabDir)) {
            fs.mkdirSync(tabDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(tabDir, "screenshot.png"),
            fullPage: true
          });

          // Save tab metadata
          fs.writeFileSync(
            path.join(tabDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              tabName: text?.trim(),
              tabIndex: i,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   [OK] Captured tab content`);

        } catch (err) {
          console.error(`   [WARN] Error with tab ${i}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error(`   [ERROR] Error capturing tabs:`, error.message);
  }
}

// Capture photo viewer / lightbox interactions
async function capturePhotoViewer(page, pageUrl, pageName) {
  console.log(`\n   Looking for photo thumbnails to open: ${pageName}`);

  try {
    const photoSelectors = [
      '[class*="thumbnail"] img',
      '[class*="photo-item"] img',
      '[class*="image-item"] img',
      '[data-photo-id]',
      '[class*="gallery"] img',
      '.photo-grid img'
    ];

    let capturedCount = 0;
    const maxToCapture = 3; // Limit to first 3 photos for detail view

    for (const selector of photoSelectors) {
      if (capturedCount >= maxToCapture) break;

      const photos = await page.$$(selector);

      for (let i = 0; i < Math.min(photos.length, maxToCapture - capturedCount); i++) {
        try {
          const photo = photos[i];
          const isVisible = await photo.isVisible();

          if (!isVisible) continue;

          console.log(`   Found photo thumbnail ${i + 1}`);

          // Click to open photo viewer
          await photo.click();
          await page.waitForTimeout(2000);

          // Capture the photo viewer/lightbox
          const viewerPageId = generatePageId(pageUrl, `${pageName}_photo_viewer_${i}`);
          const viewerDir = path.join(SCREENSHOT_DIR, viewerPageId);
          if (!fs.existsSync(viewerDir)) {
            fs.mkdirSync(viewerDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(viewerDir, "screenshot.png"),
            fullPage: true
          });

          // Look for photo details/metadata in the viewer
          const photoDetails = await page.evaluate(() => {
            const details = {};

            // Look for common photo metadata elements
            const titleEl = document.querySelector('[class*="photo-title"], [class*="image-title"], h1, h2');
            if (titleEl) details.title = titleEl.textContent.trim();

            const descEl = document.querySelector('[class*="description"], [class*="caption"]');
            if (descEl) details.description = descEl.textContent.trim();

            const dateEl = document.querySelector('[class*="date"], [class*="timestamp"], time');
            if (dateEl) details.date = dateEl.textContent.trim();

            const locationEl = document.querySelector('[class*="location"]');
            if (locationEl) details.location = locationEl.textContent.trim();

            const tagsEl = document.querySelectorAll('[class*="tag"]');
            details.tags = Array.from(tagsEl).map(t => t.textContent.trim());

            // Check for navigation arrows
            details.hasNavigation = document.querySelector('[class*="next"], [class*="prev"], [aria-label*="next"], [aria-label*="prev"]') !== null;

            // Check for edit/delete buttons
            details.hasEditButton = document.querySelector('[class*="edit"], button:has-text("Edit")') !== null;
            details.hasDeleteButton = document.querySelector('[class*="delete"], button:has-text("Delete")') !== null;

            return details;
          });

          fs.writeFileSync(
            path.join(viewerDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              photoIndex: i,
              photoDetails,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   [OK] Captured photo viewer`);
          capturedCount++;

          // Close photo viewer
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);

        } catch (err) {
          console.error(`   [WARN] Error with photo ${i}:`, err.message);
          await page.keyboard.press('Escape');
        }
      }
    }
  } catch (error) {
    console.error(`   [ERROR] Error capturing photo viewer:`, error.message);
  }
}

// Capture "Upload" or "Add Photo" dialogs
async function captureUploadDialogs(page, pageUrl, pageName) {
  console.log(`\n   Looking for Upload/Add buttons on: ${pageName}`);

  try {
    const uploadSelectors = [
      'button:has-text("Upload")',
      'button:has-text("Add Photo")',
      'button:has-text("Add")',
      'button:has-text("New")',
      '[data-test-id*="upload"]',
      '[data-test-id*="add"]',
      '[aria-label*="Upload"]',
      '[aria-label*="Add"]',
      '[class*="upload-button"]',
      '[class*="add-button"]',
      '[class*="create-album"]'
    ];

    for (const selector of uploadSelectors) {
      try {
        const elements = await page.$$(selector);

        for (let i = 0; i < Math.min(elements.length, 2); i++) {
          const element = elements[i];
          const text = await element.textContent();
          const isVisible = await element.isVisible();

          if (!isVisible) continue;

          console.log(`   Found upload button: "${text?.trim()}"`);

          // Click to open upload dialog
          await element.click();
          await page.waitForTimeout(2000);

          // Capture the dialog
          const dialogPageId = generatePageId(pageUrl, `${pageName}_upload_dialog_${i}`);
          const dialogDir = path.join(SCREENSHOT_DIR, dialogPageId);
          if (!fs.existsSync(dialogDir)) {
            fs.mkdirSync(dialogDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(dialogDir, "screenshot.png"),
            fullPage: true
          });

          // Analyze form fields in the dialog
          const formFields = await page.evaluate(() => {
            const fields = [];
            document.querySelectorAll('[role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select, .modal input, .modal textarea, .modal select').forEach(field => {
              fields.push({
                name: field.name || field.id,
                type: field.type || field.tagName.toLowerCase(),
                placeholder: field.placeholder || null,
                required: field.required,
                label: document.querySelector(`label[for="${field.id}"]`)?.textContent.trim() || null
              });
            });
            return fields;
          });

          // Look for upload-specific elements
          const uploadFeatures = await page.evaluate(() => {
            return {
              hasDropZone: document.querySelector('[class*="drop"], [class*="dropzone"]') !== null,
              hasFileInput: document.querySelector('input[type="file"]') !== null,
              hasAlbumSelector: document.querySelector('[class*="album"], select') !== null,
              hasTitleField: document.querySelector('input[name*="title"], input[placeholder*="title"]') !== null,
              hasDescriptionField: document.querySelector('textarea[name*="description"], textarea[placeholder*="description"]') !== null,
              hasDateField: document.querySelector('input[type="date"], [class*="date"]') !== null,
              hasLocationField: document.querySelector('[class*="location"]') !== null,
              hasTagsField: document.querySelector('[class*="tag"]') !== null
            };
          });

          fs.writeFileSync(
            path.join(dialogDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              buttonText: text?.trim(),
              dialogIndex: i,
              formFields,
              uploadFeatures,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   [OK] Captured upload dialog with ${formFields.length} form fields`);

          // Close dialog
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
      } catch (err) {
        console.error(`   [WARN] Error with selector ${selector}:`, err.message);
        await page.keyboard.press('Escape');
      }
    }
  } catch (error) {
    console.error(`   [ERROR] Error capturing upload dialogs:`, error.message);
  }
}

// Capture album/folder views
async function captureAlbums(page, pageUrl, pageName) {
  console.log(`\n   Looking for albums/folders on: ${pageName}`);

  try {
    const albumSelectors = [
      '[class*="album"]',
      '[class*="folder"]',
      '[data-album-id]',
      '[class*="category"]'
    ];

    let capturedCount = 0;
    const maxToCapture = 5;

    for (const selector of albumSelectors) {
      if (capturedCount >= maxToCapture) break;

      const albums = await page.$$(selector);

      for (let i = 0; i < Math.min(albums.length, maxToCapture - capturedCount); i++) {
        try {
          const album = albums[i];
          const text = await album.textContent();
          const isVisible = await album.isVisible();
          const isClickable = await album.evaluate(el => {
            return el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button';
          });

          if (!isVisible || !isClickable) continue;

          console.log(`   Found album: "${text?.trim().substring(0, 30)}"`);

          // Click to open album
          await album.click();
          await page.waitForTimeout(2000);

          // Capture the album content
          const albumPageId = generatePageId(pageUrl, `${pageName}_album_${sanitizeFilename(text || String(i))}`);
          const albumDir = path.join(SCREENSHOT_DIR, albumPageId);
          if (!fs.existsSync(albumDir)) {
            fs.mkdirSync(albumDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(albumDir, "screenshot.png"),
            fullPage: true
          });

          // Count photos in album
          const albumInfo = await page.evaluate(() => {
            return {
              photoCount: document.querySelectorAll('[class*="photo"], [class*="image"], [class*="thumbnail"]').length,
              title: document.querySelector('h1, h2, [class*="title"]')?.textContent.trim(),
              hasSubAlbums: document.querySelectorAll('[class*="album"], [class*="folder"]').length > 1
            };
          });

          fs.writeFileSync(
            path.join(albumDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              albumName: text?.trim(),
              albumIndex: i,
              albumInfo,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   [OK] Captured album with ${albumInfo.photoCount} photos`);
          capturedCount++;

          // Go back to main page
          await page.goBack();
          await page.waitForTimeout(1500);

        } catch (err) {
          console.error(`   [WARN] Error with album ${i}:`, err.message);
          // Try to go back
          try {
            await page.goBack();
            await page.waitForTimeout(1000);
          } catch (e) {
            // Ignore
          }
        }
      }
    }
  } catch (error) {
    console.error(`   [ERROR] Error capturing albums:`, error.message);
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n   Generating comprehensive report...');

  // Generate sitemap table
  let tableContent = `# Procore Photos Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `## Summary Statistics\n\n`;
  tableContent += `| Metric | Count |\n`;
  tableContent += `|--------|-------|\n`;
  tableContent += `| Total Pages | ${siteMap.length} |\n`;
  tableContent += `| Total Links | ${siteMap.reduce((sum, page) => sum + page.links, 0)} |\n`;
  tableContent += `| Total Clickables | ${siteMap.reduce((sum, page) => sum + page.clickables, 0)} |\n`;
  tableContent += `| Total Dropdowns | ${siteMap.reduce((sum, page) => sum + page.dropdowns, 0)} |\n`;
  tableContent += `| Total Tabs | ${siteMap.reduce((sum, page) => sum + (page.tabs || 0), 0)} |\n`;
  tableContent += `| Total Photo Items | ${siteMap.reduce((sum, page) => sum + (page.photoItems || 0), 0)} |\n\n`;

  tableContent += `## Page Details\n\n`;
  tableContent += `| Page Name | Category | Links | Clickables | Dropdowns | Tabs | Photo Items | Screenshot |\n`;
  tableContent += `|-----------|----------|-------|------------|-----------|------|-------------|------------|\n`;

  siteMap.forEach(page => {
    const relPath = page.screenshotPath.replace(/\\/g, '/');
    tableContent += `| ${page.pageName} | ${page.category} | ${page.links} | ${page.clickables} | ${page.dropdowns} | ${page.tabs || 0} | ${page.photoItems || 0} | [View](../${relPath}) |\n`;
  });

  fs.writeFileSync(
    path.join(REPORTS_DIR, "sitemap-table.md"),
    tableContent
  );

  // Generate detailed JSON
  fs.writeFileSync(
    path.join(REPORTS_DIR, "detailed-report.json"),
    JSON.stringify(siteMap, null, 2)
  );

  // Generate link graph
  const linkGraph = {
    totalPages: siteMap.length,
    totalLinks: siteMap.reduce((sum, page) => sum + page.links, 0),
    totalClickables: siteMap.reduce((sum, page) => sum + page.clickables, 0),
    totalDropdowns: siteMap.reduce((sum, page) => sum + page.dropdowns, 0),
    totalTabs: siteMap.reduce((sum, page) => sum + (page.tabs || 0), 0),
    totalPhotoItems: siteMap.reduce((sum, page) => sum + (page.photoItems || 0), 0),
    pages: siteMap.map(page => ({
      name: page.pageName,
      url: page.url,
      outgoingLinks: page.linkDetails.map(l => l.href)
    }))
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "link-graph.json"),
    JSON.stringify(linkGraph, null, 2)
  );

  // Generate summary for photos specific features
  const photosSummary = {
    generated: new Date().toISOString(),
    feature: "Photos",
    startUrl: START_URL,
    projectId: PROJECT_ID,
    companyId: COMPANY_ID,
    statistics: {
      pagesCaptured: siteMap.length,
      totalLinks: linkGraph.totalLinks,
      totalClickables: linkGraph.totalClickables,
      totalDropdowns: linkGraph.totalDropdowns,
      totalTabs: linkGraph.totalTabs,
      totalPhotoItems: linkGraph.totalPhotoItems
    },
    pagesWithForms: siteMap.filter(p => p.analysis?.forms?.length > 0).length,
    pagesWithTables: siteMap.filter(p => p.analysis?.tables?.length > 0).length,
    pagesWithImages: siteMap.filter(p => (p.analysis?.imageCount || 0) > 0).length,
    totalImagesFound: siteMap.reduce((sum, p) => sum + (p.analysis?.imageCount || 0), 0),
    uniqueFormFields: [...new Set(
      siteMap.flatMap(p => p.analysis?.forms?.flatMap(f => f.fields?.map(field => field.name)) || [])
    )].filter(Boolean),
    tableHeaders: [...new Set(
      siteMap.flatMap(p => p.analysis?.tables?.flatMap(t => t.headers) || [])
    )].filter(Boolean)
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "photos-summary.json"),
    JSON.stringify(photosSummary, null, 2)
  );

  console.log('[OK] Reports generated in:', REPORTS_DIR);
}

// Main crawler
async function crawlPhotos() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('Logging into Procore...');

    // Login
    await page.goto('https://login.procore.com/');
    await page.waitForTimeout(2000);

    await page.fill('input[type="email"]', PROCORE_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.fill('input[type="password"]', PROCORE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    console.log('[OK] Logged in successfully');

    // Start with the main photos page
    urlQueue.push(START_URL);

    let pageCount = 0;
    const maxPages = 50; // Safety limit

    while (urlQueue.length > 0 && pageCount < maxPages) {
      const currentUrl = urlQueue.shift();

      if (visitedUrls.has(currentUrl)) {
        continue;
      }

      visitedUrls.add(currentUrl);
      pageCount++;

      // Determine page name from URL
      const urlParts = currentUrl.split('/');
      const pageName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'unknown';

      // Capture the page
      const result = await capturePage(page, currentUrl, pageName, 'photos');

      if (result) {
        // Look for and capture tabs first
        await captureTabs(page, currentUrl, pageName);

        // Look for and capture dropdowns
        await captureDropdowns(page, currentUrl, pageName);

        // Look for and capture photo viewer/lightbox
        await capturePhotoViewer(page, currentUrl, pageName);

        // Look for and capture upload dialogs
        await captureUploadDialogs(page, currentUrl, pageName);

        // Look for and capture albums
        await captureAlbums(page, currentUrl, pageName);
      }

      console.log(`\n   Progress: ${pageCount}/${maxPages} pages captured, ${urlQueue.length} in queue`);
    }

    // Generate final report
    generateReport();

    console.log('\n[OK] Crawl complete!');
    console.log(`   Output directory: ${OUTPUT_DIR}`);
    console.log(`   Total pages captured: ${siteMap.length}`);

  } catch (error) {
    console.error('[ERROR] Fatal error:', error);
  } finally {
    await browser.close();
  }
}

// Run the crawler
crawlPhotos().catch(console.error);
