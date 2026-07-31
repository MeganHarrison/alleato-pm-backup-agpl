const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const authFile = path.join(__dirname, 'tests/.auth/user.json');
  
  // Check if auth file exists
  if (!fs.existsSync(authFile)) {
    console.error('Auth file not found at:', authFile);
    console.error('Please run: npx playwright test tests/auth.setup.ts');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: authFile
  });
  
  const page = await context.newPage();

  const pages = [
    { url: 'http://localhost:3000/98/prime-contracts', name: 'prime-contracts' },
    { url: 'http://localhost:3000/98/commitments', name: 'commitments' },
    { url: 'http://localhost:3000/98/change-orders', name: 'change-orders' },
    { url: 'http://localhost:3000/98/change-events', name: 'change-events' },
    { url: 'http://localhost:3000/98/direct-costs', name: 'direct-costs' }
  ];

  for (const pageInfo of pages) {
    console.log(`Navigating to ${pageInfo.url}...`);
    await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const screenshotPath = `/tmp/${pageInfo.name}-screenshot.png`;
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`✓ Captured ${pageInfo.name} to ${screenshotPath}`);
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
})();
