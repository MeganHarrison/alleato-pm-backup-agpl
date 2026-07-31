import { test, expect } from '@playwright/test'

test.describe('Team Chat Functionality', () => {
  test('should load team chat page and allow messaging', async ({ page }) => {
    // Navigate to team chat
    await page.goto('/team-chat')
    
    // Wait for the page to load
    await expect(page.getByText('Team Chat', { exact: true })).toBeVisible()
    
    const channelButtons = page.getByText('Channels', { exact: true }).locator('..').locator('button').filter({ hasText: /.+/ })
    const firstChannel = channelButtons.nth(0)
    const secondChannel = channelButtons.nth(1)
    await expect(firstChannel).toBeVisible()
    await expect(secondChannel).toBeVisible()
    
    // Verify the general channel is active by default
    await firstChannel.click()
    
    // Check that the chat input is present
    const chatInput = page.locator('textarea').first()
    await expect(chatInput).toBeVisible()
    
    // Type and send a message
    await chatInput.fill('Hello from Playwright test!')
    await chatInput.press('Enter')
    
    // Verify the message appears in the chat
    await expect(page.getByRole('button', { name: 'Hello from Playwright test!', exact: true })).toBeVisible()
    
    // Switch to project channel
    await secondChannel.click()
    
    // Send a message in the project channel
    await chatInput.fill('Project update: Tests are passing!')
    await chatInput.press('Enter')
    
    // Verify the message appears
    await expect(page.getByRole('button', { name: 'Project update: Tests are passing!', exact: true })).toBeVisible()
    
    // Take a screenshot for visual verification
    await page.screenshot({ 
      path: 'tests/screenshots/team-chat-test.png',
      fullPage: true 
    })
  })

  test('should persist messages after reload', async ({ page }) => {
    await page.goto('/team-chat')
    await expect(page.getByText('Team Chat', { exact: true })).toBeVisible()
    
    const chatInput = page.locator('textarea').first()
    const message = `Playwright persistence ${Date.now()}`
    await chatInput.fill(message)
    await chatInput.press('Enter')

    await expect(page.getByRole('button', { name: message, exact: true })).toBeVisible()
    await page.reload()
    await expect(page.locator('textarea').first()).toBeVisible()
    await expect(page.getByRole('button', { name: message, exact: true })).toBeVisible()
  })
})
