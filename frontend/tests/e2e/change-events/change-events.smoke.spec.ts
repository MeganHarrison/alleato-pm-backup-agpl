import { expect, test } from '../../fixtures/index';
import { cleanupChangeEvents } from '../../helpers/cleanup';
import { getAdminClient } from '../../helpers/db';

const projectId = Number(
  process.env.PLAYWRIGHT_PROJECT_ID ?? process.env.NEXT_PUBLIC_TEST_PROJECT_ID ?? '60',
);

const createdIds: string[] = [];

function uniqueNumber() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CE-SMOKE-${Date.now().toString().slice(-6)}-${suffix}`;
}

async function createChangeEvent(project: number, number: string, title: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('change_events')
    .insert({
      project_id: project,
      number,
      title,
      status: 'Open',
      type: 'Owner Change',
      scope: 'TBD',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create test change event: ${error?.message}`);
  }

  createdIds.push(data.id);
  return data.id;
}

test.describe.serial('Change Events Smoke', () => {
  test.afterEach(async () => {
    await cleanupChangeEvents(createdIds);
    createdIds.length = 0;
  });

  test('loads list page and key controls', async ({ page }) => {
    await page.goto(`/${projectId}/change-events`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /change events/i }).first()).toBeVisible();
    await expect(page.getByTestId('change-events-new-button')).toBeVisible();
    await expect(page.getByTestId('change-events-count-all')).toBeVisible();
  });

  test('new form blocks invalid submission', async ({ page }) => {
    await page.goto(`/${projectId}/change-events/new`, { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Create Change Event' }).click();

    await expect(page.getByText('Title is required')).toBeVisible();
  });

  test('create flow persists and opens detail page', async ({ page }) => {
    const number = uniqueNumber();
    const title = `Smoke ${number}`;

    await page.goto(`/${projectId}/change-events/new`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: 'Number' }).fill(number);
    await page.getByRole('textbox', { name: 'Title' }).fill(title);
    await page.getByRole('button', { name: 'Create Change Event' }).click();

    await page.waitForURL(new RegExp(`/${projectId}/change-events/[0-9a-fA-F-]+$`), {
      timeout: 30000,
    });

    const id = page.url().split('/').pop();
    if (id) createdIds.push(id);

    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  });

  test('status tab filters an Open event', async ({ page }) => {
    const number = uniqueNumber();
    const title = `Filter ${number}`;
    await createChangeEvent(projectId, number, title);

    await page.goto(`/${projectId}/change-events`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /^Open\s*\(/ }).click();

    await expect(page.getByRole('cell', { name: title })).toBeVisible();
  });
});
