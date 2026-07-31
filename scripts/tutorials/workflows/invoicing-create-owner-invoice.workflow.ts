import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface CreateOwnerInvoiceData extends TutorialSeedData {
  projectId: number;
  primeContractId: string;
  invoiceNumber: string;
  billingPeriod: string;
  description: string;
  retentionPercent: string;
  costCode: string;
  lineDescription: string;
  contractAmount: string;
  previouslyBilled: string;
  thisMonthAmount: string;
  submitWorkflow: boolean;
}

export default defineTutorial<CreateOwnerInvoiceData>({
  id: "invoicing.create-owner-invoice",
  title: "Create an owner invoice",
  module: "invoicing",
  slug: "create-an-owner-invoice",
  description:
    "Create an owner invoice against a prime contract with invoice details, SOV line items, retention, and billing totals.",
  dataPath: "./invoicing-create-owner-invoice.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const createRoute = `/${data.projectId}/invoices/new?tab=owner&contractType=prime&contractId=${encodeURIComponent(data.primeContractId)}`;

    await tutorial.step(
      {
        title: "Open the owner invoice form",
        instruction:
          "Open Invoicing and start a new owner invoice so the New Invoice form opens on the owner billing flow.",
        expected: "The New Invoice page opens with owner invoice fields and a prime contract selected.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Invoice Information',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/invoices/new", "Open the owner invoice form");
      },
    );

    await tutorial.step(
      {
        title: "Enter the invoice information",
        instruction:
          "Enter the Invoice Number and Billing Period, confirm Contract Type is Prime Contract, and verify the owner contract is selected.",
        expected: "The invoice header is tied to the correct contract and billing period.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Invoice Information',
      },
      async () => {
        await tutorial.requireFillByLabel(/invoice number/i, data.invoiceNumber);
        await tutorial.requireFillByLabel(/billing period/i, data.billingPeriod);
        await tutorial.selectFirstComboboxOption(/contract type/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Set dates, status, and notes",
        instruction:
          "Review the Invoice Date and Due Date, choose the status, and add any notes for the owner billing package.",
        expected: "The invoice timing and status are visible before line items are entered.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Invoice Information',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/status/i).catch(() => undefined);
        await tutorial.fillByLabel(/description/i, data.description).catch(() => undefined);
        await tutorial.fillByLabel(/retention %/i, data.retentionPercent).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Enter the invoice line item values",
        instruction:
          "Enter the Cost Code, Description, Contract amount, Previously billed amount, and This Month amount for the owner billing line item.",
        expected: "The invoice line item calculates current billing, percent complete, retention, and net due.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Invoice Line Items',
      },
      async () => {
        // The contract SOV loads asynchronously after the route has painted.
        // Use its first editable row once loaded; appending a row while the SOV
        // response is in flight can be overwritten by the loading state.
        await page.waitForFunction(
          () => document.querySelectorAll('input[placeholder="01-000"]').length > 1,
          undefined,
          { timeout: 15_000 },
        );
        const lineItemRow = page
          .getByPlaceholder("01-000")
          .first()
          .locator("xpath=ancestor::tr");

        const costCode = lineItemRow.getByPlaceholder("01-000");
        const description = lineItemRow.getByPlaceholder(/line item description/i);
        await costCode.fill(data.costCode);
        await description.fill(data.lineDescription);
        // The row contains five ordered inputs: cost code, description,
        // contract amount, previously billed, and this-month amount. The
        // latter two are native number inputs while NumberInput uses text.
        const values = lineItemRow.locator("input");
        await values.nth(2).fill(data.contractAmount);
        await values.nth(3).fill(data.previouslyBilled);
        await values.nth(4).fill(data.thisMonthAmount);

        for (const [label, field, expected] of [
          ["cost code", costCode, data.costCode],
          ["description", description, data.lineDescription],
        ] as const) {
          const actual = await field.inputValue();
          if (actual !== expected) {
            throw new Error(
              `Owner invoice line-item ${label} assertion failed. Expected ${expected}; received ${actual}.`,
            );
          }
        }
        for (const [index, expected] of [
          data.contractAmount,
          data.previouslyBilled,
          data.thisMonthAmount,
        ].entries()) {
          const actual = await values.nth(index + 2).inputValue();
          if (Number.parseFloat(actual.replace(/,/g, "")) !== Number(expected)) {
            throw new Error(
              `Owner invoice line-item value assertion failed at index ${index}. Expected ${expected}; received ${actual}.`,
            );
          }
        }
      },
    );

    await tutorial.step(
      {
        title: "Review the invoice summary",
        instruction:
          "Review the Invoice Summary to confirm contract amount, this-month billing, retention, and net due before saving.",
        expected: "The summary reflects the values entered in the invoice line items.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Invoice Summary',
      },
      async () => {
        await tutorial.scrollToText(/invoice summary/i);
      },
    );

    await tutorial.step(
      {
        title: "Create the owner invoice",
        instruction:
          "Select Create Invoice to save the owner invoice. Tutorial runs stay in preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The owner invoice is saved and opens on the invoice detail page."
          : "The completed invoice is ready to save without creating demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create Invoice")',
      },
      async () => {
        const button = page.getByRole("button", { name: /create invoice/i }).first();
        await button
          .evaluate((element) => {
            element.scrollIntoView({ block: "center", inline: "nearest" });
          })
          .catch(() => undefined);
        if (data.submitWorkflow) {
          await page.getByRole("button", { name: /create invoice/i }).click().catch(() => undefined);
        }
      },
    );
  },
});
