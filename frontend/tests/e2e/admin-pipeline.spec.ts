/**
 * E2E tests for the admin documents pipeline page
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Documents Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the admin pipeline page
    await page.goto('/admin/documents/pipeline');
  });

  test('should display pipeline interface', async ({ page }) => {
    // Check main elements are present
    await expect(page.getByRole('heading', { name: 'Document Pipeline' })).toBeVisible();
    await expect(page.getByText('Manage document processing and embedding generation')).toBeVisible();
    
    // Check pipeline status section
    await expect(page.getByText('Pipeline Status')).toBeVisible();
    await expect(page.getByText('Current state of documents')).toBeVisible();
    
    // Check actions section
    await expect(page.getByText('Actions')).toBeVisible();
    await expect(page.getByRole('button', { name: /Trigger Generate Embeddings/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Refresh Statistics/ })).toBeVisible();
  });

  test('should load pipeline statistics', async ({ page }) => {
    // Wait for statistics to load
    await page.waitForSelector('[data-testid="pipeline-stats"]', { state: 'visible', timeout: 10000 });
    
    // Check that stage counts are displayed
    await expect(page.getByText('raw ingested')).toBeVisible();
    await expect(page.getByText('segmented')).toBeVisible();
    await expect(page.getByText('embedded')).toBeVisible();
    await expect(page.getByText('done')).toBeVisible();
    await expect(page.getByText('error')).toBeVisible();
  });

  test('should handle API connection errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/admin/documents/pipeline-stats', route => {
      route.abort();
    });
    
    // Refresh page to trigger error
    await page.reload();
    
    // Should show connection error message
    await expect(page.getByText('Unable to load statistics')).toBeVisible();
    await expect(page.getByText('Could not connect to the API server')).toBeVisible();
  });

  test('should trigger embedding generation', async ({ page }) => {
    // Mock successful API responses
    await page.route('**/api/admin/documents/pipeline-stats', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stage_counts: {
            raw_ingested: 5,
            segmented: 3,
            embedded: 10,
            done: 15,
            error: 1
          },
          total_documents: 34,
          recent_documents: [],
          timestamp: new Date().toISOString()
        })
      });
    });

    await page.route('**/api/admin/documents/generate-embeddings', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'started',
          message: 'Embedding generation started for 5 documents',
          task_id: 'embed_20241216_123456',
          details: {
            stage: 'raw_ingested',
            document_count: 5,
            limit: 10
          }
        })
      });
    });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Click the trigger button
    const triggerButton = page.getByRole('button', { name: /Trigger Generate Embeddings/ });
    await expect(triggerButton).toBeEnabled();
    await triggerButton.click();

    // Check for success message
    await expect(page.getByText('Embedding generation started successfully!')).toBeVisible();
    
    // Check that task result is displayed
    await expect(page.getByText('Last Task Result')).toBeVisible();
    await expect(page.getByText('started')).toBeVisible();
    await expect(page.getByText('embed_20241216_123456')).toBeVisible();
  });

  test('should handle no documents to process', async ({ page }) => {
    // Mock API responses with no documents
    await page.route('**/api/admin/documents/pipeline-stats', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stage_counts: {
            raw_ingested: 0,
            segmented: 0,
            embedded: 5,
            done: 10,
            error: 0
          },
          total_documents: 15,
          recent_documents: [],
          timestamp: new Date().toISOString()
        })
      });
    });

    await page.route('**/api/admin/documents/generate-embeddings', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'no_documents',
          message: 'No documents found in stage raw_ingested',
          details: {
            stage: 'raw_ingested',
            count: 0
          }
        })
      });
    });

    await page.waitForLoadState('networkidle');

    // Should show warning about no documents
    await expect(page.getByText('No documents in \'raw_ingested\' stage to process')).toBeVisible();

    // Click trigger button
    await page.getByRole('button', { name: /Trigger Generate Embeddings/ }).click();

    // Should show info message
    await expect(page.getByText('No documents available for processing')).toBeVisible();
  });

  test('should refresh statistics', async ({ page }) => {
    // Mock initial stats
    let callCount = 0;
    await page.route('**/api/admin/documents/pipeline-stats', route => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stage_counts: {
            raw_ingested: callCount * 2,
            segmented: 0,
            embedded: 0,
            done: 0,
            error: 0
          },
          total_documents: callCount * 2,
          recent_documents: [],
          timestamp: new Date().toISOString()
        })
      });
    });

    await page.waitForLoadState('networkidle');

    // Check initial count
    await expect(page.getByText('Total documents: 2')).toBeVisible();

    // Click refresh button
    await page.getByRole('button', { name: /Refresh Statistics/ }).click();

    // Check updated count
    await expect(page.getByText('Total documents: 4')).toBeVisible();
  });

  test('should display recent documents', async ({ page }) => {
    // Mock API with recent documents
    await page.route('**/api/admin/documents/pipeline-stats', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stage_counts: {
            raw_ingested: 1,
            segmented: 1,
            embedded: 1,
            done: 1,
            error: 0
          },
          total_documents: 4,
          recent_documents: [
            {
              fireflies_id: 'TEST-DOC-001',
              stage: 'embedded',
              created_at: '2024-12-16T12:00:00Z'
            },
            {
              fireflies_id: 'TEST-DOC-002', 
              stage: 'done',
              created_at: '2024-12-16T11:00:00Z'
            }
          ],
          timestamp: new Date().toISOString()
        })
      });
    });

    await page.waitForLoadState('networkidle');

    // Check recent documents section
    await expect(page.getByText('Recent Documents')).toBeVisible();
    await expect(page.getByText('TEST-DOC-001')).toBeVisible();
    await expect(page.getByText('TEST-DOC-002')).toBeVisible();
    await expect(page.getByText('embedded')).toBeVisible();
    await expect(page.getByText('done')).toBeVisible();
  });
});

test.describe('API Integration', () => {
  test('should show setup instructions when API is unavailable', async ({ page }) => {
    // Mock all API calls to fail
    await page.route('**/api/admin/**', route => {
      route.abort();
    });

    await page.goto('/admin/documents/pipeline');
    await page.waitForTimeout(2000); // Wait for requests to fail

    // Should show setup instructions
    await expect(page.getByText('Setup Instructions')).toBeVisible();
    await expect(page.getByText('cd backend')).toBeVisible();
    await expect(page.getByText('source venv/bin/activate')).toBeVisible();
    await expect(page.getByText('python -m uvicorn')).toBeVisible();
  });
});