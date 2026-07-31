#!/usr/bin/env node
const { chromium } = require('playwright')

async function takeScreenshot() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    console.log('Loading http://localhost:3000 ...')
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.screenshot({ path: 'homepage-check.png' })
    console.log('Homepage screenshot saved')
    
    console.log('Loading http://localhost:3000/14/home ...')  
    await page.goto('http://localhost:3000/14/home', { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.screenshot({ path: 'project-home-check.png' })
    console.log('Project home screenshot saved')
    
  } catch (err) {
    console.error('Error:', err.message)
    await page.screenshot({ path: 'error-state.png' })
  } finally {
    await browser.close()
  }
}

takeScreenshot()