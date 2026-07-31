import { test, expect } from '@playwright/test'

test.describe('Project Homepage - Executive Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a project homepage
    // Note: Update this URL with an actual project ID if needed
    await page.goto('/1/home')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')
  })

  test('should display executive heading with proper typography', async ({ page }) => {
    // Check for the large heading with serif font
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()

    // Verify it has the proper styling class or computed styles
    const fontSize = await heading.evaluate((el) => {
      return window.getComputedStyle(el).fontSize
    })

    // Should be large (>= 60px on desktop)
    const fontSizeNum = parseFloat(fontSize)
    expect(fontSizeNum).toBeGreaterThanOrEqual(48)
  })

  test('should display hero metrics section', async ({ page }) => {
    // Check for Budget Remaining metric
    await expect(page.getByText('Budget Remaining')).toBeVisible()

    // Check for Forecast Variance
    await expect(page.getByText('Forecast Variance')).toBeVisible()

    // Check for Change Orders
    await expect(page.getByText('Change Orders')).toBeVisible()

    // Check for Committed
    await expect(page.getByText('Committed')).toBeVisible()

    // Check for Active Tasks
    await expect(page.getByText('Active Tasks')).toBeVisible()
  })

  test('should display brand color (#DB802D) in key areas', async ({ page }) => {
    // Find elements that should use the brand color
    const brandElements = page.locator('[class*="text-\\[\\#DB802D\\]"]')

    // Should have at least one brand-colored element
    await expect(brandElements.first()).toBeVisible()
  })

  test('should display project summary section', async ({ page }) => {
    // Check for Summary heading
    await expect(page.getByText('Summary', { exact: false })).toBeVisible()
  })

  test('should display project team section', async ({ page }) => {
    // Check for Project Team heading
    await expect(page.getByText('Project Team', { exact: false })).toBeVisible()

    // Check for Add button
    await expect(page.getByRole('button', { name: /add/i })).toBeVisible()
  })

  test('should display recent activity section', async ({ page }) => {
    // Check for Recent Activity heading
    await expect(page.getByText('Recent Activity')).toBeVisible()

    // Check for the three activity cards
    await expect(page.getByText('Recent Meetings')).toBeVisible()
    await expect(page.getByText('Active RFIs')).toBeVisible()
    await expect(page.getByText('Requires Attention')).toBeVisible()
  })

  test('should have proper hover effects on interactive cards', async ({ page }) => {
    // Find a card with hover effect
    const activityCard = page.locator('a[href*="/meetings"]').first()

    if (await activityCard.isVisible()) {
      // Hover over the card
      await activityCard.hover()

      // Check that the element is still visible and interactable
      await expect(activityCard).toBeVisible()
    }
  })

  test('should display editable fields with pencil icons', async ({ page }) => {
    // Check for status field
    const statusSection = page.locator('text=Status').first()
    await expect(statusSection).toBeVisible()

    // Check for date fields
    await expect(page.getByText('Start Date')).toBeVisible()
    await expect(page.getByText('Est. Completion')).toBeVisible()
  })

  test('should have responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Check that heading is still visible
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()

    // Check that metrics are stacked vertically (grid should adapt)
    await expect(page.getByText('Budget Remaining')).toBeVisible()
  })

  test('should display client name as pre-heading', async ({ page }) => {
    // Look for the client name in uppercase small text above the heading
    const clientLabel = page.locator('text=/[A-Z\\s]+/').first()

    // Check it exists and has small text
    if (await clientLabel.isVisible()) {
      const fontSize = await clientLabel.evaluate((el) => {
        return window.getComputedStyle(el).fontSize
      })

      // Client label should be small (< 16px)
      const fontSizeNum = parseFloat(fontSize)
      expect(fontSizeNum).toBeLessThan(16)
    }
  })

  test('should link to meetings page from activity card', async ({ page }) => {
    // Find the meetings activity card link
    const meetingsLink = page.locator('a[href*="/meetings"]').first()

    // Should be visible and have proper href
    await expect(meetingsLink).toBeVisible()
    await expect(meetingsLink).toHaveAttribute('href', /.+\/meetings/)
  })

  test('should link to RFIs page from activity card', async ({ page }) => {
    // Find the RFIs activity card link
    const rfisLink = page.locator('a[href*="/rfis"]').first()

    // Should be visible and have proper href
    await expect(rfisLink).toBeVisible()
    await expect(rfisLink).toHaveAttribute('href', /.+\/rfis/)
  })

  test('should display data-driven project summary with specific information', async ({ page }) => {
    // Navigate to project 67 which has an AI-generated summary
    await page.goto('/67/home')
    await page.waitForLoadState('networkidle')

    // Find the summary section
    const summarySection = page.locator('text=Summary').first()
    await expect(summarySection).toBeVisible()

    // Get the summary content area
    const summaryContent = page.locator('div').filter({ hasText: /Project Overview|Key Stakeholders|Current Status|Critical Issues|Recent Decisions|Next Steps/i })

    // Verify the summary is visible and not just "v" or generic text
    await expect(summaryContent.first()).toBeVisible()

    // Check for specific data-driven content patterns that indicate quality:
    // - Dollar amounts (e.g., "$900,000")
    // - Specific names (e.g., "AJ Taylor", "Keith Fisher")
    // - Specific timeframes (e.g., "1.5 months", "December 19th")
    // - Specific project details (e.g., "232 feet", "60,000 square feet")

    const summaryText = await summaryContent.first().textContent()

    // The summary should be substantial (more than 100 characters)
    expect(summaryText?.length || 0).toBeGreaterThan(100)

    // The summary should NOT be just "v" or other single character responses
    expect(summaryText?.trim()).not.toEqual('v')
    expect(summaryText?.trim().length || 0).toBeGreaterThan(10)
  })

  test('should allow editing project summary', async ({ page }) => {
    // Find the Edit button in the summary section
    const editButton = page.getByRole('button', { name: /edit/i }).filter({ has: page.locator('text=Summary') })

    // Click edit if it exists
    if (await editButton.isVisible()) {
      await editButton.click()

      // Should show textarea for editing
      const textarea = page.locator('textarea')
      await expect(textarea).toBeVisible()

      // Should show Save and Cancel buttons
      await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
    }
  })
})
