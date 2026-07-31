import { test, expect } from '@playwright/test';

test('authenticated feedback submission', async ({ page }) => {
  const errors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`[ERROR] ${msg.text()}`);
    }
  });

  page.on('response', response => {
    if (!response.ok() && response.url().includes('/api/')) {
      const status = response.status();
      const url = response.url();
      console.log(`[${status}] ${url}`);
      if (status >= 500) {
        errors.push(`Server error ${status} on ${url}`);
      }
    }
  });

  // Load auth file if it exists
  const authFile = '/Users/meganharrison/Documents/alleato-pm/tests/.auth/user.json';
  console.log('Auth file exists:', require('fs').existsSync(authFile));

  console.log('\n=== Test Start ===');

  // Go to login page
  console.log('Step 1: Navigate to login');
  await page.goto('http://localhost:3001/auth/login', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: '/tmp/login_page.png' });

  // Check if we see login form
  const loginInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  const hasLoginForm = await loginInput.isVisible().catch(() => false);
  console.log('Login form visible:', hasLoginForm);

  if (hasLoginForm) {
    console.log('Step 2: Enter credentials');
    // Use test credentials from CLAUDE.md: test1@mail.com / test12026!!!
    await loginInput.fill('test1@mail.com');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('test12026!!!');

    const submitButton = page.locator('button[type="submit"], button:has-text("Sign")').first();
    await submitButton.click();

    console.log('Step 3: Wait for redirect after login');
    await page.waitForURL(/\/|\/67/, { timeout: 10000 }).catch(e => console.log('URL wait failed:', e.message));
    await page.waitForLoadState('networkidle');

    console.log('Current URL after login:', page.url());
    await page.screenshot({ path: '/tmp/after_login.png' });
  }

  // Now navigate to a page where feedback should be available
  console.log('Step 4: Navigate to budget page');
  await page.goto('http://localhost:3001/67/budget', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  console.log('Step 5: Look for feedback widget');

  // Check console for any errors specific to feedback
  const feedbackFunctions = page.locator('script').count();
  console.log('Scripts on page:', feedbackFunctions);

  await page.screenshot({ path: '/tmp/budget_after_auth.png' });

  if (errors.length > 0) {
    console.log('\n=== Errors Found ===');
    errors.forEach(err => console.log('  -', err));
  }

  console.log('=== Test Complete ===');
});
