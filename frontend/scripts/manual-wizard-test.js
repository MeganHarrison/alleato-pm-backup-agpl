const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // Run in headed mode to see what's happening
  const page = await browser.newPage();
  
  console.log('Starting manual wizard test...');
  
  try {
    // Navigate to wizard
    console.log('Navigating to http://localhost:3000/1/setup');
    await page.goto('http://localhost:3000/1/setup', { waitUntil: 'networkidle' });
    
    // Wait for page to fully load
    await page.waitForTimeout(5000);
    
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Take screenshot
    await page.screenshot({ 
      path: 'frontend/tests/screenshots/wizard-manual-headed.png', 
      fullPage: true 
    });
    
    // Check page content
    const bodyText = await page.locator('body').innerText();
    console.log('Page contains:', bodyText.substring(0, 200) + '...');
    
    // Keep browser open for manual inspection
    console.log('\nBrowser is open for manual inspection. Press Ctrl+C to close.');
    await new Promise(() => {}); // Keep running indefinitely
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ 
      path: 'frontend/tests/screenshots/wizard-error.png', 
      fullPage: true 
    });
  }
})();