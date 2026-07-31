/**
 * Test Data Management Helpers
 *
 * Provides utilities for creating and cleaning up test data in Playwright tests.
 * Ensures tests don't leave orphaned data that pollutes other tests.
 *
 * @example
 * ```typescript
 * import { test, expect } from '../fixtures';
 * import { TestDataManager } from '../helpers/test-data';
 *
 * test.describe('My tests', () => {
 *   const testData = new TestDataManager();
 *
 *   test.afterEach(async () => {
 *     await testData.cleanup();
 *   });
 *
 *   test('creates data', async ({ authenticatedRequest }) => {
 *     const project = await testData.create(authenticatedRequest, 'projects', {
 *       name: 'Test Project',
 *     });
 *     // Test with project...
 *     // Cleanup happens automatically in afterEach
 *   });
 * });
 * ```
 */

import type { APIResponse } from '@playwright/test';

// Type for the authenticated request from our fixtures
interface AuthenticatedRequest {
  get: (url: string, options?: RequestOptions) => Promise<APIResponse>;
  post: (url: string, options?: RequestOptions) => Promise<APIResponse>;
  put: (url: string, options?: RequestOptions) => Promise<APIResponse>;
  patch: (url: string, options?: RequestOptions) => Promise<APIResponse>;
  delete: (url: string, options?: RequestOptions) => Promise<APIResponse>;
}

interface RequestOptions {
  data?: unknown;
  headers?: Record<string, string>;
}

interface CreatedResource {
  type: string;
  id: string;
  projectId?: string;
  deleteUrl: string;
}

/**
 * Manages test data creation and cleanup.
 *
 * Tracks all resources created during a test and provides a cleanup()
 * method to delete them in reverse order (respecting dependencies).
 */
export class TestDataManager {
  private createdResources: CreatedResource[] = [];
  private verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  /**
   * Create a resource via API and track it for cleanup.
   *
   * @param request - Authenticated request from fixtures
   * @param resourceType - Type of resource (e.g., 'projects', 'change-events')
   * @param data - Data to create the resource with
   * @param options - Additional options
   * @returns The created resource data
   */
  async create<T extends { id: string }>(
    request: AuthenticatedRequest,
    resourceType: string,
    data: Record<string, unknown>,
    options: {
      projectId?: string;
      customUrl?: string;
    } = {}
  ): Promise<T> {
    const { projectId, customUrl } = options;

    // Determine the API URL
    let url: string;
    if (customUrl) {
      url = customUrl;
    } else if (projectId) {
      url = `/api/projects/${projectId}/${resourceType}`;
    } else {
      url = `/api/${resourceType}`;
    }

    if (this.verbose) {
      console.log(`Creating ${resourceType}:`, data);
    }

    const response = await request.post(url, { data });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create ${resourceType}: ${response.status()} - ${errorText}`
      );
    }

    const created = (await response.json()) as T;

    // Determine delete URL
    let deleteUrl: string;
    if (customUrl) {
      deleteUrl = `${customUrl}/${created.id}`;
    } else if (projectId) {
      deleteUrl = `/api/projects/${projectId}/${resourceType}/${created.id}`;
    } else {
      deleteUrl = `/api/${resourceType}/${created.id}`;
    }

    // Track for cleanup
    this.createdResources.push({
      type: resourceType,
      id: created.id,
      projectId,
      deleteUrl,
    });

    if (this.verbose) {
      console.log(`Created ${resourceType} with id:`, created.id);
    }

    return created;
  }

  /**
   * Create a nested resource (e.g., line item within change event)
   */
  async createNested<T extends { id: string }>(
    request: AuthenticatedRequest,
    parentUrl: string,
    resourceType: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const url = `${parentUrl}/${resourceType}`;

    if (this.verbose) {
      console.log(`Creating nested ${resourceType} at ${url}:`, data);
    }

    const response = await request.post(url, { data });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create ${resourceType}: ${response.status()} - ${errorText}`
      );
    }

    const created = (await response.json()) as T;

    // Track for cleanup
    this.createdResources.push({
      type: resourceType,
      id: created.id,
      deleteUrl: `${url}/${created.id}`,
    });

    return created;
  }

  /**
   * Manually track a resource for cleanup (if created outside this manager)
   */
  track(resource: { type: string; id: string; deleteUrl: string; projectId?: string }) {
    this.createdResources.push(resource);
  }

  /**
   * Clean up all created resources in reverse order.
   *
   * Call this in afterEach() to ensure test data is removed.
   */
  async cleanup(request?: AuthenticatedRequest): Promise<void> {
    if (this.createdResources.length === 0) {
      return;
    }

    if (!request) {
      console.warn('No request provided to cleanup - resources not deleted');
      this.createdResources = [];
      return;
    }

    // Delete in reverse order to handle dependencies
    const resourcesToDelete = [...this.createdResources].reverse();
    const errors: string[] = [];

    for (const resource of resourcesToDelete) {
      try {
        if (this.verbose) {
          console.log(`Deleting ${resource.type} ${resource.id}...`);
        }

        const response = await request.delete(resource.deleteUrl);

        // Accept 200, 204, or 404 (already deleted)
        if (response.ok() || response.status() === 404) {
          if (this.verbose) {
            console.log(`Deleted ${resource.type} ${resource.id}`);
          }
        } else {
          errors.push(
            `Failed to delete ${resource.type} ${resource.id}: ${response.status()}`
          );
        }
      } catch (error) {
        errors.push(
          `Error deleting ${resource.type} ${resource.id}: ${error}`
        );
      }
    }

    // Clear the list regardless of errors
    this.createdResources = [];

    if (errors.length > 0 && this.verbose) {
      console.warn('Cleanup errors:', errors);
    }
  }

  /**
   * Get list of tracked resources (for debugging)
   */
  getTrackedResources(): readonly CreatedResource[] {
    return this.createdResources;
  }

  /**
   * Clear tracked resources without deleting them
   */
  clearTracked(): void {
    this.createdResources = [];
  }
}

