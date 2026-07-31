import { expect, Page } from '@playwright/test';

/**
 * Playwright Helper: Project Bootstrap
 *
 * Provides utilities for creating fully-populated test projects
 * via the bootstrap API endpoint.
 */

interface BootstrapOptions {
  name?: string;
  template?: 'warehouse' | 'commercial';
}

interface BootstrappedProject {
  project: {
    id: number;
    name: string;
    'project number': string;
  };
  contract: any;
  budgetCodes: any[];
  budgetLineItems: any[];
  commitment: any;
  changeEvent: any;
  changeOrder: any;
}

/**
 * Creates a fully populated test project via API
 *
 * Usage:
 * ```ts
 * const project = await createTestProject(page);
 * await page.goto(`/${project.project.id}/budget`);
 * ```
 */
export async function createTestProject(
  page: Page,
  options: BootstrapOptions = {},
  requestOverride?: {
    post: (url: string, options?: { data?: unknown }) => Promise<{ ok: () => boolean; status: () => number; text: () => Promise<string>; json: () => Promise<unknown> }>;
  }
): Promise<BootstrappedProject> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const requestClient = requestOverride ?? page.request;

  const response = await requestClient.post(`${baseUrl}/api/projects/bootstrap`, {
    data: options,
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Bootstrap failed: ${response.status()} ${errorText}`);
  }

  const data = (await response.json()) as BootstrappedProject;

  // Verify project was created successfully
  expect(data.project).toBeDefined();
  expect(data.project.id).toBeDefined();
  expect(data.contract).toBeDefined();
  expect(data.budgetCodes.length).toBeGreaterThan(0);

  return data;
}

/**
 * Creates a test project and navigates to it
 *
 * Usage:
 * ```ts
 * const project = await createAndNavigateToProject(page, '/budget');
 * // Now on /{projectId}/budget
 * ```
 */
export async function createAndNavigateToProject(
  page: Page,
  route: string = '/home',
  options: BootstrapOptions = {}
): Promise<BootstrappedProject> {
  const project = await createTestProject(page, options);

  const url = `/${project.project.id}${route}`;
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  return project;
}

/**
 * Cleans up a test project (optional - useful for repeated tests)
 *
 * Note: Supabase CASCADE DELETE should handle cleanup automatically
 * This is provided for explicit cleanup if needed.
 */
export async function deleteTestProject(
  page: Page,
  projectId: number
): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  const response = await page.request.delete(`${baseUrl}/api/projects/${projectId}`);

  // Allow 404 (already deleted) or 200 (successfully deleted)
  expect([200, 404]).toContain(response.status());
}
