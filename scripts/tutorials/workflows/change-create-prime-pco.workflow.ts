import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface ChangeCreatePrimePcoData extends TutorialSeedData {
  amount: string;
  changeEventId: string;
  description: string;
  primeContractId: string;
  projectId: number;
  scheduleImpactDays: string;
  submitWorkflow: boolean;
  title: string;
}

export default defineTutorial<ChangeCreatePrimePcoData>({
  id: "change.change-create-prime-pco",
  title: "Create a Prime PCO",
  module: "change-management",
  slug: "change-create-prime-pco",
  description:
    "Price a change against the owner (prime) contract as a Prime Contract PCO, recording the workflow as screenshots, Markdown, and manifest data.",
  dataPath: "./change-create-prime-pco.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const createRoute = `/${data.projectId}/prime-contract-pcos/new?changeEventIds=${encodeURIComponent(data.changeEventId)}&contractId=${encodeURIComponent(data.primeContractId)}`;

    await tutorial.step(
      {
        title: "Start from an approved change event",
        instruction:
          "Open Change Events from the sidebar and open the change event for this change. Use the add-to action and choose Add to Prime Contract PCO to begin a prime-side potential change order for owner review.",
        expected: "The change event's add-to-Prime-Contract-PCO flow is started.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Source Change Event',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/prime-contract-pcos/new", "Start from an approved change event");
      },
    );

    await tutorial.step(
      {
        title: "Open the new Prime PCO form",
        instruction:
          "The New Prime Contract PCO form opens with the Source Change Event(s) listed. The PCO Number is auto-generated on save.",
        expected:
          "The New Prime Contract PCO form opens with the source change event(s) shown.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Source Change Event',
      },
      async () => {
        await tutorial.requireUrl("/prime-contract-pcos/new", "Open the new Prime PCO form");
      },
    );

    await tutorial.step(
      {
        title: "Enter the overview",
        instruction:
          "Under Overview, enter a Title and select the Contract (the prime contract being amended). The Contract Company auto-fills from the selected contract.",
        expected: "The PCO has a title and is tied to the correct prime contract.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'input[name="title"]',
      },
      async () => {
        await tutorial.fillByLabel(/^title/i, data.title).catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/^contract/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Describe the change",
        instruction:
          "Enter the Description of the change order so the owner has clear context for the request.",
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
        title: "Set schedule and amount",
        instruction:
          "Enter the Schedule Impact (days) if the change extends the schedule, and set the Amount for the change.",
        expected: "The PCO records its cost amount and any schedule impact.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'input[name="amount"]',
      },
      async () => {
        await tutorial
          .fillByLabel(/schedule impact/i, data.scheduleImpactDays)
          .catch(() => undefined);
        await tutorial.fillByLabel(/amount/i, data.amount).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Attach supporting documents",
        instruction:
          "In the Attachments section, upload any supporting files for the change.",
        expected: "Supporting documents are attached to the PCO.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Attachments',
      },
      async () => {
        const fixturePath = path.join(os.tmpdir(), "alleato-tutorial-prime-pco-backup.txt");
        await writeFile(fixturePath, "Tutorial fixture: prime PCO supporting document.\n", "utf8");
        await tutorial.uploadFirstFile(fixturePath).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Create the PCO",
        instruction:
          "Select Create to save. The Prime Contract PCO is created against the owner contract and linked to its source change event, ready to be assembled into an owner change order. Tutorial runs default to preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The Prime PCO is saved and linked to its source change event and prime contract."
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
