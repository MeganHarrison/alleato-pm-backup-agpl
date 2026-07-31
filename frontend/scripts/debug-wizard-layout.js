const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to wizard...');
    await page.goto('http://localhost:3001/1/setup');
    await page.waitForTimeout(3000);
    
    // Check the actual DOM structure
    const bodyClasses = await page.evaluate(() => document.body.className);
    console.log('Body classes:', bodyClasses);
    
    // Check if wizard is rendered but hidden
    const wizardElement = await page.locator('.container').first();
    const isVisible = await wizardElement.isVisible();
    console.log('Container visible:', isVisible);
    
    // Get the bounding box of main elements
    const mainBounds = await page.locator('main').boundingBox();
    console.log('Main element bounds:', mainBounds);
    
    // Check for overlapping elements
    const sidebarBounds = await page.locator('[data-slot="sidebar"]').boundingBox();
    console.log('Sidebar bounds:', sidebarBounds);
    
    // Scroll to see if content is below fold
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/wizard-scrolled-debug.png', 
      fullPage: true 
    });
    
    // Try to click on first step if visible
    const firstStep = page.locator('nav button').first();
    if (await firstStep.isVisible()) {
      console.log('First step is visible, clicking it...');
      await firstStep.click();
      await page.waitForTimeout(2000);
    }
    
    // Get computed styles of wizard container
    const containerStyles = await page.locator('.container').first().evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        display: styles.display,
        visibility: styles.visibility,
        marginTop: styles.marginTop,
        position: styles.position
      };
    });
    console.log('Container styles:', containerStyles);
    
    console.log('Debug complete. Browser remains open...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();