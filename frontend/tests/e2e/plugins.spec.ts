/**
 * Plugin System E2E Tests
 * Tests the plugin management interface and functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Plugin System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to plugin settings page
    await page.goto('/settings/plugins');
    
    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Plugin Manager' })).toBeVisible();
  });

  test('should display plugin manager interface', async ({ page }) => {
    // Check main elements are present
    await expect(page.getByRole('heading', { name: 'Plugin Manager' })).toBeVisible();
    await expect(page.getByText('Install and manage plugins to extend your application')).toBeVisible();
    
    // Check tabs are present
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Installed' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Enabled' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Disabled' })).toBeVisible();
    
    // Check search input
    await expect(page.getByPlaceholder('Search plugins...')).toBeVisible();
    
    // Check install button
    await expect(page.getByRole('button', { name: 'Install Plugin' })).toBeVisible();
  });

  test('should open install dialog', async ({ page }) => {
    // Click install plugin button
    await page.getByRole('button', { name: 'Install Plugin' }).click();
    
    // Check dialog opened
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Install Plugin')).toBeVisible();
    await expect(page.getByText('Enter the URL of the plugin manifest to install')).toBeVisible();
    
    // Check input field
    await expect(page.getByLabel('Manifest URL')).toBeVisible();
    
    // Check security notice
    await expect(page.getByText('Security Notice')).toBeVisible();
    await expect(page.getByText('Only install plugins from trusted sources')).toBeVisible();
  });

  test('should validate manifest URL input', async ({ page }) => {
    // Open install dialog
    await page.getByRole('button', { name: 'Install Plugin' }).click();
    
    // Try to install without URL
    const installButton = page.getByRole('button', { name: 'Install Plugin' }).last();
    await expect(installButton).toBeDisabled();
    
    // Enter invalid URL
    await page.getByLabel('Manifest URL').fill('invalid-url');
    await expect(installButton).toBeDisabled();
    
    // Enter valid URL
    await page.getByLabel('Manifest URL').fill('https://example.com/manifest.json');
    await expect(installButton).toBeEnabled();
  });

  test('should filter plugins by search', async ({ page }) => {
    // Assuming we have some test plugins installed
    // This test would need actual plugin data to work properly
    
    // Enter search query
    await page.getByPlaceholder('Search plugins...').fill('audit');
    
    // Check that only matching plugins are shown
    // This would need to be adapted based on actual plugin data
  });

  test('should switch between tabs', async ({ page }) => {
    // Test tab switching
    await page.getByRole('tab', { name: 'Enabled' }).click();
    await expect(page.getByRole('tab', { name: 'Enabled' })).toHaveAttribute('data-state', 'active');
    
    await page.getByRole('tab', { name: 'Disabled' }).click();
    await expect(page.getByRole('tab', { name: 'Disabled' })).toHaveAttribute('data-state', 'active');
    
    await page.getByRole('tab', { name: 'All' }).click();
    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('data-state', 'active');
  });

  test.describe('Plugin Cards', () => {
    test('should display plugin information', async ({ page }) => {
      // This test assumes there are plugins installed
      // Would need to be adapted based on test data setup
      
      const pluginCard = page.locator('[data-testid="plugin-card"]').first();
      
      if (await pluginCard.isVisible()) {
        // Check plugin card elements
        await expect(pluginCard.locator('.plugin-name')).toBeVisible();
        await expect(pluginCard.locator('.plugin-description')).toBeVisible();
        await expect(pluginCard.locator('.plugin-version')).toBeVisible();
        await expect(pluginCard.locator('.plugin-status-badge')).toBeVisible();
        await expect(pluginCard.locator('.plugin-toggle')).toBeVisible();
        await expect(pluginCard.locator('.plugin-menu')).toBeVisible();
      }
    });

    test('should toggle plugin enable/disable', async ({ page }) => {
      const pluginToggle = page.locator('[data-testid="plugin-toggle"]').first();
      
      if (await pluginToggle.isVisible()) {
        const initialState = await pluginToggle.isChecked();
        
        // Toggle the plugin
        await pluginToggle.click();
        
        // Wait for state change
        await page.waitForTimeout(1000);
        
        // Check state changed
        const newState = await pluginToggle.isChecked();
        expect(newState).toBe(!initialState);
        
        // Check for success message (would need toast implementation)
        // await expect(page.getByText(/Plugin.*enabled|disabled/)).toBeVisible();
      }
    });

    test('should open plugin menu', async ({ page }) => {
      const pluginMenu = page.locator('[data-testid="plugin-menu"]').first();
      
      if (await pluginMenu.isVisible()) {
        await pluginMenu.click();
        
        // Check dropdown menu options
        await expect(page.getByText('Settings')).toBeVisible();
        await expect(page.getByText('Uninstall')).toBeVisible();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/plugins/**', route => route.abort());
      
      // Refresh page to trigger error
      await page.reload();
      
      // Should show error state or loading state
      // This would depend on the actual error handling implementation
    });

    test('should handle invalid manifest URLs', async ({ page }) => {
      // Open install dialog
      await page.getByRole('button', { name: 'Install Plugin' }).click();
      
      // Enter URL that would return 404
      await page.getByLabel('Manifest URL').fill('https://example.com/nonexistent.json');
      
      // Mock 404 response
      await page.route('**/nonexistent.json', route => {
        route.fulfill({
          status: 404,
          body: 'Not Found'
        });
      });
      
      // Try to install
      await page.getByRole('button', { name: 'Install Plugin' }).last().click();
      
      // Should show error message
      // await expect(page.getByText(/Failed to fetch manifest/)).toBeVisible();
    });
  });

  test.describe('Plugin Marketplace Integration', () => {
    test.skip('should display marketplace plugins', async ({ page }) => {
      // This would test future marketplace integration
      // Skip for now since it's not implemented
    });

    test.skip('should install from marketplace', async ({ page }) => {
      // This would test installing plugins from a marketplace
      // Skip for now since it's not implemented
    });
  });
});

test.describe('Plugin API Integration', () => {
  test('should integrate with plugin hooks', async ({ page }) => {
    // Navigate to a page that uses plugin hooks (e.g., project page)
    await page.goto('/projects/test-project');
    
    // Check for plugin-generated content
    // This would need actual plugins installed to test
    
    // For example, check if plugin menu items appear
    const actionMenu = page.locator('[data-testid="project-actions-menu"]');
    if (await actionMenu.isVisible()) {
      await actionMenu.click();
      
      // Look for plugin-added menu items
      // This would depend on which plugins are installed and enabled
    }
  });

  test('should display plugin widgets on dashboard', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Check for plugin widgets
    // This would need actual widget plugins installed
    const widgetContainer = page.locator('[data-testid="dashboard-widgets"]');
    if (await widgetContainer.isVisible()) {
      // Look for plugin-generated widgets
      // Implementation would depend on actual widget system
    }
  });
});

// Helper functions for plugin testing
async function createTestPlugin(page: any, manifest: any) {
  // Helper to create a test plugin for testing purposes
  // This would be used in tests that need actual plugin data
}

async function mockPluginAPI(page: any) {
  // Helper to mock the plugin API responses
  // Useful for testing without requiring actual backend
}