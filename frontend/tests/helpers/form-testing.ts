/**
 * Comprehensive Form Testing Utilities
 *
 * Standardizes form testing patterns across the application.
 * Reduces duplication and ensures consistent test coverage.
 *
 * @module form-testing
 */

import { type Page, expect } from '@playwright/test';

/**
 * Form test configuration
 */
export interface FormTestConfig {
  name: string;
  route: string;
  isModal: boolean;
  modalTrigger?: string;
  requiredFields: FieldConfig[];
  optionalFields?: FieldConfig[];
  submitButtonText: string | RegExp;
  successIndicator: string | RegExp;
  errorIndicators?: string[];
  screenshotPrefix: string;
  priority: 'high' | 'medium' | 'low';
  authRequired: boolean;
}

/**
 * Field configuration for testing
 */
export interface FieldConfig {
  label: string | RegExp;
  type: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date' | 'combobox' | 'file';
  testValue: string | number | boolean;
  validation?: ValidationRule[];
  placeholder?: string;
  errorMessage?: string;
}

/**
 * Validation rule for field testing
 */
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: string | number;
  message: string;
}

/**
 * Test result interface
 */
export interface TestResult {
  success: boolean;
  errors: string[];
  screenshots: string[];
  duration: number;
  createdId?: string;
}

/**
 * Comprehensive form test report
 */
export interface FormTestReport extends TestResult {
  formName: string;
  testType: string;
  timestamp: string;
  loadTime?: number;
  validationErrors?: number;
  accessibilityIssues?: number;
}

/**
 * Test form load and initial state
 *
 * @param page - Playwright page object
 * @param config - Form test configuration
 * @returns Test result with load time and screenshots
 */
