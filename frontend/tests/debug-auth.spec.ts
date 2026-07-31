import { test } from '@playwright/test';

test('debug cookies', async ({ page, context }) => {
  const allCookies = await context.cookies();
  console.log('All cookies count:', allCookies.length);

  // Check cookies for specific URL
  const urlCookies = await context.cookies('http://localhost:3000');
  console.log('Cookies for localhost:3000 count:', urlCookies.length);
  for (const c of urlCookies) {
    console.log(`  URL Cookie: ${c.name}`);
  }

  // Intercept the request to see what Cookie header is sent
  let sentCookieHeader = '';
  await page.route('**/*', (route) => {
    const headers = route.request().headers();
    if (!sentCookieHeader && headers.cookie) {
      sentCookieHeader = headers.cookie;
      console.log('Cookie header sent with request:', headers.cookie.substring(0, 100));
    }
    route.continue();
  });

  await page.goto('/chat-rag');
  await page.waitForLoadState('networkidle');
  console.log('After goto /chat-rag, URL is:', page.url());
  console.log('Cookie header was sent:', sentCookieHeader ? 'YES' : 'NO');
});
