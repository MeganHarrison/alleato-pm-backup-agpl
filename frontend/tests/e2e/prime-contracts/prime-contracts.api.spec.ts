import { expect, test, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { join } from 'node:path';

import { createAuthenticatedRequestContext } from '../../helpers/api-auth';

/**
 * E2E Tests for Prime Contracts API Routes
 * Tests CRUD operations via REST API endpoints
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const storageStatePath = join(__dirname, '../..', '.auth/user.json');
const appUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Prime Contracts API CRUD', () => {
  let supabase: ReturnType<typeof createClient>;
  let supabaseAdmin: ReturnType<typeof createClient>;
  let testProjectId: number;
  let testUserId: string;
  let createdContractIds: string[] = [];
  let apiContext: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await createAuthenticatedRequestContext(
      playwright,
      storageStatePath,
      appUrl,
    );

    supabase = createClient(supabaseUrl, supabaseAnonKey);
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      });

    if (authError) throw authError;
    if (!authData.user || !authData.session) {
      throw new Error('No user or session returned from authentication');
    }

    testUserId = authData.user.id;

    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('id')
      .limit(1);

    if (error) throw error;
    if (!projects || projects.length === 0) {
      throw new Error('No test project found');
    }
    testProjectId = projects[0].id;

    await supabaseAdmin
      .from('project_members')
      .upsert(
        {
          project_id: testProjectId,
          user_id: testUserId,
          access: 'admin',
        },
        {
          onConflict: 'project_id,user_id',
        },
      );
  });

  test.afterAll(async () => {
    if (createdContractIds.length > 0) {
      await supabaseAdmin
        .from('prime_contracts')
        .delete()
        .in('id', createdContractIds);
    }

    await apiContext.dispose();
  });

  test('GET /api/projects/[id]/contracts should return 200 with array', async () => {
    const response = await apiContext.get(
      `/api/projects/${testProjectId}/contracts`,
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('POST /api/projects/[id]/contracts should create contract and return 201', async () => {
    const contractData = {
      contract_number: `PC-TEST-${Date.now()}`,
      title: 'Test Prime Contract',
      original_contract_value: 100000,
      revised_contract_value: 100000,
      status: 'draft',
      retention_percentage: 10,
    };

    const response = await apiContext.post(
      `/api/projects/${testProjectId}/contracts`,
      {
        data: contractData,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.contract_number).toBe(contractData.contract_number);
    expect(data.title).toBe(contractData.title);
    expect(data.original_contract_value).toBe(contractData.original_contract_value);
    expect(data.status).toBe('draft');
    expect(data.project_id).toBe(testProjectId);
    expect(data.created_by).toBe(testUserId);

    createdContractIds.push(data.id);
  });

  test('POST should return 400 for invalid data (missing required fields)', async () => {
    const invalidData = {
      title: 'Missing contract number',
    };

    const response = await apiContext.post(
      `/api/projects/${testProjectId}/contracts`,
      {
        data: invalidData,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation error');
    expect(data.details).toBeDefined();
    expect(Array.isArray(data.details)).toBe(true);
  });

  test('POST should return 400 for duplicate contract_number in same project', async () => {
    const contractData = {
      contract_number: `PC-DUPLICATE-${Date.now()}`,
      title: 'First Contract',
      original_contract_value: 50000,
    };

    const firstResponse = await apiContext.post(
      `/api/projects/${testProjectId}/contracts`,
      {
        data: contractData,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(firstResponse.status()).toBe(201);
    const firstData = await firstResponse.json();
    createdContractIds.push(firstData.id);

    const secondResponse = await apiContext.post(
      `/api/projects/${testProjectId}/contracts`,
      {
        data: contractData,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(secondResponse.status()).toBe(400);

    const errorData = await secondResponse.json();
    expect(errorData.error).toContain('Contract number already exists');
  });

  test('GET /api/projects/[id]/contracts/[contractId] should return 200 with contract data', async () => {
    const contractData = {
      contract_number: `PC-GET-${Date.now()}`,
      title: 'Test Get Contract',
      original_contract_value: 75000,
    };

    const createResponse = await apiContext.post(
      `/api/projects/${testProjectId}/contracts`,
      {
        data: contractData,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const createdContract = await createResponse.json();
    createdContractIds.push(createdContract.id);

    const response = await apiContext.get(
      `/api/projects/${testProjectId}/contracts/${createdContract.id}`,
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(createdContract.id);
    expect(data.contract_number).toBe(contractData.contract_number);
    expect(data.title).toBe(contractData.title);
  });

  test('PUT /api/projects/[id]/contracts/[contractId] should update contract', async () => {
    const contractData = {
      contract_number: `PC-UPDATE-${Date.now()}`,
      title: 'Contract to Update',
      original_contract_value: 90000,
    };

    const createResponse = await apiContext.post(
      `/api/projects/${testProjectId}/contracts`,
      {
        data: contractData,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const createdContract = await createResponse.json();
    createdContractIds.push(createdContract.id);

    const updateData = {
      contract_number: contractData.contract_number,
      title: 'Updated Contract Title',
      description: 'Updated description',
      status: 'draft',
      original_contract_value: 95000,
      revised_contract_value: 95000,
      retention_percentage: 10,
    };

    const updateResponse = await apiContext.put(
      `/api/projects/${testProjectId}/contracts/${createdContract.id}`,
      {
        data: updateData,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(updateResponse.status()).toBe(200);

    const updatedContract = await updateResponse.json();
    expect(updatedContract.title).toBe(updateData.title);
    expect(updatedContract.description).toBe(updateData.description);
    expect(updatedContract.status).toBe(updateData.status);
    expect(updatedContract.original_contract_value).toBe(
      updateData.original_contract_value,
    );
  });

  test('DELETE /api/projects/[id]/contracts/[contractId] should delete contract', async () => {
    const contractData = {
      contract_number: `PC-DELETE-${Date.now()}`,
      title: 'Delete Me',
      original_contract_value: 120000,
    };

    const createResponse = await apiContext.post(
      `/api/projects/${testProjectId}/contracts`,
      {
        data: contractData,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const createdContract = await createResponse.json();

    const deleteResponse = await apiContext.delete(
      `/api/projects/${testProjectId}/contracts/${createdContract.id}`,
    );

    expect(deleteResponse.status()).toBe(200);

    const { data: deletedContract, error } = await supabase
      .from('prime_contracts')
      .select()
      .eq('id', createdContract.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(deletedContract).toBeNull();
  });
});