export async function testFormLoad(
  page: Page,
  config: FormTestConfig
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const screenshots: string[] = [];

  try {
    // Navigate to form
    await page.goto(config.route);
    await page.waitForLoadState('networkidle');

    // Wait for form to be visible
    const formLocator = page.locator('form').first();
    await expect(formLocator).toBeVisible({ timeout: 10000 });

    // Capture initial screenshot
    const screenshotPath = `${config.screenshotPrefix}-load.png`;
    await page.screenshot({ path: `tests/screenshots/${screenshotPath}`, fullPage: true });
    screenshots.push(screenshotPath);

    // Check for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`Console error: ${msg.text()}`);
      }
    });

    const duration = Date.now() - startTime;
    return { success: errors.length === 0, errors, screenshots, duration };
  } catch (error) {
    errors.push(`Form load failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, errors, screenshots, duration: Date.now() - startTime };
  }
}

/**
 * Test field validations
 *
 * @param page - Playwright page object
 * @param config - Form test configuration
 * @returns Test result with validation errors found
 */
export async function testFieldValidations(
  page: Page,
  config: FormTestConfig
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const screenshots: string[] = [];

  try {
    // Test required field validation (empty submission)
    const submitButton = page.getByRole('button', { name: config.submitButtonText });
    await submitButton.click();
    await page.waitForTimeout(1000); // Wait for validation messages

    // Check if validation errors appear
    for (const field of config.requiredFields) {
      const fieldLabel = typeof field.label === 'string' ? field.label : field.label.source;
      const errorMessage = page.locator(`[role="alert"]`).filter({ hasText: fieldLabel }).or(
        page.locator(`.text-destructive`).filter({ hasText: fieldLabel })
      );

      const isVisible = await errorMessage.isVisible().catch(() => false);
      if (!isVisible && field.validation?.some(v => v.type === 'required')) {
        errors.push(`Required field validation missing for: ${fieldLabel}`);
      }
    }

    // Capture validation errors screenshot
    const screenshotPath = `${config.screenshotPrefix}-validation-errors.png`;
    await page.screenshot({ path: `tests/screenshots/${screenshotPath}`, fullPage: true });
    screenshots.push(screenshotPath);

    // Test invalid format validation (if applicable)
    for (const field of config.requiredFields) {
      if (field.type === 'email') {
        const input = page.getByLabel(field.label);
        await input.fill('invalid-email');
        await input.blur();
        await page.waitForTimeout(500);

        const errorVisible = await page.locator(`[role="alert"]`).isVisible().catch(() => false);
        if (!errorVisible) {
          errors.push(`Email validation missing for: ${typeof field.label === 'string' ? field.label : 'email field'}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    return { success: errors.length === 0, errors, screenshots, duration };
  } catch (error) {
    errors.push(`Validation test failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, errors, screenshots, duration: Date.now() - startTime };
  }
}

/**
 * Fill form with test data
 *
 * @param page - Playwright page object
 * @param fields - Array of field configurations
 * @returns Promise that resolves when form is filled
 */
export async function fillForm(
  page: Page,
  fields: FieldConfig[]
): Promise<void> {
  for (const field of fields) {
    try {
      switch (field.type) {
        case 'text':
        case 'email':
        case 'number':
        case 'textarea':
          await page.getByLabel(field.label).fill(String(field.testValue));
          break;

        case 'select':
          await page.getByLabel(field.label).click();
          await page.waitForTimeout(300);
          await page.getByRole('option', { name: String(field.testValue) }).click();
          break;

        case 'combobox':
          await page.getByLabel(field.label).click();
          await page.waitForTimeout(300);
          await page.getByLabel(field.label).fill(String(field.testValue));
          await page.waitForTimeout(500); // Wait for options to load
          await page.keyboard.press('Enter');
          break;

        case 'checkbox':
          const checkbox = page.getByLabel(field.label);
          const isChecked = await checkbox.isChecked();
          if ((field.testValue && !isChecked) || (!field.testValue && isChecked)) {
            await checkbox.click();
          }
          break;

        case 'date':
          await page.getByLabel(field.label).fill(String(field.testValue));
          break;

        case 'file':
          // File upload requires actual file path
          if (typeof field.testValue === 'string') {
            await page.getByLabel(field.label).setInputFiles(field.testValue);
          }
          break;

        default:
          console.warn(`Unknown field type: ${field.type}`);
      }

      await page.waitForTimeout(200); // Small delay between fields
    } catch (error) {
      console.error(`Failed to fill field ${typeof field.label === 'string' ? field.label : 'unknown'}:`, error);
      throw error;
    }
  }
}

/**
 * Test form submission
 *
 * @param page - Playwright page object
 * @param config - Form test configuration
 * @returns Test result with created record ID if available
 */
export async function testFormSubmission(
  page: Page,
  config: FormTestConfig
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const screenshots: string[] = [];
  let createdId: string | undefined;

  try {
    // Fill form with valid data
    await fillForm(page, config.requiredFields);

    // Capture filled form screenshot
    const filledScreenshotPath = `${config.screenshotPrefix}-filled.png`;
    await page.screenshot({ path: `tests/screenshots/${filledScreenshotPath}`, fullPage: true });
    screenshots.push(filledScreenshotPath);

    // Submit form
    const submitButton = page.getByRole('button', { name: config.submitButtonText });
    await submitButton.click();

    // Wait for response
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Check for success indicator
    const successVisible = await page.getByText(config.successIndicator).isVisible({ timeout: 5000 }).catch(() => false);
    if (!successVisible) {
      // Check if we navigated to a different page (also indicates success)
      const currentUrl = page.url();
      if (currentUrl === config.route) {
        errors.push('Form submission did not show success message or navigate');
      }
    }

    // Try to extract created record ID from URL or page
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/\/([a-f0-9-]{36}|\d+)$/);
    if (idMatch) {
      createdId = idMatch[1];
    }

    // Capture result screenshot
    const resultScreenshotPath = `${config.screenshotPrefix}-submitted.png`;
    await page.screenshot({ path: `tests/screenshots/${resultScreenshotPath}`, fullPage: true });
    screenshots.push(resultScreenshotPath);

    const duration = Date.now() - startTime;
    return { success: errors.length === 0, errors, screenshots, duration, createdId };
  } catch (error) {
    errors.push(`Form submission failed: ${error instanceof Error ? error.message : String(error)}`);
    const errorScreenshotPath = `${config.screenshotPrefix}-submission-error.png`;
    await page.screenshot({ path: `tests/screenshots/${errorScreenshotPath}`, fullPage: true }).catch(() => null);
    screenshots.push(errorScreenshotPath);
    return { success: false, errors, screenshots, duration: Date.now() - startTime, createdId };
  }
}

/**
 * Test form accessibility
 *
 * @param page - Playwright page object
 * @param config - Form test configuration
 * @returns Test result with accessibility issues found
 */
export async function testFormAccessibility(
  page: Page,
  config: FormTestConfig
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const screenshots: string[] = [];

  try {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Check if focus is visible
    const focusedElement = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return null;

      const styles = window.getComputedStyle(active);
      return {
        tagName: active.tagName,
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow
      };
    });

    if (focusedElement && focusedElement.outlineWidth === '0px' && !focusedElement.boxShadow) {
      errors.push('Focus indicator not visible for keyboard navigation');
    }

    // Test tab order through all fields
    for (let i = 0; i < config.requiredFields.length; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    // Check for ARIA labels
    for (const field of config.requiredFields) {
      const input = page.getByLabel(field.label);
      const ariaLabel = await input.getAttribute('aria-label').catch(() => null);
      const ariaLabelledBy = await input.getAttribute('aria-labelledby').catch(() => null);
      const id = await input.getAttribute('id').catch(() => null);

      if (!ariaLabel && !ariaLabelledBy && !id) {
        errors.push(`Field missing ARIA label: ${typeof field.label === 'string' ? field.label : 'unknown'}`);
      }
    }

    // Capture accessibility screenshot
    const screenshotPath = `${config.screenshotPrefix}-accessibility.png`;
    await page.screenshot({ path: `tests/screenshots/${screenshotPath}`, fullPage: true });
    screenshots.push(screenshotPath);

    const duration = Date.now() - startTime;
    return { success: errors.length === 0, errors, screenshots, duration };
  } catch (error) {
    errors.push(`Accessibility test failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, errors, screenshots, duration: Date.now() - startTime };
  }
}

