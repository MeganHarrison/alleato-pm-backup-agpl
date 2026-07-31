import { test, expect } from '@playwright/test'

test.describe('Document Pipeline UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock all API responses to test UI functionality
    await page.route('**/api/documents/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documents: [
            {
              id: '1',
              fireflies_id: 'FF001',
              title: 'Weekly Team Meeting - Dec 10',
              status: 'raw_ingested',
              type: 'meeting',
              source: 'fireflies',
              date: '2024-12-10',
              created_at: '2024-12-10T14:00:00Z',
              fireflies_ingestion_jobs: {
                stage: 'raw_ingested',
                attempt_count: 0,
                last_attempt_at: null,
                error_message: null
              }
            },
            {
              id: '2',
              fireflies_id: 'FF002',
              title: 'Client Requirements Discussion',
              status: 'segmented',
              type: 'meeting',
              source: 'fireflies',
              date: '2024-12-11',
              created_at: '2024-12-11T10:00:00Z',
              fireflies_ingestion_jobs: {
                stage: 'segmented',
                attempt_count: 1,
                last_attempt_at: '2024-12-11T11:00:00Z',
                error_message: null
              }
            },
            {
              id: '3',
              fireflies_id: 'FF003',
              title: 'Budget Review Meeting',
              status: 'embedded',
              type: 'meeting',  
              source: 'fireflies',
              date: '2024-12-12',
              created_at: '2024-12-12T09:00:00Z',
              fireflies_ingestion_jobs: {
                stage: 'embedded',
                attempt_count: 2,
                last_attempt_at: '2024-12-12T10:30:00Z',
                error_message: null
              }
            }
          ]
        })
      })
    })

    await page.route('**/api/documents/trigger-pipeline**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            phaseCounts: [
              { phase: 'parse', ready: 1, stage: 'raw_ingested' },
              { phase: 'embed', ready: 1, stage: 'segmented' },
              { phase: 'extract', ready: 1, stage: 'embedded' }
            ]
          })
        })
      } else if (route.request().method() === 'POST') {
        const postData = await route.request().postDataJSON()
        
        // Simulate successful trigger
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: `Successfully triggered ${postData.phase} phase`,
            processed: 1,
            total: 1,
            results: [
              {
                fireflies_id: 'FF001',
                status: 'success',
                message: 'Processing started'
              }
            ]
          })
        })
      }
    })
  })

  test('Document Pipeline page displays correctly', async ({ page }) => {
    await page.goto('/admin/documents/pipeline')
    
    // Page should load with title
    await expect(page.getByRole('heading', { name: 'Document Pipeline Management' })).toBeVisible()
    
    // Phase cards should be visible
    await expect(page.getByText('Parse Documents')).toBeVisible()
    await expect(page.getByText('Generate Embeddings')).toBeVisible()
    await expect(page.getByText('Extract Insights')).toBeVisible()
    
    // Document counts should be visible
    await expect(page.getByText('1 Ready')).toHaveCount(3) // All phases have 1 ready
    
    // Table should display documents
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByText('Weekly Team Meeting - Dec 10')).toBeVisible()
    await expect(page.getByText('Client Requirements Discussion')).toBeVisible()
    await expect(page.getByText('Budget Review Meeting')).toBeVisible()
    
    // Status badges
    await expect(page.getByText('Raw Ingested')).toBeVisible()
    await expect(page.getByText('Segmented')).toBeVisible()
    await expect(page.getByText('Embedded')).toBeVisible()
  })

  test('Trigger buttons work correctly', async ({ page }) => {
    await page.goto('/admin/documents/pipeline')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Find and click the Parse Documents trigger button
    const parseButton = page.getByRole('button', { name: 'Trigger Parse Documents' })
    await expect(parseButton).toBeEnabled()
    
    // Click the button
    await parseButton.click()
    
    // Should show loading state briefly
    await expect(parseButton).toBeDisabled()
    await expect(parseButton).toContainText('Processing...')
    
    // Should show success toast
    await expect(page.getByText('Successfully triggered parse phase')).toBeVisible()
    
    // Button should be enabled again
    await expect(parseButton).toBeEnabled()
    await expect(parseButton).toContainText('Trigger')
  })

  test('Refresh button updates document list', async ({ page }) => {
    let callCount = 0
    
    await page.route('**/api/documents/status', async (route) => {
      callCount++
      const documents = callCount === 1 ? [
        {
          id: '1',
          fireflies_id: 'FF001',
          title: 'Initial Document',
          status: 'raw_ingested',
          type: 'meeting',
          source: 'fireflies',
          date: '2024-12-10',
          created_at: '2024-12-10T14:00:00Z',
          fireflies_ingestion_jobs: {
            stage: 'raw_ingested',
            attempt_count: 0
          }
        }
      ] : [
        {
          id: '1',
          fireflies_id: 'FF001',
          title: 'Initial Document',
          status: 'segmented',
          type: 'meeting',
          source: 'fireflies',
          date: '2024-12-10',
          created_at: '2024-12-10T14:00:00Z',
          fireflies_ingestion_jobs: {
            stage: 'segmented',
            attempt_count: 1
          }
        },
        {
          id: '2',
          fireflies_id: 'FF002',
          title: 'New Document Added',
          status: 'raw_ingested',
          type: 'meeting',
          source: 'fireflies',
          date: '2024-12-11',
          created_at: '2024-12-11T14:00:00Z',
          fireflies_ingestion_jobs: {
            stage: 'raw_ingested',
            attempt_count: 0
          }
        }
      ]
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents })
      })
    })
    
    await page.goto('/admin/documents/pipeline')
    
    // Initially should show one document
    await expect(page.getByText('Initial Document')).toBeVisible()
    await expect(page.getByText('New Document Added')).not.toBeVisible()
    
    // Click refresh
    const refreshButton = page.getByRole('button', { name: 'Refresh' })
    await refreshButton.click()
    
    // Should now show updated data
    await expect(page.getByText('Initial Document')).toBeVisible()
    await expect(page.getByText('New Document Added')).toBeVisible()
    
    // Status should have changed
    await expect(page.getByText('Segmented').first()).toBeVisible()
  })

  test('Error handling displays correctly', async ({ page }) => {
    await page.route('**/api/documents/status', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database connection failed' })
      })
    })
    
    await page.goto('/admin/documents/pipeline')
    
    // Should show error toast
    await expect(page.getByText('Failed to fetch documents')).toBeVisible()
  })

  test('Phase action descriptions are accurate', async ({ page }) => {
    await page.goto('/admin/documents/pipeline')
    
    // Check phase descriptions
    await expect(page.getByText('Segment documents into semantic chunks for processing')).toBeVisible()
    await expect(page.getByText('Create vector embeddings for semantic search capabilities')).toBeVisible()
    await expect(page.getByText('Extract key decisions, risks, and opportunities from content')).toBeVisible()
  })
})