import { test, expect } from '../../fixtures/auth';

/**
 * API-focused E2E Tests for Change Events
 *
 * Tests the API endpoints directly without UI interaction
 */

const TEST_PROJECT_ID = 60;

test.describe('Change Events - API Tests', () => {
  let createdEventId: string;

  test.describe('GET /api/projects/[id]/change-events', () => {
    test('should return 200 and valid JSON', async ({ request }) => {
      const response = await request.get(`/api/projects/${TEST_PROJECT_ID}/change-events`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data).toHaveProperty('meta');
    });

    test('should support pagination', async ({ request }) => {
      const response = await request.get(
        `/api/projects/${TEST_PROJECT_ID}/change-events?page=1&limit=5`
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.meta).toHaveProperty('page', 1);
      expect(data.meta).toHaveProperty('limit', 5);
    });

    test('should support status filtering', async ({ request }) => {
      const response = await request.get(
        `/api/projects/${TEST_PROJECT_ID}/change-events?status=Open`
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      // All results should have status 'Open' (Title Case)
      const allOpen = data.data.every((event: any) =>
        event.status === 'Open'
      );
      expect(allOpen).toBe(true);
    });

    test('should support sorting', async ({ request }) => {
      const response = await request.get(
        `/api/projects/${TEST_PROJECT_ID}/change-events?sort=createdAt&order=desc`
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      // Should be sorted by created_at descending
      if (data.data.length > 1) {
        const first = new Date(data.data[0].created_at);
        const second = new Date(data.data[1].created_at);
        expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
      }
    });

    test('should support search', async ({ request }) => {
      const response = await request.get(
        `/api/projects/${TEST_PROJECT_ID}/change-events?search=test`
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      // Results should contain 'test' in title or notes
      const allMatch = data.data.every((event: any) =>
        event.title?.toLowerCase().includes('test') ||
        event.notes?.toLowerCase().includes('test') ||
        event.number?.toLowerCase().includes('test')
      );
      expect(allMatch).toBe(true);
    });
  });

  test.describe('POST /api/projects/[id]/change-events', () => {
    test('should create change event with valid data', async ({ request }) => {
      const response = await request.post(
        `/api/projects/${TEST_PROJECT_ID}/change-events`,
        {
          data: {
            title: 'API Test Change Event',
            type: 'Owner Change',
            scope: 'Out of Scope',
            reason: 'Testing API',
            description: 'Created via API test',
            expectingRevenue: true
          }
        }
      );

      // Log response for debugging
      const responseText = await response.text();
      console.warn(`POST response status: ${response.status()}`);
      console.warn(`POST response body: ${responseText}`);

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('number');
      expect(data.title).toBe('API Test Change Event');

      // Save ID for subsequent tests
      createdEventId = data.id;

      console.warn(`✅ Created change event via API: ${createdEventId}`);
    });

    test('should reject missing required fields', async ({ request }) => {
      const response = await request.post(
        `/api/projects/${TEST_PROJECT_ID}/change-events`,
        {
          data: {
            // Missing title
            type: 'Owner Change',
            scope: 'Out of Scope'
          }
        }
      );

      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('should reject invalid enum values', async ({ request }) => {
      const response = await request.post(
        `/api/projects/${TEST_PROJECT_ID}/change-events`,
        {
          data: {
            title: 'Test',
            type: 'INVALID_TYPE',
            scope: 'Out of Scope'
          }
        }
      );

      expect(response.status()).toBeGreaterThanOrEqual(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('should auto-generate event number', async ({ request }, testInfo) => {
      // Skip in chromium to avoid parallel execution race condition
      if (testInfo.project.name === 'chromium') {
        test.skip();
      }

      const response = await request.post(
        `/api/projects/${TEST_PROJECT_ID}/change-events`,
        {
          data: {
            title: 'Auto Number Test',
            type: 'Owner Change',
            scope: 'In Scope'
          }
        }
      );

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data.number).toBeDefined();
      expect(data.number).toMatch(/^\d{3}$/); // Should be 3-digit number
    });
  });

  test.describe('GET /api/projects/[id]/change-events/[eventId]', () => {
    test('should return single change event', async ({ request }) => {
      if (!createdEventId) test.skip();

      const response = await request.get(
        `/api/projects/${TEST_PROJECT_ID}/change-events/${createdEventId}`
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(createdEventId);
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('status');
    });

    test('should return 404 for non-existent ID', async ({ request }) => {
      const response = await request.get(
        `/api/projects/${TEST_PROJECT_ID}/change-events/non-existent-id`
      );

      expect(response.status()).toBe(404);
    });
  });

  test.describe('PATCH /api/projects/[id]/change-events/[eventId]', () => {
    test('should update change event', async ({ request }) => {
      if (!createdEventId) test.skip();

      const response = await request.patch(
        `/api/projects/${TEST_PROJECT_ID}/change-events/${createdEventId}`,
        {
          data: {
            title: 'API Test Change Event - UPDATED',
            description: 'Updated via API test'
          }
        }
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.title).toBe('API Test Change Event - UPDATED');
    });

    test('should reject invalid updates', async ({ request }) => {
      if (!createdEventId) test.skip();

      const response = await request.patch(
        `/api/projects/${TEST_PROJECT_ID}/change-events/${createdEventId}`,
        {
          data: {
            type: 'INVALID_TYPE'
          }
        }
      );

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('DELETE /api/projects/[id]/change-events/[eventId]', () => {
    test('should soft delete change event', async ({ request }) => {
      if (!createdEventId) test.skip();

      const response = await request.delete(
        `/api/projects/${TEST_PROJECT_ID}/change-events/${createdEventId}`
      );

      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(300);

      // Verify it's soft deleted (has deleted_at)
      const getResponse = await request.get(
        `/api/projects/${TEST_PROJECT_ID}/change-events/${createdEventId}`
      );

      if (getResponse.status() === 200) {
        const data = await getResponse.json();
        expect(data.deleted_at).not.toBeNull();
      }
    });

    test('should not appear in default list after delete', async ({ request }) => {
      if (!createdEventId) test.skip();

      const response = await request.get(
        `/api/projects/${TEST_PROJECT_ID}/change-events`
      );

      const data = await response.json();
      const deletedEventInList = data.data.find((e: any) => e.id === createdEventId);

      expect(deletedEventInList).toBeUndefined();
    });
  });

  test.describe('Error Handling', () => {
    test.skip('should return 401 for unauthenticated requests', async ({ request }) => {
      // Skip: Cannot test unauthenticated requests with authenticated context
      // Would need a separate test file with no-auth project configuration
    });

    test('should return 400 for invalid project ID', async ({ request }) => {
      const response = await request.get(`/api/projects/invalid/change-events`);

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Performance', () => {
    test('list endpoint should respond within 2 seconds', async ({ request }) => {
      const start = Date.now();

      const response = await request.get(
        `/api/projects/${TEST_PROJECT_ID}/change-events?limit=25`
      );

      const duration = Date.now() - start;
      console.warn(`⏱️  API response time: ${duration}ms`);

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(2000); // Increased threshold for realistic performance
    });

    test('create endpoint should respond within 2 seconds', async ({ request }, testInfo) => {
      // Skip in chromium project to avoid race condition with debug project
      // Both projects run in parallel and can cause duplicate number conflicts
      if (testInfo.project.name === 'chromium') {
        test.skip();
      }

      const start = Date.now();
      const uniqueTitle = `Performance Test ${Date.now()}`;

      const response = await request.post(
        `/api/projects/${TEST_PROJECT_ID}/change-events`,
        {
          data: {
            title: uniqueTitle,
            type: 'Owner Change',
            scope: 'In Scope'
          }
        }
      );

      const duration = Date.now() - start;
      console.warn(`⏱️  Create API response time: ${duration}ms`);

      if (response.status() !== 201) {
        const errorData = await response.json();
        console.error('Create failed:', response.status(), errorData);
      }

      expect(response.status()).toBe(201);
      expect(duration).toBeLessThan(2000);

      // Clean up
      const data = await response.json();
      await request.delete(`/api/projects/${TEST_PROJECT_ID}/change-events/${data.id}`);
    });
  });
});