/**
 * Comprehensive form test
 * Runs all test phases in sequence
 *
 * @param page - Playwright page object
 * @param config - Form test configuration
 * @returns Comprehensive form test report
 */
export async function testFormComprehensively(
  page: Page,
  config: FormTestConfig
): Promise<FormTestReport> {
  const startTime = Date.now();
  const allErrors: string[] = [];
  const allScreenshots: string[] = [];

  // Phase 1: Load test
  const loadResult = await testFormLoad(page, config);
  allErrors.push(...loadResult.errors);
  allScreenshots.push(...loadResult.screenshots);

  // Phase 2: Validation test
  const validationResult = await testFieldValidations(page, config);
  allErrors.push(...validationResult.errors);
  allScreenshots.push(...validationResult.screenshots);

  // Phase 3: Submission test
  const submissionResult = await testFormSubmission(page, config);
  allErrors.push(...submissionResult.errors);
  allScreenshots.push(...submissionResult.screenshots);

  // Phase 4: Accessibility test
  await page.goto(config.route); // Reset to form
  const accessibilityResult = await testFormAccessibility(page, config);
  allErrors.push(...accessibilityResult.errors);
  allScreenshots.push(...accessibilityResult.screenshots);

  const duration = Date.now() - startTime;

  return {
    formName: config.name,
    testType: 'comprehensive',
    success: allErrors.length === 0,
    errors: allErrors,
    screenshots: allScreenshots,
    duration,
    timestamp: new Date().toISOString(),
    loadTime: loadResult.duration,
    validationErrors: validationResult.errors.length,
    accessibilityIssues: accessibilityResult.errors.length,
    createdId: submissionResult.createdId
  };
}
