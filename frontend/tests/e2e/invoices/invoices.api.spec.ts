import { expect, test, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { join } from 'node:path';

import { createAuthenticatedRequestContext } from '../../helpers/api-auth';

const projectId = Number(process.env.E2E_PROJECT_ID ?? '67');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const storageStatePath = join(__dirname, '../..', '.auth/user.json');
const appUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Invoicing API', () => {
  let apiContext: APIRequestContext;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const createdInvoiceIds: number[] = [];
  let contractId: number;

  async function ensureContractForProject(): Promise<number> {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('contracts')
      .select('id')
      .eq('project_id', projectId)
      .order('id', { ascending: true })
      .limit(1);

    if (existingError) throw existingError;
    if (existing && existing.length > 0) return Number(existing[0].id);

    throw new Error(`No contract found for project ${projectId}; seed one before running invoicing API tests.`);
  }

  test.beforeAll(async ({ playwright }) => {
    apiContext = await createAuthenticatedRequestContext(playwright, storageStatePath, appUrl);
    contractId = await ensureContractForProject();
  });

  test.afterAll(async () => {
    if (createdInvoiceIds.length > 0) {
      await supabaseAdmin
        .from('owner_invoices')
        .delete()
        .in('id', createdInvoiceIds);
    }

    await apiContext.dispose();
  });

  test('GET /api/projects/[projectId]/invoicing/owner returns invoice list', async () => {
    const response = await apiContext.get(`/api/projects/${projectId}/invoicing/owner`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.data ?? body)).toBe(true);
  });

  test('GET /api/projects/[projectId]/invoicing/billing-periods returns billing periods', async () => {
    const response = await apiContext.get(`/api/projects/${projectId}/invoicing/billing-periods`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.data ?? body)).toBe(true);
  });

  test('POST create + submit owner invoice works end-to-end', async () => {
    const invoiceNumber = `INV-API-${Date.now()}`;

    const createResponse = await apiContext.post(`/api/projects/${projectId}/invoicing/owner`, {
      data: {
        contract_id: contractId,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        billing_period: 'API test period',
        status: 'draft',
        line_items: [
          {
            description: 'API Test Line',
            category: 'Testing',
            approved_amount: 500,
          },
        ],
      },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    const createdInvoiceId = Number(created.data?.id ?? created.id);
    expect(createdInvoiceId).toBeGreaterThan(0);
    createdInvoiceIds.push(createdInvoiceId);

    const submitResponse = await apiContext.post(
      `/api/projects/${projectId}/invoicing/owner/${createdInvoiceId}/submit`,
    );
    expect(submitResponse.status()).toBe(200);
  });
});
