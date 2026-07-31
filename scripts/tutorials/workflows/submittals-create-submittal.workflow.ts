import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface CreateSubmittalData extends TutorialSeedData {
  projectId: number;
  number: string;
  revision: string;
  title: string;
  specificationSection: string;
  division: string;
  leadTimeDays: string;
  description: string;
  submitWorkflow: boolean;
}

export default defineTutorial<CreateSubmittalData>({
  id: "submittals.create-submittal",
  title: "Create a submittal",
  module: "submittals",
  slug: "create-a-submittal",
  description:
    "Create a new submittal with project details, responsible parties, scheduling dates, and supporting attachments.",
  dataPath: "./submittals-create-submittal.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const createRoute = `/${data.projectId}/submittals/new`;

    await tutorial.step(
      {
        title: "Open the new submittal form",
        instruction:
          "Open the project Submittals tool and start a new record to load the Create Submittal form.",
        expected: "The Create Submittal page opens with the general information section visible.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Create Submittal, text=General Information',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/submittals/new", "Open the new submittal form");
      },
    );

    await tutorial.step(
      {
        title: "Enter the general information",
        instruction:
          "Enter the submittal Number, Revision, and Title. Add the Specification Section and Division, then review optional package and type selections if they apply.",
        expected:
          "The submittal has an identifying number, title, and specification context.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=General Information',
      },
      async () => {
        await tutorial.requireFillByLabel(/number/i, data.number);
        await tutorial.requireFillByLabel(/revision/i, data.revision);
        await tutorial.requireFillByLabel(/^title/i, data.title);
        await tutorial.fillByLabel(/specification section/i, data.specificationSection);
        await tutorial.fillByLabel(/division/i, data.division);
        await tutorial.selectFirstComboboxOption(/submittal type/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Assign the responsible parties",
        instruction:
          "Choose the Responsible Contractor, optionally choose the contact in Received From, and confirm or update the Submittal Manager.",
        expected:
          "The submittal shows who is responsible for providing and managing the package.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=People & Companies',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/responsible contractor/i).catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/received from/i).catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/submittal manager/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Set the schedule dates",
        instruction:
          "Set Final Due Date and Required On-Site Date, then enter the Lead Time so the review schedule matches the project timeline.",
        expected: "The submittal timeline is visible in Distribution & Scheduling.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Distribution & Scheduling',
      },
      async () => {
        await page.getByRole("button", { name: /final due date/i }).click().catch(() => undefined);
        await page.keyboard.type("07/15/2026").catch(() => undefined);
        await page.keyboard.press("Tab").catch(() => undefined);
        await page.getByRole("button", { name: /required on-site date/i }).click().catch(() => undefined);
        await page.keyboard.type("08/05/2026").catch(() => undefined);
        await page.keyboard.press("Tab").catch(() => undefined);
        await tutorial.fillByLabel(/lead time/i, data.leadTimeDays).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Describe the submittal and attach files",
        instruction:
          "Add a description of the package, set privacy if needed, and attach the supporting files that reviewers need.",
        expected:
          "The content and attachments sections show the supporting description and uploaded file list.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Content, text=Attachments',
      },
      async () => {
        await tutorial.fillByLabel(/description/i, data.description).catch(() => undefined);
        const fixturePath = path.join(os.tmpdir(), "alleato-tutorial-submittal-attachment.txt");
        await writeFile(fixturePath, "Tutorial fixture: submittal attachment.\n", "utf8");
        await tutorial.uploadFirstFile(fixturePath).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Create the submittal",
        instruction:
          "Select Create Submittal to save the new record. Tutorial runs stay in preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The submittal is saved and opens on the new submittal detail page."
          : "The completed form is ready to save without creating demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create Submittal")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page.getByRole("button", { name: /create submittal/i }).click().catch(() => undefined);
        }
      },
    );
  },
});
