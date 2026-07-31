import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface CreatePrimeContractData extends TutorialSeedData {
  projectId: number;
  contractNumber: string;
  title: string;
  ownerClient: string;
  status: string;
  description: string;
  defaultRetainage: string;
  startDate: string;
  estimatedCompletionDate: string;
  budgetCodeSearch: string;
  budgetCode: string;
  sovDescription: string;
  sovAmount: string;
  inclusions: string;
  exclusions: string;
  submitWorkflow: boolean;
}

export default defineTutorial<CreatePrimeContractData>({
  id: "prime-contracts.create-prime-contract",
  title: "Create a prime contract",
  module: "prime-contracts",
  slug: "create-a-prime-contract",
  description:
    "Create a prime contract with contract details, dates, schedule-of-values lines, and scope notes for owner billing.",
  dataPath: "./prime-contracts-create-prime-contract.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const createRoute = `/${data.projectId}/prime-contracts/new`;
    const submitWorkflow = process.env.TUTORIAL_SUBMIT_WORKFLOW === "1";
    // Preview captures keep a stable human-readable number. Saved probes must
    // be retry-safe, so each temporary record receives a unique suffix and is
    // registered for cleanup immediately after the POST succeeds.
    const contractNumber = submitWorkflow
      ? `${data.contractNumber}-${Date.now()}`
      : data.contractNumber;

    await tutorial.step(
      {
        title: "Open the new prime contract form",
        instruction:
          "Open Prime Contracts in the project and start a new contract to load the Create Prime Contract form.",
        expected: "The Create Prime Contract page opens with General Information visible.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=General Information',
        checkpoint: "after-action",
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/prime-contracts/new", "Open the new prime contract form");
      },
    );

    await tutorial.step(
      {
        title: "Fill out the contract details",
        instruction:
          "Enter the Contract number and Title, then set the default retainage for the agreement.",
        expected:
          "The contract header identifies the owner contract and how retainage should be calculated.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=General Information',
        checkpoint: "after-action",
      },
      async () => {
        await tutorial.requireFillByLabel(/contract #/i, contractNumber);
        await tutorial.requireFillByLabel(/title/i, data.title);
        await tutorial.requireFillByLabel(/default retainage/i, data.defaultRetainage);
        await tutorial.requireInputValueByLabel(/contract #/i, contractNumber);
        await tutorial.requireInputValueByLabel(/title/i, data.title);
      },
    );

    await tutorial.step(
      {
        title: "Open the Owner/Client choices",
        instruction:
          "Open Owner/Client to review the companies available to the project before choosing the agreement owner.",
        expected: `The Owner/Client menu is open and includes ${data.ownerClient}.`,
        screenshot: { mode: "viewport" },
        calloutSelector: '[role="listbox"]',
        checkpoint: "menu-open",
      },
      async () => {
        await tutorial.openCombobox("Owner/Client");
        await tutorial.requireTextVisible(data.ownerClient, "opening Owner/Client choices");
      },
    );

    await tutorial.step(
      {
        title: "Select the Owner/Client",
        instruction:
          "Choose the company that is executing the agreement with the project. This identifies the owner-facing contract record.",
        expected: `Owner/Client is set to ${data.ownerClient}.`,
        screenshot: { mode: "viewport" },
        calloutSelector: 'label:has-text("Owner/Client")',
        checkpoint: "option-selected",
      },
      async () => {
        await tutorial.selectComboboxOption("Owner/Client", data.ownerClient);
      },
    );

    await tutorial.step(
      {
        title: "Open the contract status choices",
        instruction:
          "Open Status to review the lifecycle states available for this agreement before choosing the current state.",
        expected: `The Status menu is open and includes ${data.status}.`,
        screenshot: { mode: "viewport" },
        calloutSelector: '[role="listbox"]',
        checkpoint: "menu-open",
      },
      async () => {
        await tutorial.openCombobox("Status");
        await tutorial.requireTextVisible(data.status, "opening contract status choices");
      },
    );

    await tutorial.step(
      {
        title: "Set the contract status",
        instruction:
          "Select the status that reflects the agreement's current lifecycle stage. Keep a contract in Draft until it is ready to move forward.",
        expected: `Status is set to ${data.status}.`,
        screenshot: { mode: "viewport" },
        calloutSelector: 'label:has-text("Status")',
        checkpoint: "option-selected",
      },
      async () => {
        await tutorial.selectComboboxOption("Status", data.status);
      },
    );

    await tutorial.step(
      {
        title: "Add the contract narrative",
        instruction:
          "Describe the agreement so the project team understands the contract's owner-facing purpose and scope.",
        expected: "The contract description is populated.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Description',
        checkpoint: "after-action",
      },
      async () => {
        await tutorial.requireFillContentEditableByPlaceholder(/enter contract description/i, data.description);
        await tutorial.requireTextVisible(data.description, "adding the contract narrative");
      },
    );

    await tutorial.step(
      {
        title: "Set the contract dates",
        instruction:
          "Enter the Start Date and Estimated Completion Date so the contract timeline is established from the start.",
        expected: "The prime contract includes the key contract dates.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Contract Dates',
        checkpoint: "after-action",
      },
      async () => {
        await tutorial.selectDate("Start Date", data.startDate);
        await tutorial.selectDate("Estimated Completion Date", data.estimatedCompletionDate);
      },
    );

    await tutorial.step(
      {
        title: "Add a schedule of values line",
        instruction:
          "In Schedule of Values, add a line item to create the place where contract scope and billing value are defined.",
        expected: "A new SOV line is visible with Budget Code, Description, and Amount fields.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Schedule of Values',
        checkpoint: "after-action",
      },
      async () => {
        await page.getByRole("button", { name: /add line item/i }).click();
        await tutorial.requireTextVisible("Description", "adding a schedule of values line");
      },
    );

    await tutorial.step(
      {
        title: "Open the budget code choices",
        instruction:
          "Open the Budget Code menu to review the cost-code options that connect this owner contract line to project financial reporting.",
        expected: `The Budget Code menu is open and filtered to ${data.budgetCodeSearch}.`,
        screenshot: { mode: "viewport" },
        calloutSelector: '[role="listbox"]',
        checkpoint: "menu-open",
      },
      async () => {
        await tutorial.openComboboxBySelector('[data-testid="sov-line-0"] [role="combobox"]');
        await tutorial.requireFillByPlaceholder(/search budget codes/i, data.budgetCodeSearch);
        await tutorial.requireOptionVisible(new RegExp(data.budgetCodeSearch), "opening budget code choices");
      },
    );

    await tutorial.step(
      {
        title: "Select and price the schedule of values line",
        instruction:
          "Select the budget code, then enter the line description and amount. The SOV becomes the basis for owner billing and contract totals.",
        expected: "The selected budget code, description, line amount, and SOV total are visible.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[data-testid="sov-table"]',
        checkpoint: "option-selected",
      },
      async () => {
        await tutorial.openComboboxBySelector('[data-testid="sov-line-0"] [role="combobox"]');
        await tutorial.requireFillByPlaceholder(/search budget codes/i, data.budgetCodeSearch);
        await tutorial.selectOpenComboboxOption(new RegExp(data.budgetCodeSearch), "Schedule of Values budget code");
        await tutorial.requireFillBySelector('[data-testid="sov-line-0"] [data-testid="sov-line-description"]', data.sovDescription);
        await tutorial.requireFillBySelector('[data-testid="sov-line-0"] [data-testid="sov-line-amount"]', data.sovAmount);
        await tutorial.requireInputValueBySelector('[data-testid="sov-line-0"] [data-testid="sov-line-description"]', data.sovDescription);
        await tutorial.requireTextVisible("$25,000.00", "verifying the schedule of values total");
      },
    );

    await tutorial.step(
      {
        title: "Define inclusions and exclusions",
        instruction:
          "Document the included scope and any exclusions so the owner contract is clear before execution.",
        expected: "The scope section captures what is included and excluded from the contract.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Inclusions',
        checkpoint: "after-action",
      },
      async () => {
        await tutorial.requireFillContentEditableByPlaceholder(/enter what is included/i, data.inclusions);
        await tutorial.requireFillContentEditableByPlaceholder(/enter what is excluded/i, data.exclusions);
        await tutorial.requireTextVisible(data.inclusions, "defining inclusions");
        await tutorial.requireTextVisible(data.exclusions, "defining exclusions");
      },
    );

    await tutorial.step(
      {
        title: "Set contract privacy",
        instruction:
          "Set the contract to Private when access must be limited to project admins and specifically allowed non-admin users.",
        expected: "Private is enabled and the non-admin access control is available.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Contract Privacy',
        checkpoint: "after-action",
      },
      async () => {
        await page.getByRole("checkbox", { name: "Private" }).check();
        const accessControl = page.getByRole("combobox", {
          name: "Access for Non-Admin Users",
        });
        if (await accessControl.isDisabled()) {
          throw new Error("Contract privacy did not enable Access for Non-Admin Users.");
        }
      },
    );

    await tutorial.step(
      {
        title: "Create the prime contract",
        instruction:
          "Select Create Prime Contract to save the contract. Tutorial runs stay in preview mode unless submitWorkflow is true.",
        expected: submitWorkflow
          ? "The prime contract is saved and opens on the contract detail page."
          : "The completed form is ready to save without creating demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create Prime Contract")',
        checkpoint: submitWorkflow ? "saved-result" : "after-action",
      },
      async () => {
        if (submitWorkflow) {
          const [response] = await Promise.all([
            page.waitForResponse(
              (candidate) =>
                candidate.url().includes(`/api/projects/${data.projectId}/contracts`) &&
                candidate.request().method() === "POST",
              { timeout: 30_000 },
            ),
            page.getByRole("button", { name: /create prime contract/i }).click(),
          ]);
          if (!response.ok()) {
            throw new Error(
              `Prime Contract tutorial save failed: ${response.status()} ${await response.text()}`,
            );
          }
          const savedContract = await response.json() as { id?: string };
          const contractId = savedContract.id;
          if (!contractId) {
            throw new Error("Prime Contract tutorial save succeeded but did not return a contract ID for verification and cleanup.");
          }
          tutorial.deferCleanup(async () => {
            const response = await page.request.delete(
              `${tutorial.getBaseUrl()}/api/projects/${data.projectId}/contracts/${contractId}`,
            );
            if (!response.ok()) {
              throw new Error(
                `Tutorial cleanup could not delete Prime Contract ${contractId}: ${response.status()} ${response.statusText()}`,
              );
            }
          });
          await page.waitForURL(
            new RegExp(`/${data.projectId}/prime-contracts/(?!new$)[^/]+$`),
            // The create hook warms the detail APIs before navigating. This is
            // intentional product behavior, so capture waits for the real
            // redirect instead of declaring the saved result missing early.
            { timeout: 60_000 },
          );
          await tutorial.requireUrl(/\/prime-contracts\/(?!new$)[^/]+$/, "Create the prime contract");
        }
      },
    );
  },
});
