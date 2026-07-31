#!/usr/bin/env node
const { chromium } = require('playwright')

async function verifyProjectHomePage() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  const errors = []
  
  // Monitor console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  
  // Monitor page errors
  page.on('pageerror', (err) => {
    errors.push(err.message)
  })
  
  try {
    console.log('Navigating to http://localhost:3000/14/home ...')
    await page.goto('http://localhost:3000/14/home', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    
    // Wait a bit for any lazy-loaded errors
    await page.waitForTimeout(3000)
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/project-home-manual-check.png',
      fullPage: true 
    })
    
    // Check page title
    const title = await page.title()
    console.log('Page title:', title)
    
    // Get page text
    const bodyText = await page.locator('body').textContent()
    console.log('Page loaded with', bodyText.length, 'characters of content')
    
    if (errors.length > 0) {
      console.error('\n❌ ERRORS FOUND:')
      errors.forEach(err => console.error(err))
      process.exit(1)
    } else {
      console.log('\n✅ Page loaded without errors!')
    }
    
  } catch (err) {
    console.error('\n❌ Failed to load page:', err.message)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

verifyProjectHomePage()