/**
 * Generate unique test data values
 */
export const TestDataGenerators = {
  /**
   * Generate a unique name with timestamp
   */
  uniqueName: (prefix: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}_${timestamp}_${random}`;
  },

  /**
   * Generate a unique email
   */
  uniqueEmail: (prefix: string = 'test'): string => {
    const timestamp = Date.now();
    return `${prefix}_${timestamp}@test.alleato.com`;
  },

  /**
   * Generate a random amount (for financial fields)
   */
  randomAmount: (min: number = 100, max: number = 10000): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generate a random date in the future
   */
  futureDate: (daysAhead: number = 30): string => {
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead));
    return date.toISOString().split('T')[0];
  },

  /**
   * Generate a random date in the past
   */
  pastDate: (daysBack: number = 30): string => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
    return date.toISOString().split('T')[0];
  },
};

/**
 * Common test data templates
 */
export const TestDataTemplates = {
  /**
   * Basic change event data
   */
  changeEvent: (overrides: Record<string, unknown> = {}) => ({
    title: TestDataGenerators.uniqueName('Test Change Event'),
    description: 'Test change event created by automated tests',
    status: 'draft',
    change_reason: 'testing',
    ...overrides,
  }),

  /**
   * Basic commitment data
   */
  commitment: (overrides: Record<string, unknown> = {}) => ({
    title: TestDataGenerators.uniqueName('Test Commitment'),
    vendor_id: null,
    status: 'draft',
    ...overrides,
  }),

  /**
   * Basic line item data
   */
  lineItem: (overrides: Record<string, unknown> = {}) => ({
    description: TestDataGenerators.uniqueName('Test Line Item'),
    quantity: 1,
    unit_cost: TestDataGenerators.randomAmount(100, 1000),
    ...overrides,
  }),

  /**
   * Basic direct cost data
   */
  directCost: (overrides: Record<string, unknown> = {}) => ({
    description: TestDataGenerators.uniqueName('Test Direct Cost'),
    cost_code: '01-0000',
    amount: TestDataGenerators.randomAmount(),
    date: TestDataGenerators.pastDate(7),
    ...overrides,
  }),
};
