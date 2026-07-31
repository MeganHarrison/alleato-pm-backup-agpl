import { test, expect } from '@playwright/test';

/**
 * Automated Layout Verification Tests
 * 
 * These tests ensure all layout components provide proper spacing,
 * padding, and responsive behavior according to the design system.
 */

const LAYOUTS_TO_TEST = [
  {
    name: 'Executive Layout',
    url: '/executive',
    expectedPadding: {
      mobile: 8,  // 2 * 4px (p-2)
      tablet: 16, // 4 * 4px (p-4) 
      desktop: 24 // 6 * 4px (p-6)
    }
  },
  {
    name: 'Table Layout',
    url: '/directory/companies',
    expectedPadding: {
      mobile: 16,
      tablet: 16,
      desktop: 16
    }
  },
  {
    name: 'Dashboard Layout', 
    url: '/dashboard',
    expectedPadding: {
      mobile: 24,
      tablet: 24,
      desktop: 24
    }
  },
  {
    name: 'Form Layout',
    url: '/profile',
    expectedPadding: {
      mobile: 24,
      tablet: 24, 
      desktop: 24
    }
  }
];

const VIEWPORT_SIZES = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 }
};

test.describe('Layout Spacing Verification', () => {
  for (const layout of LAYOUTS_TO_TEST) {
    test.describe(layout.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(layout.url);
        await page.waitForLoadState('networkidle');
      });

      // Test each viewport size
      for (const [device, viewport] of Object.entries(VIEWPORT_SIZES)) {
        test(`should have correct padding on ${device}`, async ({ page }) => {
          // Set viewport
          await page.setViewportSize(viewport);
          await page.waitForTimeout(300); // Wait for responsive styles

          // Find the main layout container
          const layoutContainer = await page.locator('[data-layout]').first();
          
          // Get computed styles
          const padding = await layoutContainer.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
              left: parseInt(styles.paddingLeft),
              right: parseInt(styles.paddingRight),
              top: parseInt(styles.paddingTop),
              bottom: parseInt(styles.paddingBottom)
            };
          });

          // Get expected padding for this device
          const expectedPadding = layout.expectedPadding[device as keyof typeof layout.expectedPadding];

          // Account for parent container padding (main has px-4 sm:px-6 lg:px-8)
          const parentPadding = device === 'mobile' ? 16 : device === 'tablet' ? 24 : 32;
          
          // For executive layout, it uses negative margins to counter parent padding
          const adjustedExpectedPadding = layout.name === 'Executive Layout' 
            ? expectedPadding 
            : expectedPadding + parentPadding;

          // Verify horizontal padding
          expect(padding.left).toBeGreaterThanOrEqual(adjustedExpectedPadding - 2);
          expect(padding.right).toBeGreaterThanOrEqual(adjustedExpectedPadding - 2);
        });
      }

      test('should have proper CSS variables', async ({ page }) => {
        const layoutContainer = await page.locator('[data-layout]').first();
        
        const cssVars = await layoutContainer.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            pagePadding: styles.getPropertyValue('--page-padding'),
            sectionGap: styles.getPropertyValue('--section-gap'),
            cardPadding: styles.getPropertyValue('--card-padding'),
            groupGap: styles.getPropertyValue('--group-gap'),
            fieldGap: styles.getPropertyValue('--field-gap')
          };
        });

        // Verify CSS variables are set
        expect(cssVars.pagePadding).toBeTruthy();
        expect(cssVars.sectionGap).toBeTruthy();
        expect(cssVars.cardPadding).toBeTruthy();
        expect(cssVars.groupGap).toBeTruthy();
        expect(cssVars.fieldGap).toBeTruthy();
      });

      test('should not have double padding', async ({ page }) => {
        // Check that we don't have padding on padding
        const mainContent = await page.locator('main').first();
        const layoutContainer = await page.locator('[data-layout]').first();
        
        const mainBox = await mainContent.boundingBox();
        const layoutBox = await layoutContainer.boundingBox();
        
        if (mainBox && layoutBox) {
          // Layout should not add significant extra padding on top of main
          const extraPadding = mainBox.x - layoutBox.x;
          expect(extraPadding).toBeLessThanOrEqual(32); // Allow some padding but not double
        }
      });

      test('should handle sidebar toggle correctly', async ({ page }) => {
        await page.setViewportSize(VIEWPORT_SIZES.desktop);
        
        // Get initial position
        const initialBox = await page.locator('[data-layout]').first().boundingBox();
        
        // Toggle sidebar if exists
        const sidebarTrigger = await page.locator('[data-sidebar="trigger"]');
        if (await sidebarTrigger.count() > 0) {
          await sidebarTrigger.click();
          await page.waitForTimeout(300); // Wait for animation
          
          // Get position after toggle
          const afterBox = await page.locator('[data-layout]').first().boundingBox();
          
          // Content should adjust position when sidebar toggles
          if (initialBox && afterBox) {
            expect(afterBox.x).not.toEqual(initialBox.x);
          }
        }
      });
    });
  }

  test.describe('Edge Cases', () => {
    test('should handle empty state gracefully', async ({ page }) => {
      // Create a test page with empty layout
      await page.goto('/directory/companies');
      
      // Remove all content
      await page.evaluate(() => {
        const content = document.querySelector('[data-layout] > div');
        if (content) content.innerHTML = '';
      });
      
      // Should still have proper structure
      const layoutContainer = await page.locator('[data-layout]');
      await expect(layoutContainer).toBeVisible();
    });

    test('should handle overflow content', async ({ page }) => {
      await page.goto('/directory/companies');
      
      // Add overflow content
      await page.evaluate(() => {
        const content = document.querySelector('[data-layout] > div');
        if (content) {
          content.innerHTML = '<div style="width: 3000px; height: 100px; background: red;">Wide content</div>';
        }
      });
      
      // Should handle overflow properly
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      expect(hasHorizontalScroll).toBe(false); // Should not cause page-wide horizontal scroll
    });
  });
});

test.describe('Visual Regression', () => {
  // Take screenshots for visual comparison
  for (const layout of LAYOUTS_TO_TEST) {
    test(`${layout.name} visual snapshot`, async ({ page }) => {
      await page.goto(layout.url);
      await page.waitForLoadState('networkidle');
      
      // Take screenshots at different viewports
      for (const [device, viewport] of Object.entries(VIEWPORT_SIZES)) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(300);
        
        await expect(page).toHaveScreenshot(`${layout.name.toLowerCase().replace(' ', '-')}-${device}.png`, {
          fullPage: true,
          animations: 'disabled'
        });
      }
    });
  }
});