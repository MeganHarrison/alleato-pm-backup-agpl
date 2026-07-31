const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture all console logs
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  // Log in using real auth form
  await page.goto('http://localhost:3002/auth/login');
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'testpassword123');
  await page.click('button:has-text("Login")');
  await page.waitForTimeout(2000);

  // Go to companies page
  await page.goto('http://localhost:3002/directory/companies');
  await page.waitForTimeout(3000);

  // Check what page title we have
  const title = await page.title();
  console.log('Page title:', title);

  // Check what the URL actually is
  const url = page.url();
  console.log('Actual URL:', url);

  // Check body text content
  const bodyText = await page.textContent('body');
  console.log('Body contains "Company Directory":', bodyText.includes('Company Directory'));
  console.log('Body contains "404":', bodyText.includes('404'));
  console.log('Body contains "Not Found":', bodyText.includes('Not Found'));

  // Log all console logs that contain "GLOBAL" or "PROJECT"
  const pageLoadLogs = logs.filter(log =>
    log.includes('GLOBAL') || log.includes('PROJECT') || log.includes('COMPANIES PAGE')
  );
  console.log('Page load logs:', pageLoadLogs);

  await browser.close();
})();
