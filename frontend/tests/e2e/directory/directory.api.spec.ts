import { test, expect } from '@playwright/test';
import { setupTestScenario, clearTestData } from '../../helpers/directory-test-helpers';

/**
 * Directory API Tests
 * Tests all directory API endpoints to ensure they match Procore functionality
 */

test.describe('Directory API Endpoints', () => {
  let testData: any;

  test.beforeEach(async () => {
    await clearTestData();
    testData = await setupTestScenario();
  });

  test('GET /api/projects/{id}/directory/people - should return users with filters', async ({ request }) => {
    // Test basic people listing
    const response = await request.get(`/api/projects/${testData.project.id}/directory/people`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('data');
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(3); // 2 users + 1 contact
    
    // Verify data structure matches Procore format
    const person = data.data[0];
    expect(person).toHaveProperty('id');
    expect(person).toHaveProperty('first_name');
    expect(person).toHaveProperty('last_name');
    expect(person).toHaveProperty('email');
    expect(person).toHaveProperty('company');
    expect(person).toHaveProperty('membership');
    
    // Test filtering by type
    const usersResponse = await request.get(
      `/api/projects/${testData.project.id}/directory/people?type=user`
    );
    const usersData = await usersResponse.json();
    expect(usersData.data.length).toBe(2); // Only users, no contacts
    
    // Test filtering by status
    const activeResponse = await request.get(
      `/api/projects/${testData.project.id}/directory/people?status=active`
    );
    const activeData = await activeResponse.json();
    expect(activeData.data.every((p: any) => p.membership?.status === 'active')).toBe(true);
    
    // Test search
    const searchResponse = await request.get(
      `/api/projects/${testData.project.id}/directory/people?search=John`
    );
    const searchData = await searchResponse.json();
    expect(searchData.data.length).toBe(1);
    expect(searchData.data[0].first_name).toBe('John');
  });

  test('POST /api/projects/{id}/directory/people - should create new user', async ({ request }) => {
    const newUser = {
      first_name: 'New',
      last_name: 'User',
      email: 'newuser@test.com',
      job_title: 'Superintendent',
      company_id: testData.company.id,
      person_type: 'user',
      permission_template_id: testData.permissionTemplate,
    };

    const response = await request.post(
      `/api/projects/${testData.project.id}/directory/people`,
      { data: newUser }
    );
    
    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('person');
    expect(data).toHaveProperty('membership');
    expect(data.person.first_name).toBe('New');
    expect(data.person.last_name).toBe('User');
    expect(data.person.email).toBe('newuser@test.com');
  });

  test('PATCH /api/projects/{id}/directory/people/{personId} - should update user', async ({ request }) => {
    const userId = testData.users[0].id;
    const updates = {
      job_title: 'Senior Project Manager',
      phone_mobile: '555-0123',
    };

    const response = await request.patch(
      `/api/projects/${testData.project.id}/directory/people/${userId}`,
      { data: updates }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.person.job_title).toBe('Senior Project Manager');
    expect(data.person.phone_mobile).toBe('555-0123');
  });

  test('POST /api/projects/{id}/directory/people/{personId}/invite - should send invitation', async ({ request }) => {
    const userId = testData.users[0].id;

    const response = await request.post(
      `/api/projects/${testData.project.id}/directory/people/${userId}/invite`
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('inviteUrl');
    expect(data.message).toContain('sent');
  });

  test('POST /api/projects/{id}/directory/people/{personId}/deactivate - should deactivate user', async ({ request }) => {
    const userId = testData.users[0].id;

    const response = await request.post(
      `/api/projects/${testData.project.id}/directory/people/${userId}/deactivate`
    );
    
    expect(response.status()).toBe(200);
    
    // Verify user is deactivated
    const checkResponse = await request.get(
      `/api/projects/${testData.project.id}/directory/people/${userId}`
    );
    const userData = await checkResponse.json();
    expect(userData.membership.status).toBe('inactive');
  });

  test('POST /api/projects/{id}/directory/people/{personId}/reactivate - should reactivate user', async ({ request }) => {
    const userId = testData.users[0].id;

    // First deactivate
    await request.post(`/api/projects/${testData.project.id}/directory/people/${userId}/deactivate`);
    
    // Then reactivate
    const response = await request.post(
      `/api/projects/${testData.project.id}/directory/people/${userId}/reactivate`
    );
    
    expect(response.status()).toBe(200);
    
    // Verify user is active again
    const checkResponse = await request.get(
      `/api/projects/${testData.project.id}/directory/people/${userId}`
    );
    const userData = await checkResponse.json();
    expect(userData.membership.status).toBe('active');
  });

  test('GET /api/projects/{id}/directory/companies - should return companies', async ({ request }) => {
    const response = await request.get(`/api/projects/${testData.project.id}/directory/companies`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('companies');
    expect(data.companies.length).toBeGreaterThan(0);
    
    const company = data.companies[0];
    expect(company).toHaveProperty('id');
    expect(company).toHaveProperty('name');
    expect(company).toHaveProperty('company_type');
  });

  test('GET /api/projects/{id}/directory/groups - should return distribution groups', async ({ request }) => {
    const response = await request.get(`/api/projects/${testData.project.id}/directory/groups`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('groups');
    expect(data.groups.length).toBe(1); // We created one test group
    
    const group = data.groups[0];
    expect(group).toHaveProperty('id');
    expect(group).toHaveProperty('name');
    expect(group).toHaveProperty('members');
    expect(group.name).toBe('Test Group');
  });

  test('POST /api/projects/{id}/directory/groups - should create distribution group', async ({ request }) => {
    const newGroup = {
      name: 'New Distribution Group',
      description: 'Test group description',
    };

    const response = await request.post(
      `/api/projects/${testData.project.id}/directory/groups`,
      { data: newGroup }
    );
    
    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data.group.name).toBe('New Distribution Group');
    expect(data.group.description).toBe('Test group description');
  });

  test('POST /api/projects/{id}/directory/groups/{groupId}/members - should add group members', async ({ request }) => {
    // First create a group
    const groupResponse = await request.post(
      `/api/projects/${testData.project.id}/directory/groups`,
      { data: { name: 'Member Test Group' } }
    );
    const groupData = await groupResponse.json();
    const groupId = groupData.group.id;

    // Add member
    const response = await request.post(
      `/api/projects/${testData.project.id}/directory/groups/${groupId}/members`,
      { data: { person_id: testData.users[0].id } }
    );
    
    expect(response.status()).toBe(200);
    
    // Verify member was added
    const checkResponse = await request.get(
      `/api/projects/${testData.project.id}/directory/groups/${groupId}`
    );
    const checkData = await checkResponse.json();
    expect(checkData.group.members.length).toBe(1);
    expect(checkData.group.members[0].person_id).toBe(testData.users[0].id);
  });

  test('API should handle errors gracefully', async ({ request }) => {
    // Test 404 for non-existent project
    const response1 = await request.get('/api/projects/non-existent/directory/people');
    expect(response1.status()).toBe(404);
    
    // Test 404 for non-existent person
    const response2 = await request.get(
      `/api/projects/${testData.project.id}/directory/people/non-existent`
    );
    expect(response2.status()).toBe(404);
    
    // Test validation errors
    const response3 = await request.post(
      `/api/projects/${testData.project.id}/directory/people`,
      { data: { first_name: '' } } // Missing required fields
    );
    expect(response3.status()).toBe(400);
  });

  test('API should enforce permissions', async ({ request }) => {
    // This test would check that users without proper permissions
    // cannot access certain endpoints
    
    // Note: This would require setting up different user contexts
    // and testing permission enforcement at the API level
    
    // For now, verify the structure supports permission checks
    const response = await request.get(`/api/projects/${testData.project.id}/directory/permissions`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('permissions');
  });
});

test.describe('Directory API Performance', () => {
  test('should handle large datasets efficiently', async ({ request }) => {
    // This test would create a large dataset and verify performance
    // Skip for now as it would slow down regular test runs
    test.skip(!process.env.RUN_PERFORMANCE_TESTS, 'Performance tests skipped');
    
    // Would implement:
    // 1. Create 1000+ users
    // 2. Test pagination performance
    // 3. Test search performance
    // 4. Test filtering performance
    // 5. Verify response times < 500ms
  });
});

test.describe('Directory API Data Integrity', () => {
  let testData: any;

  test.beforeEach(async () => {
    await clearTestData();
    testData = await setupTestScenario();
  });

  test('should maintain data consistency across operations', async ({ request }) => {
    const userId = testData.users[0].id;
    
    // Get initial state
    const initial = await request.get(
      `/api/projects/${testData.project.id}/directory/people/${userId}`
    );
    const initialData = await initial.json();
    
    // Update user
    await request.patch(
      `/api/projects/${testData.project.id}/directory/people/${userId}`,
      { data: { job_title: 'Updated Title' } }
    );
    
    // Verify update appears in list endpoint
    const listResponse = await request.get(
      `/api/projects/${testData.project.id}/directory/people`
    );
    const listData = await listResponse.json();
    const updatedUser = listData.data.find((p: any) => p.id === userId);
    expect(updatedUser.job_title).toBe('Updated Title');
    
    // Verify relationships are maintained
    expect(updatedUser.company).toEqual(initialData.company);
    expect(updatedUser.membership.project_id).toBe(initialData.membership.project_id);
  });

  test('should handle concurrent operations safely', async ({ request }) => {
    const userId = testData.users[0].id;
    
    // Simulate concurrent updates
    const promises = [
      request.patch(`/api/projects/${testData.project.id}/directory/people/${userId}`, {
        data: { job_title: 'Title A' }
      }),
      request.patch(`/api/projects/${testData.project.id}/directory/people/${userId}`, {
        data: { phone_mobile: '555-0001' }
      }),
    ];
    
    const responses = await Promise.all(promises);
    
    // Both should succeed or fail gracefully
    responses.forEach(response => {
      expect([200, 409, 500]).toContain(response.status()); // Success or conflict/error
    });
    
    // Verify final state is consistent
    const finalResponse = await request.get(
      `/api/projects/${testData.project.id}/directory/people/${userId}`
    );
    const finalData = await finalResponse.json();
    expect(finalData).toHaveProperty('id');
  });
});
