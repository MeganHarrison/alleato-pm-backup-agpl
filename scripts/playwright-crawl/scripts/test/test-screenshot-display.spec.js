const { test, expect } = require('@playwright/test');

test('verify screenshot displays in Prime Contracts page', async ({ page }) => {
  // Navigate to the viewer
  await page.goto('http://localhost:8080');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Click on Prime Contracts tab
  await page.click('[data-project="prime-contracts"]');
  await page.waitForTimeout(500);

  // Click on Prime Contracts Page file in sidebar
  const primeContractsLink = page.locator('a:has-text("Prime Contracts Page")');
  await primeContractsLink.click();

  // Wait for content to load
  await page.waitForTimeout(1000);

  // Check if the image is present in the DOM
  const image = page.locator('img[alt="Prime Contracts"]');
  await expect(image).toBeVisible({ timeout: 5000 });

  // Get the image src
  const imageSrc = await image.getAttribute('src');
  console.log('Image src attribute:', imageSrc);

  // Try to load the image and check if it returns 200
  const imageResponse = await page.goto(imageSrc);
  console.log('Image response status:', imageResponse.status());

  // Take a screenshot to see what's rendered
  await page.screenshot({
    path: '/Users/meganharrison/Documents/github/alleato-procore/scripts/screenshot-capture/test-result.png',
    fullPage: true
  });

  // Check the browser console for errors
  page.on('console', msg => console.log('Browser console:', msg.text()));

  // Expect the image to load successfully
  expect(imageResponse.status()).toBe(200);
});

test('check what path the viewer is using', async ({ page }) => {
  const logs = [];

  // Capture console logs
  page.on('console', msg => {
    logs.push(msg.text());
    console.log('Console:', msg.text());
  });

  // Navigate to the viewer
  await page.goto('http://localhost:8080');
  await page.waitForLoadState('networkidle');

  // Click on Prime Contracts tab
  await page.click('[data-project="prime-contracts"]');
  await page.waitForTimeout(500);

  // Click on Prime Contracts Page file
  const primeContractsLink = page.locator('a:has-text("Prime Contracts Page")');
  await primeContractsLink.click();

  await page.waitForTimeout(2000);

  // Check for the console log that shows path transformation
  const pathLog = logs.find(log => log.includes('Fixed image path'));
  console.log('Path transformation log:', pathLog);

  // Get all images and their sources
  const images = await page.$$eval('img', imgs =>
    imgs.map(img => ({
      alt: img.alt,
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    }))
  );

  console.log('All images found:', JSON.stringify(images, null, 2));
});
