/**
 * Modal Form Testing Utilities
 *
 * Specialized utilities for testing modal/dialog forms.
 * Handles modal-specific behaviors like opening, closing, and state management.
 *
 * @module modal-testing
 */

import { type Page, expect } from '@playwright/test';
import { type TestResult } from './form-testing';

/**
 * Modal test configuration
 */
export interface ModalTestConfig {
  name: string;
  triggerSelector: string;
  modalSelector: string;
  closeButtonSelector?: string;
  cancelButtonSelector?: string;
  overlaySelector?: string;
}

/**
 * Open modal by clicking trigger element
 *
 * @param page - Playwright page object
 * @param triggerSelector - Selector for element that opens modal
 * @param modalSelector - Selector for modal container
 * @returns Promise that resolves when modal is open
 */
export async function openModal(
  page: Page,
  triggerSelector: string,
  modalSelector?: string
): Promise<void> {
  try {
    // Click trigger button
    await page.click(triggerSelector);
    await page.waitForTimeout(500); // Wait for animation

    // Wait for modal to be visible
    if (modalSelector) {
      await page.waitForSelector(modalSelector, { state: 'visible', timeout: 5000 });
    } else {
      // Default: wait for any dialog/modal
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    }
  } catch (error) {
    throw new Error(`Failed to open modal: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Wait for modal to open
 *
 * @param page - Playwright page object
 * @param modalSelector - Selector for modal container
 * @param timeout - Maximum wait time in ms
 * @returns Promise that resolves when modal is visible
 */
export async function waitForModalOpen(
  page: Page,
  modalSelector: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForSelector(modalSelector, { state: 'visible', timeout });
}

/**
 * Wait for modal to close
 *
 * @param page - Playwright page object
 * @param modalSelector - Selector for modal container
 * @param timeout - Maximum wait time in ms
 * @returns Promise that resolves when modal is hidden
 */
export async function waitForModalClose(
  page: Page,
  modalSelector: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForSelector(modalSelector, { state: 'hidden', timeout });
}

/**
 * Close modal via X button
 *
 * @param page - Playwright page object
 * @param modalSelector - Selector for modal container
 * @returns Promise that resolves when modal is closed
 */
export async function closeModalViaXButton(
  page: Page,
  modalSelector: string
): Promise<void> {
  try {
    // Find X button (common patterns)
    const closeButton = page.locator(`${modalSelector} button[aria-label*="Close"]`).or(
      page.locator(`${modalSelector} button:has(svg.lucide-x)`)
    );

    await closeButton.click();
    await waitForModalClose(page, modalSelector);
  } catch (error) {
    throw new Error(`Failed to close modal via X button: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Close modal via Cancel button
 *
 * @param page - Playwright page object
 * @param modalSelector - Selector for modal container
 * @returns Promise that resolves when modal is closed
 */
export async function closeModalViaCancelButton(
  page: Page,
  modalSelector: string
): Promise<void> {
  try {
    const cancelButton = page.locator(`${modalSelector} button`).filter({ hasText: /cancel/i });
    await cancelButton.click();
    await waitForModalClose(page, modalSelector);
  } catch (error) {
    throw new Error(`Failed to close modal via Cancel button: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Close modal via ESC key
 *
 * @param page - Playwright page object
 * @param modalSelector - Selector for modal container
 * @returns Promise that resolves when modal is closed
 */
export async function closeModalViaEscKey(
  page: Page,
  modalSelector: string
): Promise<void> {
  try {
    await page.keyboard.press('Escape');
    await waitForModalClose(page, modalSelector);
  } catch (error) {
    throw new Error(`Failed to close modal via ESC key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Close modal via overlay click
 *
 * @param page - Playwright page object
 * @param modalSelector - Selector for modal container
 * @returns Promise that resolves when modal is closed
 */
export async function closeModalViaOverlayClick(
  page: Page,
  modalSelector: string
): Promise<void> {
  try {
    // Click outside modal (on overlay)
    const modalBox = await page.locator(modalSelector).boundingBox();
    if (!modalBox) {
      throw new Error('Modal bounding box not found');
    }

    // Click outside modal bounds
    await page.mouse.click(modalBox.x - 50, modalBox.y);
    await waitForModalClose(page, modalSelector);
  } catch (error) {
    throw new Error(`Failed to close modal via overlay click: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Test all modal close behaviors
 *
 * @param page - Playwright page object
 * @param config - Modal test configuration
 * @returns Test result with errors for each close method
 */
export async function testModalClose(
  page: Page,
  config: ModalTestConfig
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const screenshots: string[] = [];

  // Test 1: Close via X button
  try {
    await openModal(page, config.triggerSelector, config.modalSelector);
    await page.waitForTimeout(500);
    await closeModalViaXButton(page, config.modalSelector);
    await page.waitForTimeout(500);

    const stillVisible = await page.locator(config.modalSelector).isVisible().catch(() => false);
    if (stillVisible) {
      errors.push('Modal did not close via X button');
    }
  } catch (error) {
    errors.push(`X button close failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 2: Close via Cancel button
  try {
    await openModal(page, config.triggerSelector, config.modalSelector);
    await page.waitForTimeout(500);
    await closeModalViaCancelButton(page, config.modalSelector);
    await page.waitForTimeout(500);

    const stillVisible = await page.locator(config.modalSelector).isVisible().catch(() => false);
    if (stillVisible) {
      errors.push('Modal did not close via Cancel button');
    }
  } catch (error) {
    errors.push(`Cancel button close failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 3: Close via ESC key
  try {
    await openModal(page, config.triggerSelector, config.modalSelector);
    await page.waitForTimeout(500);
    await closeModalViaEscKey(page, config.modalSelector);
    await page.waitForTimeout(500);

    const stillVisible = await page.locator(config.modalSelector).isVisible().catch(() => false);
    if (stillVisible) {
      errors.push('Modal did not close via ESC key');
    }
  } catch (error) {
    errors.push(`ESC key close failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 4: Close via overlay click
  try {
    await openModal(page, config.triggerSelector, config.modalSelector);
    await page.waitForTimeout(500);
    await closeModalViaOverlayClick(page, config.modalSelector);
    await page.waitForTimeout(500);

    const stillVisible = await page.locator(config.modalSelector).isVisible().catch(() => false);
    if (stillVisible) {
      errors.push('Modal did not close via overlay click');
    }
  } catch (error) {
    errors.push(`Overlay click close failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Capture final screenshot
  const screenshotPath = `${config.name}-modal-close-tests.png`;
  await page.screenshot({ path: `tests/screenshots/${screenshotPath}`, fullPage: true });
  screenshots.push(screenshotPath);

  const duration = Date.now() - startTime;
  return { success: errors.length === 0, errors, screenshots, duration };
}

/**
 * Test modal responsiveness across different viewport sizes
 *
 * @param page - Playwright page object
 * @param config - Modal test configuration
 * @returns Test result with responsiveness issues
 */
export async function testModalResponsive(
  page: Page,
  config: ModalTestConfig
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const screenshots: string[] = [];

  const viewports = [
    { width: 375, height: 667, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1920, height: 1080, name: 'desktop' }
  ];

  for (const viewport of viewports) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);

      await openModal(page, config.triggerSelector, config.modalSelector);
      await page.waitForTimeout(500);

      // Check if modal is visible and within viewport
      const modalBox = await page.locator(config.modalSelector).boundingBox();
      if (!modalBox) {
        errors.push(`Modal not visible on ${viewport.name}`);
      } else {
        // Check if modal exceeds viewport
        if (modalBox.width > viewport.width) {
          errors.push(`Modal exceeds viewport width on ${viewport.name}`);
        }
        if (modalBox.height > viewport.height) {
          errors.push(`Modal exceeds viewport height on ${viewport.name} (might need scrolling)`);
        }
      }

      // Capture screenshot
      const screenshotPath = `${config.name}-modal-${viewport.name}.png`;
      await page.screenshot({ path: `tests/screenshots/${screenshotPath}`, fullPage: true });
      screenshots.push(screenshotPath);

      // Close modal
      await closeModalViaXButton(page, config.modalSelector).catch(() => {
        // Try ESC if X button fails
        return closeModalViaEscKey(page, config.modalSelector);
      });
      await page.waitForTimeout(500);
    } catch (error) {
      errors.push(`Responsive test failed on ${viewport.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Reset viewport
  await page.setViewportSize({ width: 1920, height: 1080 });

  const duration = Date.now() - startTime;
  return { success: errors.length === 0, errors, screenshots, duration };
}

/**
 * Test modal state persistence
 * Verifies that modal clears form state when reopened
 *
 * @param page - Playwright page object
 * @param config - Modal test configuration
 * @returns Test result with state persistence issues
 */
export async function testModalStatePersistence(
  page: Page,
  config: ModalTestConfig
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const screenshots: string[] = [];

  try {
    // Open modal and fill a field
    await openModal(page, config.triggerSelector, config.modalSelector);
    await page.waitForTimeout(500);

    // Find first text input
    const firstInput = page.locator(`${config.modalSelector} input[type="text"]`).first();
    const inputExists = await firstInput.count().then(c => c > 0);

    if (inputExists) {
      await firstInput.fill('Test data that should not persist');
      await page.waitForTimeout(300);

      // Close modal
      await closeModalViaXButton(page, config.modalSelector);
      await page.waitForTimeout(500);

      // Reopen modal
      await openModal(page, config.triggerSelector, config.modalSelector);
      await page.waitForTimeout(500);

      // Check if field is empty
      const value = await firstInput.inputValue();
      if (value === 'Test data that should not persist') {
        errors.push('Modal form state persisted after close (should be cleared)');
      }

      // Capture screenshot
      const screenshotPath = `${config.name}-modal-state-persistence.png`;
      await page.screenshot({ path: `tests/screenshots/${screenshotPath}`, fullPage: true });
      screenshots.push(screenshotPath);

      // Close modal
      await closeModalViaXButton(page, config.modalSelector);
    } else {
      // No text inputs found, skip test
      errors.push('No text inputs found in modal to test state persistence');
    }
  } catch (error) {
    errors.push(`State persistence test failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const duration = Date.now() - startTime;
  return { success: errors.length === 0, errors, screenshots, duration };
}
