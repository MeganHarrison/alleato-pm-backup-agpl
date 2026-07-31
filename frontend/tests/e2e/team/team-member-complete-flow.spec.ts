import { test, expect } from '@playwright/test';

test.describe('Complete Team Member Flow', () => {
  test('should add a team member with role and display correctly', async ({ page }) => {
    // Navigate to a project
    await page.goto('/89/home');

    // Wait for page to load
    await page.waitForSelector('text=PROJECT TEAM');

    // Click the Add button in the Project Team section
    const addButton = page.locator('button').filter({ hasText: 'Add' }).first();
    await addButton.click();

    // Wait for the form to appear
    await page.waitForSelector('text=ADD TEAM MEMBER');

    // Select a role first
    const roleDropdown = page.locator('select').first();
    if (await roleDropdown.isVisible()) {
      await roleDropdown.selectOption('Project Manager');
    } else {
      // If it's a custom dropdown
      const roleButton = page.locator('button').filter({ hasText: 'Select role' });
      await roleButton.click();
      await page.click('text=Project Manager');
    }

    // Click on the member dropdown
    const memberDropdown = page.locator('button[role="combobox"]').filter({ hasText: 'Search members' });
    await memberDropdown.click();

    // Wait for the dropdown to open and contacts to load
    await page.waitForTimeout(500);

    // Select the first contact if available
    const firstContact = page.locator('[role="option"]').first();
    const hasContacts = await firstContact.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasContacts) {
      // Get the contact name before clicking
      const contactText = await firstContact.textContent();
      console.log('Selecting contact:', contactText);

      await firstContact.click();

      // Click Add Member button
      const addMemberButton = page.locator('button').filter({ hasText: 'Add Member' });
      await addMemberButton.click();

      // Wait for the form to close and page to refresh
      await page.waitForTimeout(1000);

      // Verify the team member was added and displayed correctly
      const teamSection = page.locator('text=PROJECT TEAM').locator('..');

      // Check that the member is displayed
      await expect(teamSection).toContainText('Project Manager');

      // Verify it's not showing JSON string
      const teamMemberTexts = await teamSection.locator('p').allTextContents();
      console.log('Team member display texts:', teamMemberTexts);

      // Check that none of the texts contain JSON-like strings
      for (const text of teamMemberTexts) {
        expect(text).not.toContain('{"name"');
        expect(text).not.toContain('"role"');
        expect(text).not.toContain('"contactId"');
      }

      // Verify the role is displayed correctly
      const roleText = await teamSection.locator('text=Project Manager').isVisible();
      expect(roleText).toBeTruthy();
    } else {
      console.log('No contacts available, checking for "Create new contact" link');
      await expect(page.locator('text=No members found')).toBeVisible();
    }
  });

  test('should save team member data correctly to the database', async ({ page }) => {
    // First, clear any existing team members
    const projectId = 89;

    // Navigate to project
    await page.goto(`/${projectId}/home`);
    await page.waitForSelector('text=PROJECT TEAM');

    // Add a team member
    const addButton = page.locator('button').filter({ hasText: 'Add' }).first();
    await addButton.click();
    await page.waitForSelector('text=ADD TEAM MEMBER');

    // Select role
    const roleDropdown = page.locator('[role="combobox"]').filter({ hasText: 'Select role' });
    if (await roleDropdown.isVisible()) {
      await roleDropdown.click();
      await page.click('text=Architect');
    }

    // Select member
    const memberDropdown = page.locator('button[role="combobox"]').filter({ hasText: 'Search members' });
    await memberDropdown.click();
    await page.waitForTimeout(500);

    const firstContact = page.locator('[role="option"]').first();
    if (await firstContact.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstContact.click();

      // Save
      await page.click('button:has-text("Add Member")');
      await page.waitForTimeout(1000);

      // Make API call to verify data structure
      const response = await page.request.get(`/api/projects/${projectId}`);
      const data = await response.json();

      console.log('Team members data:', data.team_members);

      if (data.team_members && data.team_members.length > 0) {
        const lastMemberRaw = data.team_members[data.team_members.length - 1];

        // Parse if it's a string (database stores as string array)
        const lastMember = typeof lastMemberRaw === 'string'
          ? JSON.parse(lastMemberRaw)
          : lastMemberRaw;

        // Check that the parsed member has correct structure
        expect(lastMember).toHaveProperty('name');
        expect(lastMember).toHaveProperty('role');
        expect(lastMember.role).toBe('Architect');

        // Verify it has contactId (not personId)
        expect(lastMember).toHaveProperty('contactId');
        expect(lastMember).not.toHaveProperty('personId');
      }
    }
  });

  test('should navigate to Prime Contracts correctly', async ({ page }) => {
    // Navigate to project home
    await page.goto('/89/home');
    await page.waitForSelector('text=PRIME CONTRACTS');

    // Test Add Contract button
    const addContractButton = page.locator('a[href*="/prime-contracts/new"]').first();
    await expect(addContractButton).toBeVisible();

    // Click and verify it doesn't 404
    await addContractButton.click();
    await page.waitForLoadState('networkidle');

    // Should be on the new prime contract page, not 404
    expect(page.url()).toContain('/prime-contracts/new');
    await expect(page.locator('text=404')).not.toBeVisible();

    // Go back to test View All
    await page.goto('/89/home');
    await page.waitForSelector('text=PRIME CONTRACTS');

    // Test View All link
    const viewAllLink = page.locator('a[href*="/prime-contracts"]').filter({ hasText: 'View all' });
    if (await viewAllLink.isVisible()) {
      await viewAllLink.click();
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/prime-contracts');
      await expect(page.locator('text=404')).not.toBeVisible();
    }
  });
});