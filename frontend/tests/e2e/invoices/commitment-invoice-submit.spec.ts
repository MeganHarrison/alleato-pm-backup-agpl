import { expect, test } from "@playwright/test";

/**
 * REGRESSION GUARD — commitment invoices must reach the subcontractor endpoint.
 *
 * The "New Invoice" form (/{projectId}/invoices/new) offers two contract types.
 * The `commitment` branch used to POST to /api/invoices, whose Zod schema silently
 * stripped commitment_id, the billing period, due date, retention and net amount,
 * sent no line items at all, and wrote the row into the Acumatica AR mirror table.
 * The user saw a success toast and a redirect while the invoice quietly vanished.
 *
 * These tests fail if anyone repoints that branch at an endpoint that cannot store
 * a commitment invoice, or drops the commitment link / line items from the payload.
 *
 * The request is intercepted and fulfilled rather than executed, so the guard runs
 * fast and leaves no rows behind.
 */

const projectId = process.env.E2E_PROJECT_ID ?? "67";
const newInvoiceUrl = `/${projectId}/invoices/new`;

/** Endpoint that cannot persist a commitment invoice — the original bug. */
const FORBIDDEN_ENDPOINT = /\/api\/invoices(\?|$)/;
/** Endpoint that can. */
const SUBCONTRACTOR_ENDPOINT = /\/api\/projects\/\d+\/invoicing\/subcontractor\/invoices/;

async function selectCommitmentContractType(page: import("@playwright/test").Page) {
  const contractType = page.getByRole("combobox", { name: /contract type/i });
  await contractType.click();
  await page.getByRole("option", { name: /commitment\/subcontract/i }).click();
}

async function pickFirstOption(
  page: import("@playwright/test").Page,
  name: RegExp,
): Promise<boolean> {
  const combo = page.getByRole("combobox", { name }).first();
  await combo.click();
  const option = page.getByRole("option").first();
  if (!(await option.isVisible().catch(() => false))) {
    await page.keyboard.press("Escape");
    return false;
  }
  await option.click();
  return true;
}

test.describe("Commitment invoice submission contract", () => {
  test("posts to the subcontractor endpoint, never to /api/invoices", async ({ page }) => {
    let subcontractorPayload: Record<string, unknown> | null = null;
    let hitForbiddenEndpoint = false;

    await page.route(SUBCONTRACTOR_ENDPOINT, async (route) => {
      subcontractorPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: 999999 } }),
      });
    });

    await page.route(FORBIDDEN_ENDPOINT, async (route) => {
      if (route.request().method() === "POST") hitForbiddenEndpoint = true;
      await route.continue();
    });

    await page.goto(newInvoiceUrl);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("textbox", { name: /invoice number/i }).fill(`GUARD-${Date.now()}`);
    await selectCommitmentContractType(page);

    const hasBillingPeriod = await pickFirstOption(page, /billing period/i);
    const hasCommitment = await pickFirstOption(page, /^commitment/i);

    test.skip(
      !hasBillingPeriod || !hasCommitment,
      `Project ${projectId} needs at least one billing period and one commitment to run this guard.`,
    );

    await page.getByRole("button", { name: /create invoice|save invoice|submit/i }).first().click();

    await expect
      .poll(() => subcontractorPayload !== null, {
        message: "commitment invoice should POST to the subcontractor invoices endpoint",
        timeout: 15_000,
      })
      .toBe(true);

    expect(
      hitForbiddenEndpoint,
      "commitment invoices must not POST to /api/invoices — that route drops commitment_id and writes to acumatica_ar_invoices",
    ).toBe(false);

    const payload = subcontractorPayload as unknown as Record<string, unknown>;

    // The commitment must be linked through exactly one of the two FK columns.
    const hasSubcontract = Boolean(payload.subcontract_id);
    const hasPurchaseOrder = Boolean(payload.purchase_order_id);
    expect(
      hasSubcontract !== hasPurchaseOrder,
      "payload must carry exactly one of subcontract_id / purchase_order_id",
    ).toBe(true);

    // Fields the old endpoint silently discarded.
    expect(payload.billing_period_id, "billing period must survive submission").toBeTruthy();
    expect(payload.invoice_number, "invoice number must survive submission").toBeTruthy();
    expect(payload.period_start, "period start must survive submission").toBeTruthy();
    expect(payload.period_end, "period end must survive submission").toBeTruthy();

    // Line items were never sent at all under the old path.
    expect(Array.isArray(payload.line_items), "line_items must be an array").toBe(true);
    expect(
      (payload.line_items as unknown[]).length,
      "the schedule of values must be submitted with the invoice",
    ).toBeGreaterThan(0);

    const firstLine = (payload.line_items as Array<Record<string, unknown>>)[0];
    for (const key of [
      "scheduled_value",
      "work_completed_previous",
      "work_completed_period",
      "retainage_pct",
    ]) {
      expect(firstLine, `line item must include ${key}`).toHaveProperty(key);
    }
  });
});
