import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface CreateCommitmentData extends TutorialSeedData {
  commitmentTitle: string;
  commitmentType: "subcontract" | "purchase_order";
  contractNumber: string;
  description: string;
  projectId: number;
  retainage: string;
  submitWorkflow: boolean;
  vendor: string;
  sovItems: Array<{
    amount: string;
    costCode: string;
    description: string;
  }>;
}

export default defineTutorial<CreateCommitmentData>({
  id: "commitments.create-commitment",
  title: "Create a Commitment",
  module: "commitments",
  slug: "create-commitment",
  description:
    "Create a subcontract or purchase order commitment with verified screenshots, Markdown, and manifest data.",
  dataPath: "./create-commitment.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const commitmentRoute = `/${data.projectId}/commitments`;
    const createRoute = `${commitmentRoute}/new?type=${data.commitmentType}`;

    await tutorial.step(
      {
        title: "Open Commitments",
        instruction: "From the project workspace, open the Commitments tool.",
        expected: "The Commitments list is visible and the Create action is available.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'a[href$="/commitments"], button:has-text("Create")',
      },
      async () => {
        await tutorial.goto(commitmentRoute);
        await tutorial.requireUrl(commitmentRoute, "Open Commitments");
      },
    );

    await tutorial.step(
      {
        title: "Start a new commitment",
        instruction:
          "Choose the commitment type. Use Subcontract for trade contracts and Purchase Order for vendor or material orders.",
        expected: "The New Subcontract or New Purchase Order form opens.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create"), a[href*="/commitments/new"]',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl(/\/commitments\/new/, "Start a new commitment");
      },
    );

    await tutorial.step(
      {
        title: "Fill general information",
        instruction:
          "Complete the title, contract number, company, status, retainage, executed state, and description.",
        expected: "The required commitment identity fields are filled with consistent demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'form, [name="title"], [name="contract_number"]',
      },
      async () => {
        await tutorial.fillByLabel(/^title/i, data.commitmentTitle);
        await tutorial.fillByLabel(/contract #|contract number|number/i, data.contractNumber);
        await tutorial.selectFirstComboboxOption(/company|vendor/i);
        await tutorial.fillByLabel(/retainage|retention/i, data.retainage);
        await tutorial.fillByLabel(/description|scope/i, data.description);
      },
    );

    await tutorial.step(
      {
        title: "Add an attachment",
        instruction:
          "Attach the signed contract, proposal, scope exhibit, insurance document, or vendor backup.",
        expected: "A backup file is attached or the attachment drop zone is visible for upload.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'input[type="file"], text=Attachments',
      },
      async () => {
        const fixturePath = path.join(os.tmpdir(), "alleato-tutorial-commitment-backup.txt");
        await writeFile(fixturePath, "Tutorial fixture: commitment backup document.\n", "utf8");
        await tutorial.uploadFirstFile(fixturePath);
      },
    );

    await tutorial.step(
      {
        title: "Add Schedule of Values",
        instruction:
          "Add each SOV line with the correct budget code, description, and amount. Confirm the total matches the commitment.",
        expected: "At least one SOV line is visible with a cost code, description, and amount.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Schedule of Values, button:has-text("Add Line Item")',
      },
      async () => {
        await page.getByRole("button", { name: /add line item/i }).click().catch(() => undefined);
        const item = data.sovItems[0];
        await tutorial.selectFirstComboboxOption(/budget code|cost code/i);
        await page.getByLabel(/description/i).last().fill(item.description).catch(() => undefined);
        await page.getByLabel(/amount/i).last().fill(item.amount).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Review dates, privacy, and contacts",
        instruction:
          "Review contract dates, privacy, access for non-admin users, and invoice contacts before saving.",
        expected: "The lower form sections are reviewed before the draft is created.",
        screenshot: { mode: "fullPage" },
        calloutSelector: 'text=Contract Dates, text=Contract Privacy, text=Invoice Contacts',
      },
      async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      },
    );

    await tutorial.step(
      {
        title: "Save the draft",
        instruction:
          "Click Create Subcontract or Create Purchase Order after the full form has been reviewed. Tutorial runs default to preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The commitment is created and appears in the Commitments table."
          : "The completed draft is ready to save without creating demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create Subcontract"), button:has-text("Create Purchase Order")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page.getByRole("button", { name: /create subcontract|create purchase order/i }).click();
        }
      },
    );
  },
});
