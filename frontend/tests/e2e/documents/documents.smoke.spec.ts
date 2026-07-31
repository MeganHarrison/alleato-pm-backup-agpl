import { test, expect } from '@playwright/test'

test.describe('Document Pipeline Management', () => {
  // Tests will use authenticated state by default from playwright config
  
  test('should display the document pipeline page', async ({ page }) => {
    // Navigate to the document pipeline page
    await page.goto('/admin/documents/pipeline')
    
    // Check page title
    await expect(page.getByRole('heading', { name: 'Document Pipeline Management' })).toBeVisible()
    
    // Check for phase cards
    await expect(page.getByText('Parse Documents')).toBeVisible()
    await expect(page.getByText('Generate Embeddings')).toBeVisible()
    await expect(page.getByText('Extract Insights')).toBeVisible()
    
    // Check for document table
    await expect(page.getByRole('table')).toBeVisible()
    
    // Check table headers
    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Pipeline Stage' })).toBeVisible()
    
    // Check for refresh button
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
    
    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/document-pipeline-page.png',
      fullPage: true
    })
  })
  
  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/documents/status', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })
    
    await page.goto('/admin/documents/pipeline')
    
    // Should still show the page structure
    await expect(page.getByRole('heading', { name: 'Document Pipeline Management' })).toBeVisible()
  })
})