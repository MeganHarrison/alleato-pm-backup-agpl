/**
 * Commitment API Tests
 *
 * Tests for subcontract and purchase order API endpoints.
 * Uses authenticated fixtures for proper auth handling.
 *
 * @see frontend/tests/fixtures/index.ts for auth setup
 */
import { test, expect } from '../../fixtures/index';
import { TestDataManager, TestDataGenerators } from '../../helpers/test-data';

const PROJECT_ID = 67;

test.describe('Commitment APIs', () => {
  const testData = new TestDataManager({ verbose: true });

  test.afterEach(async ({ authenticatedRequest }) => {
    // Clean up any test data created during the test
    await testData.cleanup(authenticatedRequest);
  });

  test('should create a subcontract via API', async ({ authenticatedRequest }) => {
    const timestamp = Date.now();
    const contractNumber = `SC-API-${timestamp}`;

    const response = await authenticatedRequest.post(
      `/api/projects/${PROJECT_ID}/subcontracts`,
      {
        data: {
          contractNumber,
          title: TestDataGenerators.uniqueName('Test Subcontract'),
          status: 'Draft',
          executed: false,
          description: 'Created by E2E test',
          dates: {},
          privacy: {
            isPrivate: true,
            allowNonAdminViewSovItems: false,
          },
          sov: [],
        },
      }
    );

    console.log('Subcontract API Response status:', response.status());
    const body = await response.json();
    console.log('Subcontract API Response body:', JSON.stringify(body, null, 2));

    // Expect successful creation
    expect(response.ok()).toBe(true);
    expect(body.id).toBeDefined();

    // Track for cleanup
    if (body.id) {
      testData.track({
        type: 'subcontracts',
        id: body.id,
        projectId: String(PROJECT_ID),
        deleteUrl: `/api/projects/${PROJECT_ID}/subcontracts/${body.id}`,
      });
    }
  });

  test('should create a purchase order via API', async ({ authenticatedRequest }) => {
    const timestamp = Date.now();
    const contractNumber = `PO-API-${timestamp}`;

    const response = await authenticatedRequest.post(
      `/api/projects/${PROJECT_ID}/purchase-orders`,
      {
        data: {
          contractNumber,
          title: TestDataGenerators.uniqueName('Test Purchase Order'),
          status: 'Draft',
          executed: false,
          accountingMethod: 'unit-quantity',
          billTo: '123 Test Street',
          shipTo: '456 Test Ave',
          paymentTerms: 'Net 30',
          description: 'Created by E2E test',
          dates: {},
          privacy: {
            isPrivate: true,
            allowNonAdminViewSovItems: false,
          },
          sov: [],
        },
      }
    );

    console.log('Purchase Order API Response status:', response.status());
    const body = await response.json();
    console.log('Purchase Order API Response body:', JSON.stringify(body, null, 2));

    // Expect successful creation
    expect(response.ok()).toBe(true);
    expect(body.id).toBeDefined();

    // Track for cleanup
    if (body.id) {
      testData.track({
        type: 'purchase-orders',
        id: body.id,
        projectId: String(PROJECT_ID),
        deleteUrl: `/api/projects/${PROJECT_ID}/purchase-orders/${body.id}`,
      });
    }
  });

  test('should fetch commitments from unified view', async ({ authenticatedRequest }) => {
    const response = await authenticatedRequest.get(
      `/api/commitments?projectId=${PROJECT_ID}`
    );

    console.log('Commitments API Response status:', response.status());
    const body = await response.json();
    console.log('Commitments count:', body.data?.length || 0);

    expect(response.ok()).toBe(true);
    expect(Array.isArray(body.data) || body.data === undefined).toBe(true);
  });
});
