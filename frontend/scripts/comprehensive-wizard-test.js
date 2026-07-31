const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== COMPREHENSIVE PROJECT SETUP WIZARD TEST ===\n');
  
  const testResults = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  try {
    // Navigate to wizard
    console.log('1. NAVIGATION TEST');
    await page.goto('http://localhost:3000/1/setup', { waitUntil: 'networkidle' });
    console.log('✓ Successfully navigated to wizard page');
    testResults.passed.push('Navigation to wizard page');
    
    // Test 1: UI Elements
    console.log('\n2. UI ELEMENTS TEST');
    
    // Header
    const h1 = await page.locator('h1').textContent();
    if (h1 === 'Project Setup') {
      console.log('✓ Header displays correctly:', h1);
      testResults.passed.push('Header display');
    } else {
      console.log('✗ Header incorrect:', h1);
      testResults.failed.push('Header display');
    }
    
    // Subtitle
    const subtitle = await page.locator('text=Complete the setup steps to configure your project').count();
    if (subtitle > 0) {
      console.log('✓ Subtitle displays correctly');
      testResults.passed.push('Subtitle display');
    }
    
    // Progress bar
    const progressBar = await page.locator('[role="progressbar"]').count();
    if (progressBar > 0) {
      console.log('✓ Progress bar present');
      testResults.passed.push('Progress bar');
    }
    
    // Step indicator
    const stepText = await page.locator('text=/Step \\d+ of \\d+/').textContent();
    console.log('✓ Step indicator:', stepText);
    testResults.passed.push('Step indicator');
    
    // All 5 steps in sidebar
    const steps = [
      'Cost Code Configuration',
      'Project Directory',
      'Document Upload',
      'Budget Setup',
      'Prime Contract'
    ];
    
    console.log('\n3. SIDEBAR NAVIGATION TEST');
    for (const step of steps) {
      const stepCount = await page.locator(`text="${step}"`).count();
      if (stepCount > 0) {
        console.log(`✓ Step "${step}" visible in sidebar`);
        testResults.passed.push(`Sidebar step: ${step}`);
      } else {
        console.log(`✗ Step "${step}" missing from sidebar`);
        testResults.failed.push(`Sidebar step: ${step}`);
      }
    }
    
    // Test Step 1: Cost Code Configuration
    console.log('\n4. COST CODE CONFIGURATION TEST');
    
    // Current step title
    const h2 = await page.locator('h2').textContent();
    if (h2 === 'Cost Code Configuration') {
      console.log('✓ Step 1 title correct:', h2);
      testResults.passed.push('Step 1 title');
    }
    
    // Import button
    const importBtn = await page.locator('button:has-text("Import Standard Codes")');
    if (await importBtn.isVisible()) {
      console.log('✓ Import Standard Codes button visible');
      testResults.passed.push('Import button visibility');
      
      // Click import button
      await importBtn.click();
      await page.waitForTimeout(3000);
      console.log('✓ Clicked Import Standard Codes');
      
      // Check if codes loaded
      const switches = await page.locator('[role="switch"]').count();
      console.log(`✓ Found ${switches} cost code switches after import`);
      if (switches > 0) {
        testResults.passed.push('Cost codes import');
      } else {
        testResults.warnings.push('No cost codes loaded after import');
      }
    }
    
    // Cost Code Types section
    const typesSection = await page.locator('text=Cost Code Types').isVisible();
    if (typesSection) {
      console.log('✓ Cost Code Types section visible');
      testResults.passed.push('Cost Code Types section');
      
      // Check for type codes
      const laborType = await page.locator('text=Labor').count();
      const materialsType = await page.locator('text=Materials').count();
      if (laborType > 0 && materialsType > 0) {
        console.log('✓ Cost code types display correctly');
        testResults.passed.push('Cost code types display');
      }
    }
    
    // Add Custom Code button
    const customBtn = await page.locator('button:has-text("Add Custom Code")').isVisible();
    if (customBtn) {
      console.log('✓ Add Custom Code button visible');
      testResults.passed.push('Add Custom Code button');
    }
    
    // Navigation buttons
    const skipBtn = await page.locator('button:has-text("Skip for now")').isVisible();
    const continueBtn = await page.locator('button:has-text("Continue")').isVisible();
    if (skipBtn && continueBtn) {
      console.log('✓ Navigation buttons present');
      testResults.passed.push('Navigation buttons');
    }
    
    // Test navigation
    console.log('\n5. STEP NAVIGATION TEST');
    
    // Select some cost codes to enable Continue
    if (await page.locator('[role="switch"]').count() > 0) {
      await page.locator('[role="switch"]').first().click();
      await page.locator('[role="switch"]').nth(1).click();
      console.log('✓ Selected cost codes');
      
      // Click Continue
      await page.locator('button:has-text("Continue")').click();
      await page.waitForTimeout(1000);
      
      // Check if we moved to step 2
      const newH2 = await page.locator('h2').textContent();
      if (newH2 === 'Project Directory') {
        console.log('✓ Successfully navigated to Step 2:', newH2);
        testResults.passed.push('Step navigation forward');
        
        // Check progress update
        const newStepText = await page.locator('text=/Step \\d+ of \\d+/').textContent();
        console.log('✓ Progress updated:', newStepText);
      }
      
      // Test backward navigation
      await page.locator('button:has-text("Cost Code Configuration")').click();
      await page.waitForTimeout(1000);
      const backH2 = await page.locator('h2').textContent();
      if (backH2 === 'Cost Code Configuration') {
        console.log('✓ Successfully navigated back to Step 1');
        testResults.passed.push('Step navigation backward');
      }
    }
    
    // Take screenshots of different states
    console.log('\n6. CAPTURING SCREENSHOTS');
    await page.screenshot({ 
      path: 'frontend/tests/screenshots/wizard-test-final-state.png', 
      fullPage: true 
    });
    console.log('✓ Final state screenshot captured');
    
    // Test responsive design
    console.log('\n7. RESPONSIVE DESIGN TEST');
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Check if main elements are still visible
      const h1Visible = await page.locator('h1').isVisible();
      const h2Visible = await page.locator('h2').isVisible();
      
      if (h1Visible && h2Visible) {
        console.log(`✓ ${viewport.name} view (${viewport.width}x${viewport.height}): Main elements visible`);
        testResults.passed.push(`Responsive: ${viewport.name}`);
      } else {
        console.log(`✗ ${viewport.name} view: Some elements not visible`);
        testResults.failed.push(`Responsive: ${viewport.name}`);
      }
      
      await page.screenshot({ 
        path: `frontend/tests/screenshots/wizard-${viewport.name.toLowerCase()}.png`, 
        fullPage: true 
      });
    }
    
    // Check for console errors
    console.log('\n8. CONSOLE ERROR CHECK');
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate through steps to trigger any errors
    await page.reload();
    await page.waitForTimeout(2000);
    
    if (consoleErrors.length === 0) {
      console.log('✓ No console errors detected');
      testResults.passed.push('No console errors');
    } else {
      console.log(`✗ Found ${consoleErrors.length} console errors`);
      consoleErrors.forEach(err => console.log('  -', err));
      testResults.failed.push('Console errors detected');
    }
    
  } catch (error) {
    console.error('\n✗ Test failed with error:', error);
    testResults.failed.push('Test execution error');
    await page.screenshot({ 
      path: 'frontend/tests/screenshots/wizard-test-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
    
    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`✓ Passed: ${testResults.passed.length} tests`);
    console.log(`✗ Failed: ${testResults.failed.length} tests`);
    console.log(`⚠ Warnings: ${testResults.warnings.length}`);
    
    if (testResults.failed.length > 0) {
      console.log('\nFailed tests:');
      testResults.failed.forEach(test => console.log(`  - ${test}`));
    }
    
    if (testResults.warnings.length > 0) {
      console.log('\nWarnings:');
      testResults.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    console.log('\nScreenshots saved in: frontend/tests/screenshots/');
  }
})();