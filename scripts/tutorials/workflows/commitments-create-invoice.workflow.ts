import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface CreateInvoiceData extends TutorialSeedData {
  billingDate: string;
  fromThisPeriod: string;
  invoiceNumber: string;
  materialsStored: string;
  periodEnd: string;
  periodStart: string;
  projectId: number;
  submitWorkflow: boolean;
}

export default defineTutorial<CreateInvoiceData>({
  id: "commitments.create-invoice",
  title: "Create a commitment invoice",
  module: "commitments",
  slug: "commitments-create-invoice",
  description:
    "Create and submit a subcontractor invoice that bills the project against a commitment's schedule of values.",
  dataPath: "./commitments-create-invoice.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const createRoute = `/${data.projectId}/invoices/new`;

    await tutorial.step(
      {
        title: "Start a new invoice",
        instruction:
          "Start a new subcontractor invoice. When you launch it from the commitment, the commitment is already selected; otherwise, in the picker choose the Commitment Type (Subcontract or Purchase Order) and the Contract.",
        expected:
          "The Create New Invoice form opens and the commitment's Schedule of Values loads.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'form, text=Create New Invoice',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/invoices/new", "Start a new invoice");
        await tutorial.selectFirstComboboxOption(/commitment type|contract/i);
      },
    );

    await tutorial.step(
      {
        title: "Enter the invoice header",
        instruction:
          "Fill in Period Start, Period End, and Billing Date. Enter an Invoice # or leave it blank to have one auto-assigned.",
        expected: "The billing period and invoice number are set.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Period Start, text=Billing Date',
      },
      async () => {
        await tutorial.fillByLabel(/period start/i, data.periodStart);
        await tutorial.fillByLabel(/period end/i, data.periodEnd);
        await tutorial.fillByLabel(/billing date/i, data.billingDate);
        await tutorial.fillByLabel(/invoice #|invoice number/i, data.invoiceNumber);
      },
    );

    await tutorial.step(
      {
        title: "Bill the schedule of values",
        instruction:
          "Under Complete Schedule of Values, each SOV line shows its Value and From Previous Application. Enter the amount billed this cycle in From This Period and any Materials Presently Stored for each line.",
        expected: "The line-level and Total rows update to reflect this period's billing.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Complete Schedule of Values',
      },
      async () => {
        await page
          .getByText(/complete schedule of values/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
        await page.getByLabel(/from this period/i).first().fill(data.fromThisPeriod).catch(() => undefined);
        await page
          .getByLabel(/materials presently stored/i)
          .first()
          .fill(data.materialsStored)
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Bill approved change orders",
        instruction:
          "Under Approved Commitment Change Orders, enter From This Period and Materials Presently Stored for any approved change order being billed. Only approved commitment change orders appear here.",
        expected: "Billed change-order amounts roll into the invoice totals.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Approved Commitment Change Orders',
      },
      async () => {
        await page
          .getByText(/approved commitment change orders/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Save a draft (optional)",
        instruction:
          "To keep the invoice in progress, select Save as Draft. Files can be attached after the invoice is saved.",
        expected: "The invoice is saved in Draft status and you can return to it later.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Save as Draft")',
      },
      async () => {
        await page
          .getByRole("button", { name: /save as draft/i })
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Submit for approval",
        instruction: "When the invoice is complete, select Submit.",
        expected:
          "A confirmation appears, the invoice moves to review, and you land on the saved invoice record.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Submit")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("button", { name: /^submit$/i })
            .first()
            .click()
            .catch(() => undefined);
        }
      },
    );
  },
});
