import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface ChangeCreateEventData extends TutorialSeedData {
  changeReason: string;
  description: string;
  projectId: number;
  scope: string;
  submitWorkflow: boolean;
  title: string;
  type: string;
  lineItem: {
    amount: string;
    budgetCode: string;
    description: string;
  };
}

export default defineTutorial<ChangeCreateEventData>({
  id: "change.change-create-event",
  title: "Create a change event",
  module: "change-management",
  slug: "change-create-event",
  description:
    "Document a potential scope, cost, or schedule change as a change event with priced line items, recording the workflow as screenshots, Markdown, and manifest data.",
  dataPath: "./change-create-event.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const createRoute = `/${data.projectId}/change-events/new`;

    await tutorial.step(
      {
        title: "Open the new change event form",
        instruction:
          "Select the project, open Change Events from the sidebar, and start a new change event to open the Create Change Event form.",
        expected: "The Create Change Event form opens.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=General Information',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/change-events/new", "Open the new change event form");
      },
    );

    await tutorial.step(
      {
        title: "Fill in the general information",
        instruction:
          "Under General Information, leave Number to auto-generate (or set it), then enter a Title and Description that clearly identify the change. Set the Type, Change Reason, and Scope.",
        expected:
          "The change event is identified with a title, description, type, reason, and scope.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name="title"], [name="description"]',
      },
      async () => {
        await tutorial.fillByLabel(/^title/i, data.title).catch(() => undefined);
        await tutorial.fillByLabel(/description/i, data.description).catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/^type/i).catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/change reason|reason/i).catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/scope/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Set the origin",
        instruction:
          "Choose the Origin and, if applicable, the Origin Record to tie the change event back to its source (for example a related record).",
        expected: "The change event records where the change originated.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Origin',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/origin/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Set revenue handling",
        instruction:
          "Set Expecting Revenue and, when revenue is expected, the Line Item Revenue Source. If you are using markup, set the Prime Contract (markup basis) so markup is calculated against the right contract.",
        expected: "Revenue handling and markup basis are configured for the line items.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Expecting Revenue, text=Revenue Source',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/expecting revenue/i).catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/revenue source/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Add cost line items",
        instruction:
          "In the Line Items section, add a row for each change. Select the Budget Code, enter a Description, and enter the quantity and unit cost (and revenue values where applicable).",
        expected:
          "Each line item has a budget code and pricing, and the total estimated value rolls up to the change event header.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Line Items',
      },
      async () => {
        await page
          .getByRole("button", { name: /add line item|add row|add/i })
          .first()
          .click({ timeout: 5_000 })
          .catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/budget code|cost code/i).catch(() => undefined);
        await page
          .getByLabel(/description/i)
          .last()
          .fill(data.lineItem.description)
          .catch(() => undefined);
        await page
          .getByLabel(/amount|unit cost/i)
          .last()
          .fill(data.lineItem.amount)
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Attach supporting documents",
        instruction:
          "In the Attachments section, upload supporting files such as drawings, RFIs, or photos.",
        expected: "Supporting documents are attached to the change event.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Attachments',
      },
      async () => {
        const fixturePath = path.join(os.tmpdir(), "alleato-tutorial-change-event-backup.txt");
        await writeFile(fixturePath, "Tutorial fixture: change event supporting document.\n", "utf8");
        await tutorial.uploadFirstFile(fixturePath).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Save the change event",
        instruction:
          "Select Create Change Event to save. The change event is created in Open status, ready for pricing review and approval. Tutorial runs default to preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The change event is saved in Open status and appears in the Change Events log."
          : "The completed draft is ready to save without creating demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create Change Event")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("button", { name: /create change event/i })
            .click()
            .catch(() => undefined);
        }
      },
    );
  },
});
