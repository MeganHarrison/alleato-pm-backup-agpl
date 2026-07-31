import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface CreateSubcontractData extends TutorialSeedData {
  contractCompany: string;
  contractNumber: string;
  description: string;
  inclusions: string;
  exclusions: string;
  projectId: number;
  retainage: string;
  sovAmount: string;
  sovDescription: string;
  submitWorkflow: boolean;
  title: string;
}

export default defineTutorial<CreateSubcontractData>({
  id: "commitments.create-subcontract",
  title: "Create a subcontract commitment",
  module: "commitments",
  slug: "commitments-create-subcontract",
  description:
    "Create a subcontract with a contract company, a schedule of values, and supporting attachments.",
  dataPath: "./commitments-create-subcontract.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const createRoute = `/${data.projectId}/commitments/new?type=subcontract`;

    await tutorial.step(
      {
        title: "Start a new subcontract",
        instruction: "From the project's Commitments tool, start a new subcontract.",
        expected: "The New Subcontract form opens.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=General Information',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/commitments/new", "Start a new subcontract");
      },
    );

    await tutorial.step(
      {
        title: "Complete General Information",
        instruction:
          "In General Information, the Title, Contract #, Contract Company, and Status fields are required. Optionally set Default Retainage, the Executed flag, and a Description. If the contract company is not in the search, add it in the Company Directory first.",
        expected: "The required header fields are filled and a contract company is selected.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name="title"], [name="contract_number"]',
      },
      async () => {
        await tutorial.scrollToText(/general information/i);
      },
    );

    await tutorial.step(
      {
        title: "Add inclusions and exclusions",
        instruction:
          "In Inclusions + Exclusions, capture what the subcontract scope does and does not cover.",
        expected: "Scope inclusions and exclusions are recorded.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Inclusions',
      },
      async () => {
        await tutorial.scrollToText(/inclusions/i);
      },
    );

    await tutorial.step(
      {
        title: "Set contract dates",
        instruction: "In Contract Dates, enter the dates your team tracks for the subcontract.",
        expected: "The relevant contract dates are saved on the form.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Contract Dates',
      },
      async () => {
        await tutorial.scrollToText(/contract dates/i);
      },
    );

    await tutorial.step(
      {
        title: "Attach backup files",
        instruction:
          "In Attachments, upload supporting files such as the signed subcontract, proposal, or scope sheet.",
        expected: "The attached files are listed on the form before saving.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Attachments',
      },
      async () => {
        const fixturePath = path.join(os.tmpdir(), "alleato-tutorial-subcontract-backup.txt");
        await writeFile(fixturePath, "Tutorial fixture: signed subcontract backup.\n", "utf8").catch(
          () => undefined,
        );
        await tutorial.scrollToText(/attachments/i);
        await tutorial.uploadFirstFile(fixturePath);
      },
    );

    await tutorial.step(
      {
        title: "Build the schedule of values",
        instruction:
          "In Schedule of Values, add the line items that make up the contract total. For each line set the budget code, description, and amount (or quantity, unit of measure, and unit cost when using unit/quantity accounting).",
        expected: "The SOV line items total to the full subcontract value.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Schedule of Values',
      },
      async () => {
        await tutorial.scrollToText(/schedule of values/i);
      },
    );

    await tutorial.step(
      {
        title: "Set privacy and invoice contacts",
        instruction:
          "In the Privacy section, mark the subcontract private and add the specific users who may access it if it should not be visible to the whole project. In Invoice Contacts, add the people vendor billing should route to.",
        expected: "Visibility and invoice-routing settings match the contract's requirements.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Privacy',
      },
      async () => {
        await page
          .evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Create the subcontract",
        instruction: "Review the form, then select Create Subcontract.",
        expected:
          "A confirmation appears and the new subcontract is saved, returning you to the Commitments list.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create Subcontract")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("button", { name: /create subcontract/i })
            .first()
            .click()
            .catch(() => undefined);
        }
      },
    );
  },
});
