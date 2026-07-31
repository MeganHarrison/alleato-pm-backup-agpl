import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface ChangeCreateCommitmentPcoData extends TutorialSeedData {
  changeEventId: string;
  changeReason: string;
  commitmentId: string;
  description: string;
  projectId: number;
  scheduleImpactDays: string;
  submitWorkflow: boolean;
  title: string;
}

export default defineTutorial<ChangeCreateCommitmentPcoData>({
  id: "change.change-create-commitment-pco",
  title: "Create a Commitment PCO",
  module: "change-management",
  slug: "change-create-commitment-pco",
  description:
    "Price a change against a subcontract or purchase order as a Commitment PCO, recording the workflow as screenshots, Markdown, and manifest data.",
  dataPath: "./change-create-commitment-pco.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const createRoute = `/${data.projectId}/commitment-pcos/new?changeEventIds=${encodeURIComponent(data.changeEventId)}&commitmentId=${encodeURIComponent(data.commitmentId)}`;

    await tutorial.step(
      {
        title: "Start from a change event",
        instruction:
          "Open Change Events from the sidebar and open the change event that covers this change. Commitment PCOs cannot be created directly — they must begin from a change event. If no change event exists yet, create one first.",
        expected: "The source change event is open.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Source Change Event',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/commitment-pcos/new", "Start from a change event");
      },
    );

    await tutorial.step(
      {
        title: "Add the event to a Commitment PCO",
        instruction:
          "From the selected change event, use the add-to-change-order action and choose to create a Commitment PCO for the subcontractor or vendor. This opens the Create Commitment PCO form with the source change event(s) listed.",
        expected:
          "The Create Commitment PCO form opens, showing the Source Change Event(s).",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Source Change Event',
      },
      async () => {
        await tutorial.requireUrl("/commitment-pcos/new", "Add the event to a Commitment PCO");
      },
    );

    await tutorial.step(
      {
        title: "Select the commitment",
        instruction:
          "Under General Information, choose the Commitment the change is priced against. The Contract Company is determined by the selected commitment and fills in automatically.",
        expected: "The commitment is selected and the contract company is populated.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button[role="combobox"][aria-label="Commitment"]',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/commitment/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Enter the PCO details",
        instruction:
          "Enter a Title for the potential change order. Optionally set the Change Reason and the Schedule Impact (days) if the change affects the schedule.",
        expected: "The PCO has a title and any reason or schedule impact recorded.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'input[name="title"]',
      },
      async () => {
        await tutorial.fillByLabel(/^title/i, data.title).catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/change reason|reason/i).catch(() => undefined);
        await tutorial
          .fillByLabel(/schedule impact/i, data.scheduleImpactDays)
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Describe the change",
        instruction:
          "In the Description field, describe the potential change so the pricing has clear context.",
        expected: "The change is described in full.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'textarea[name="description"]',
      },
      async () => {
        await tutorial.fillByLabel(/description/i, data.description).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Create the PCO",
        instruction:
          "Select Create to save. The Commitment PCO is created against the selected subcontract or PO and linked to its source change event. Tutorial runs default to preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The Commitment PCO is saved and linked to its source change event and commitment."
          : "The completed draft is ready to save without creating demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("button", { name: /^create$/i })
            .click()
            .catch(() => undefined);
        }
      },
    );
  },
});
