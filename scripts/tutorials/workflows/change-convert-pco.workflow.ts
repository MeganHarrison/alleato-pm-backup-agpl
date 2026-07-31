import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface ChangeConvertPcoData extends TutorialSeedData {
  coNumber: string;
  description: string;
  effectiveDate: string;
  projectId: number;
  submitWorkflow: boolean;
  title: string;
}

export default defineTutorial<ChangeConvertPcoData>({
  id: "change.change-convert-pco",
  title: "Convert a PCO into a change order",
  module: "change-management",
  slug: "change-convert-pco",
  description:
    "Turn one or more approved Potential Change Orders (PCOs) into an official, owner-facing change order, recording the workflow as screenshots, Markdown, and manifest data.",
  dataPath: "./change-convert-pco.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const changeOrdersRoute = `/${data.projectId}/change-orders`;
    const newPrimeCoRoute = `/${data.projectId}/change-orders/prime/new`;

    await tutorial.step(
      {
        title: "Confirm the PCOs are ready",
        instruction:
          "A change order must be assembled from PCOs that have been priced and approved. Open the source change events and PCOs and confirm pricing is final, because no further cost edits should happen on an item once it has been approved.",
        expected: "Every PCO you intend to include is approved with final pricing.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'h1, table',
      },
      async () => {
        await tutorial.goto(changeOrdersRoute);
        await tutorial.requireUrl("/change-orders", "Confirm the PCOs are ready");
      },
    );

    await tutorial.step(
      {
        title: "Open the change orders area",
        instruction:
          "Select the project, then open Change Orders from the sidebar. Use the Prime tab for owner change orders and the Commitment tab for subcontract/vendor change orders.",
        expected:
          "The change orders log opens on the correct tab for the contract you are amending.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Prime, text=Commitment, [role="tab"]',
      },
      async () => {
        await tutorial.requireUrl("/change-orders", "Open the change orders area");
      },
    );

    await tutorial.step(
      {
        title: "Start the change order",
        instruction:
          "Start a new change order to open the New Prime Contract Change Order form. Use the Potential Change Orders picker to select the approved PCO(s) to bundle into this change order.",
        expected:
          "The selected PCOs appear on the form and their amounts roll up into the change order total.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Potential Change Orders, form',
      },
      async () => {
        await tutorial.goto(newPrimeCoRoute).catch(() => undefined);
        await tutorial.requireUrl("/change-orders", "Start the change order");
      },
    );

    await tutorial.step(
      {
        title: "Complete the change order header",
        instruction:
          "Enter the CO Number, Title, Description, and Effective Date. Review the line items and the total value pulled from the selected PCOs.",
        expected:
          "The change order header and line items are complete and the total matches the source PCOs.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name="title"], [name="co_number"], text=Effective Date',
      },
      async () => {
        await tutorial.fillByLabel(/co number|number/i, data.coNumber).catch(() => undefined);
        await tutorial.fillByLabel(/^title/i, data.title).catch(() => undefined);
        await tutorial.fillByLabel(/description/i, data.description).catch(() => undefined);
        await tutorial.fillByLabel(/effective date/i, data.effectiveDate).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Save the draft",
        instruction:
          "Set the Amount, Revision, and Status as needed, then save. The change order starts in Draft status for internal preparation. Tutorial runs default to preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "A change order record is created in Draft status."
          : "The completed draft is ready to save without creating demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Save"), button:has-text("Create")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("button", { name: /save|create/i })
            .first()
            .click()
            .catch(() => undefined);
        }
      },
    );

    await tutorial.step(
      {
        title: "Generate the PDF and route for signature",
        instruction:
          "Open the change order record and select Generate PDF to produce the formatted change order with cover sheet, line items, and signature block. Send the PDF to the owner for countersignature.",
        expected:
          "A signed-ready change order PDF is produced and sent to the owner.",
        screenshot: { mode: "fullPage" },
        calloutSelector: 'button:has-text("Generate PDF")',
      },
      async () => {
        await tutorial.requireUrl("/change-orders", "Generate the PDF and route for signature");
      },
    );

    await tutorial.step(
      {
        title: "Approve and close",
        instruction:
          "When the owner signs, advance the status to Approved. The approved amount flows into the Approved Changes column on the budget, the Revised Budget updates on affected cost codes, and the prime contract total updates.",
        expected:
          "The change order is Approved and the budget and prime contract totals reflect the change.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Approved, [name="status"]',
      },
      async () => {
        await tutorial.requireUrl("/change-orders", "Approve and close");
      },
    );
  },
});
