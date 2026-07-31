import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface CreatePcoData extends TutorialSeedData {
  amount: string;
  changeReason: string;
  description: string;
  location: string;
  number: string;
  projectId: number;
  reference: string;
  requestReceivedFrom: string;
  scheduleImpact: string;
  submitWorkflow: boolean;
  title: string;
}

export default defineTutorial<CreatePcoData>({
  id: "commitments.create-pco",
  title: "Create a commitment change order (PCO)",
  module: "commitments",
  slug: "commitments-create-pco",
  description:
    "Price a change against a subcontract or purchase order by creating a potential change order on the commitment.",
  dataPath: "./commitments-create-pco.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const createRoute = `/${data.projectId}/commitment-pcos/new`;

    await tutorial.step(
      {
        title: "Start a new PCO from the commitment",
        instruction:
          "From the commitment's Change Orders tab, start a new potential change order. The form opens as Create Potential Change Order with the Contract Information (Contract Company and the linked Contract) shown read-only.",
        expected:
          "The Create Potential Change Order form opens, pre-filled with the parent commitment's company and contract.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'form, text=Contract Information',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/commitment-pcos/new", "Start a new PCO from the commitment");
      },
    );

    await tutorial.step(
      {
        title: "Complete General Information",
        instruction:
          "In General Information, the # and Title fields are required. The # is prefilled with the next number, which you can keep or replace. Set the Status (defaults to Draft) and optionally a Change Reason.",
        expected: "A number and title are entered and a status is selected.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name="number"], [name="title"]',
      },
      async () => {
        await tutorial.fillByLabel(/^#|number/i, data.number);
        await tutorial.fillByLabel(/^title/i, data.title);
        await tutorial.selectFirstComboboxOption(/change reason/i);
      },
    );

    await tutorial.step(
      {
        title: "Enter the change amount",
        instruction:
          "Enter the Amount ($) for the change. Optionally record Request Received From and a Description of the change.",
        expected: "The amount and any descriptive details are captured on the PCO.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name="amount"]',
      },
      async () => {
        await tutorial.fillByLabel(/amount/i, data.amount);
        await tutorial.fillByLabel(/request received from/i, data.requestReceivedFrom);
        await tutorial.fillByLabel(/description/i, data.description);
      },
    );

    await tutorial.step(
      {
        title: "Add dates and details",
        instruction:
          "In Dates & Details, fill in only the relevant fields: Due Date, Signed Change Order Received Date, Schedule Impact (days), Location, and Reference.",
        expected: "The dates and tracking details that apply to this change are recorded.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Dates & Details',
      },
      async () => {
        await tutorial.fillByLabel(/schedule impact/i, data.scheduleImpact);
        await tutorial.fillByLabel(/location/i, data.location);
        await tutorial.fillByLabel(/reference/i, data.reference);
      },
    );

    await tutorial.step(
      {
        title: "Set the flags",
        instruction:
          "Turn on any of Private, Executed, Field Change, or Paid in Full as appropriate for this change order.",
        expected: "The flags reflect the change order's state.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Private, text=Executed, text=Field Change, text=Paid in Full',
      },
      async () => {
        await page
          .getByText(/field change|paid in full/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Create the PCO",
        instruction: "Select Create to save the potential change order.",
        expected:
          "A confirmation appears and you return to the commitment's Change Orders tab with the new PCO listed.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("button", { name: /^create$/i })
            .first()
            .click()
            .catch(() => undefined);
        }
      },
    );
  },
});
