import { test, expect } from '@playwright/test';

test.describe('Team Member Selection', () => {
  test('should display all contacts from global people table when adding team members', async ({ page }) => {
    // Navigate to a project page
    await page.goto('/89/home'); // Alleato Marketing project

    // Wait for page to load
    await page.waitForSelector('text=PROJECT TEAM');

    // Click the Add button in the Project Team section
    const addButton = page.locator('button').filter({ hasText: 'Add' }).first();
    await addButton.click();

    // Wait for the form to appear
    await page.waitForSelector('text=ADD TEAM MEMBER');

    // Click on the member dropdown
    const memberDropdown = page.locator('button[role="combobox"]').filter({ hasText: 'Search members' });
    await memberDropdown.click();

    // Wait for the dropdown to open
    await page.waitForTimeout(500);

    // Check if the API call was made to the correct endpoint
    const contactsApiResponse = page.waitForResponse(
      response => response.url().includes('/api/contacts') && response.status() === 200
    );

    // Trigger the dropdown again to ensure API is called
    await memberDropdown.click();

    // Wait for the API response
    const response = await contactsApiResponse;
    const responseData = await response.json();

    // Log the response for debugging
    console.log('API Response:', responseData);

    // Check that we got data
    expect(responseData.data).toBeDefined();
    expect(Array.isArray(responseData.data)).toBe(true);

    // If there are people in the database, they should be shown in the dropdown
    if (responseData.data.length > 0) {
      // Check that people are visible in the dropdown
      const firstPerson = responseData.data[0];
      const personName = `${firstPerson.first_name} ${firstPerson.last_name}`;

      // Wait for the person to appear in the dropdown
      await expect(page.locator(`text=${personName}`)).toBeVisible({ timeout: 5000 });
    } else {
      // If no people, should show the "Create new contact" link
      await expect(page.locator('text=No members found')).toBeVisible();
      await expect(page.locator('a[href="/directory/contacts"]')).toBeVisible();
    }

    // Check that the "Create new contact" link points to global contacts page
    const createContactLink = page.locator('a[href="/directory/contacts"]');
    if (await createContactLink.isVisible()) {
      expect(await createContactLink.getAttribute('href')).toBe('/directory/contacts');
      expect(await createContactLink.getAttribute('target')).toBe('_blank');
    }
  });

  test('should fetch from /api/contacts endpoint, not project-specific endpoint', async ({ page }) => {
    // Set up request interception to track API calls
    const apiCalls: string[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push(request.url());
      }
    });

    // Navigate to project
    await page.goto('/89/home');
    await page.waitForSelector('text=PROJECT TEAM');

    // Open the add team member form
    const addButton = page.locator('button').filter({ hasText: 'Add' }).first();
    await addButton.click();
    await page.waitForSelector('text=ADD TEAM MEMBER');

    // Click the member dropdown
    const memberDropdown = page.locator('button[role="combobox"]').filter({ hasText: 'Search members' });
    await memberDropdown.click();

    // Wait for API call
    await page.waitForTimeout(1000);

    // Check that the correct API was called
    const contactsCalls = apiCalls.filter(url => url.includes('/api/contacts'));
    const projectPeopleCalls = apiCalls.filter(url => url.includes('/api/projects/') && url.includes('/directory/people'));

    expect(contactsCalls.length).toBeGreaterThan(0);
    expect(projectPeopleCalls.length).toBe(0);

    console.log('API calls made:', {
      contactsEndpoint: contactsCalls,
      projectSpecificEndpoint: projectPeopleCalls
    });
  });
});