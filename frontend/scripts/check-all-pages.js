const { chromium } = require('playwright');

const routes = [
  '/',
  '/stats',
  '/dashboard',
  '/14/home',
  '/budget',
  '/contracts',
  '/commitments',
  '/meetings',
  '/tasks',
  '/team-chat',
  '/drawings',
  '/photos',
  '/directory/companies',
  '/create-project',
];

async function checkAllPages() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = [];
  
  // Skip login for now - check pages directly
  console.log('🚀 Starting page checks...');
  
  for (const route of routes) {
    console.log(`\n📄 Checking ${route}...`);
    const errors = [];
    
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push({ type: 'console', message: msg.text() });
      }
    });
    
    page.on('pageerror', (error) => {
      errors.push({ type: 'page', message: error.message });
    });
    
    try {
      await page.goto(`http://localhost:3004${route}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      
      await page.waitForTimeout(2000);
      
      // Check for common error indicators
      const hasErrors = await page.evaluate(() => {
        const body = document.body.innerText;
        return {
          has404: body.includes('404'),
          hasError: body.includes('Error:') || body.includes('TypeError:'),
          hasQueryClient: body.includes('No QueryClient'),
          hasHydration: body.includes('Hydration'),
          hasChunkLoad: body.includes('ChunkLoadError'),
        };
      });
      
      results.push({
        route,
        errors,
        pageErrors: hasErrors,
        status: errors.length === 0 && !Object.values(hasErrors).some(v => v) ? '✅' : '❌'
      });
      
    } catch (e) {
      results.push({
        route,
        errors: [{ type: 'navigation', message: e.message }],
        status: '❌'
      });
    }
    
    // Remove listeners
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  }
  
  // Print summary
  console.log('\n\n📊 SUMMARY REPORT\n' + '='.repeat(50));
  
  const failedRoutes = results.filter(r => r.status === '❌');
  
  if (failedRoutes.length === 0) {
    console.log('✅ All pages loaded successfully!');
  } else {
    console.log(`❌ ${failedRoutes.length} pages have errors:\n`);
    
    failedRoutes.forEach(({ route, errors, pageErrors }) => {
      console.log(`\n${route}:`);
      errors.forEach(e => console.log(`  - ${e.type}: ${e.message}`));
      if (pageErrors) {
        Object.entries(pageErrors).forEach(([key, value]) => {
          if (value) console.log(`  - ${key}: true`);
        });
      }
    });
  }
  
  await browser.close();
}

checkAllPages().catch(console.error);