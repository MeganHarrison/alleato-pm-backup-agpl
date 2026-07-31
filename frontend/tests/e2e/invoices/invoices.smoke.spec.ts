import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const PROJECT_ID = Number(process.env.E2E_PROJECT_ID ?? "67");
const BASE = `/${PROJECT_ID}`;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for real DB E2E tests.",
  );
}

const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

let sharedContractId: number | null = null;
let createdFallbackContractId: number | null = null;
let createdFallbackClientId: number | null = null;

interface SeededInvoice {
  id: number;
  invoiceNumber: string;
}

async function ensureContractForProject(projectId: number): Promise<number> {
  const existing = await admin
    .from("contracts")
    .select("id")
    .eq("project_id", projectId)
    .order("id", { ascending: true })
    .limit(1);

  if (existing.error) {
    throw existing.error;
  }
  if (existing.data && existing.data.length > 0) {
    return existing.data[0].id as number;
  }

  const clientInsert = await admin
    .from("clients")
    .insert({
      name: `E2E Invoice Client ${Date.now()}`,
      status: "active",
    })
    .select("id")
    .single();

  if (clientInsert.error || !clientInsert.data) {
    throw new Error(
      `Failed to create fallback client: ${clientInsert.error?.message}`,
    );
  }

  createdFallbackClientId = clientInsert.data.id as number;

  const contractInsert = await admin
    .from("contracts")
    .insert({
      project_id: projectId,
      client_id: createdFallbackClientId,
      title: `E2E Invoice Contract ${Date.now()}`,
      contract_number: `E2E-CON-${Date.now()}`,
      status: "draft",
      executed: false,
      original_contract_amount: 10000,
    })
    .select("id")
    .single();

  if (contractInsert.error || !contractInsert.data) {
    throw new Error(
      `Failed to create fallback contract: ${contractInsert.error?.message}`,
    );
  }

  createdFallbackContractId = contractInsert.data.id as number;
  return createdFallbackContractId;
}

async function seedOwnerInvoice(
  contractId: number,
  testKey: string,
  status: "draft" | "submitted" = "draft",
): Promise<SeededInvoice> {
  const invoiceNumber = `INV-E2E-${testKey}`;

  const invoiceInsert = await admin
    .from("owner_invoices")
    .insert({
      contract_id: contractId,
      invoice_number: invoiceNumber,
      status,
      period_start: "2026-02-01",
      period_end: "2026-02-28",
    })
    .select("id, invoice_number")
    .single();

  if (invoiceInsert.error || !invoiceInsert.data) {
    throw new Error(
      `Failed to seed owner invoice: ${invoiceInsert.error?.message}`,
    );
  }

  const invoiceId = invoiceInsert.data.id as number;
  const lineItemsInsert = await admin.from("owner_invoice_line_items").insert([
    {
      invoice_id: invoiceId,
      description: `Labor ${testKey}`,
      category: "Labor",
      approved_amount: 1000,
    },
    {
      invoice_id: invoiceId,
      description: `Materials ${testKey}`,
      category: "Materials",
      approved_amount: 250,
    },
  ]);

  if (lineItemsInsert.error) {
    throw new Error(
      `Failed to seed owner invoice line items: ${lineItemsInsert.error.message}`,
    );
  }

  return {
    id: invoiceId,
    invoiceNumber,
  };
}

async function deleteSeededInvoice(invoiceId: number): Promise<void> {
  const deleteLines = await admin
    .from("owner_invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId);
  if (deleteLines.error) {
    throw new Error(
      `Failed deleting invoice line items ${invoiceId}: ${deleteLines.error.message}`,
    );
  }

  const deleteInvoice = await admin
    .from("owner_invoices")
    .delete()
    .eq("id", invoiceId);
  if (deleteInvoice.error) {
    throw new Error(
      `Failed deleting invoice ${invoiceId}: ${deleteInvoice.error.message}`,
    );
  }
}

test.use({
  storageState: "./tests/.auth/user.json",
});

test.describe("Invoices UI (real DB)", () => {
  test.describe.configure({ retries: 1 });

  test.beforeAll(async () => {
    sharedContractId = await ensureContractForProject(PROJECT_ID);
  });

  test.afterAll(async () => {
    if (createdFallbackContractId) {
      await admin.from("contracts").delete().eq("id", createdFallbackContractId);
    }
    if (createdFallbackClientId) {
      await admin.from("clients").delete().eq("id", createdFallbackClientId);
    }
  });

  test("list page shows seeded owner invoice from database", async ({ page }) => {
    if (!sharedContractId) {
      test.fail(true, "No contract available for invoice seeding.");
      return;
    }

    const testKey = randomUUID().slice(0, 8).toUpperCase();
    const seeded = await seedOwnerInvoice(sharedContractId, testKey);

    try {
      await page.goto(`${BASE}/invoicing`);
      await page.waitForLoadState("domcontentloaded");

      await expect(page.getByRole("heading", { name: "Invoicing" })).toBeVisible();
      await expect(
        page.getByRole("table").getByText(seeded.invoiceNumber).first(),
      ).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("table").getByText("$1,250.00").first()).toBeVisible();
    } finally {
      await deleteSeededInvoice(seeded.id);
    }
  });

  test("detail page shows seeded line items and totals from database", async ({
    page,
  }) => {
    if (!sharedContractId) {
      test.fail(true, "No contract available for invoice seeding.");
      return;
    }

    const testKey = randomUUID().slice(0, 8).toUpperCase();
    const seeded = await seedOwnerInvoice(sharedContractId, testKey);

    try {
      await page.goto(`${BASE}/invoicing/${seeded.id}`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForResponse(
        (response) =>
          response.url().includes(
            `/api/projects/${PROJECT_ID}/invoicing/owner/${seeded.id}`,
          ) && response.status() === 200,
        { timeout: 30000 },
      );

      await expect(
        page.getByText(seeded.invoiceNumber).first(),
      ).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(`Labor ${testKey}`)).toBeVisible();
      await expect(page.getByText(`Materials ${testKey}`)).toBeVisible();
      await expect(page.getByText("$1,250.00")).toBeVisible();
    } finally {
      await deleteSeededInvoice(seeded.id);
    }
  });

  test("submit and approve actions persist invoice status in database", async ({
    page,
  }) => {
    if (!sharedContractId) {
      test.fail(true, "No contract available for invoice seeding.");
      return;
    }

    const testKey = randomUUID().slice(0, 8).toUpperCase();
    const seeded = await seedOwnerInvoice(sharedContractId, testKey, "draft");

    try {
      await page.goto(`${BASE}/invoicing/${seeded.id}`);
      await page.waitForLoadState("domcontentloaded");

      await expect(
        page.getByRole("button", { name: "Submit for Approval" }),
      ).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: "Submit for Approval" }).click();

      await expect(page.getByRole("button", { name: "Approve" })).toBeVisible({
        timeout: 10000,
      });

      await expect
        .poll(async () => {
          const { data, error } = await admin
            .from("owner_invoices")
            .select("status, submitted_at")
            .eq("id", seeded.id)
            .single();
          if (error) {
            throw error;
          }
          return data;
        })
        .toMatchObject({
          status: "submitted",
        });

      await page.getByRole("button", { name: "Approve" }).click();

      await expect
        .poll(async () => {
          const { data, error } = await admin
            .from("owner_invoices")
            .select("status, approved_at")
            .eq("id", seeded.id)
            .single();
          if (error) {
            throw error;
          }
          return data;
        })
        .toMatchObject({
          status: "approved",
        });
    } finally {
      await deleteSeededInvoice(seeded.id);
    }
  });
});
