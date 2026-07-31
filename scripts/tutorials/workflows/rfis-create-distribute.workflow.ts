import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface RfisCreateDistributeData extends TutorialSeedData {
  projectId: number;
  submitWorkflow: boolean;
  subject: string;
  question: string;
  dueDate: string;
}

export default defineTutorial<RfisCreateDistributeData>({
  id: "rfis.rfis-create-distribute",
  title: "Create and distribute an RFI",
  module: "rfis",
  slug: "rfis-create-distribute",
  description:
    "Create a Request for Information and distribute it to assignees, who receive a secure email link to respond.",
  dataPath: "./rfis-create-distribute.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const newRoute = `/${data.projectId}/rfis/new`;

    await tutorial.step(
      {
        title: "Open the New RFI form",
        instruction:
          "From the project's RFIs log, start a new RFI to open the New RFI form.",
        expected: "The New RFI form opens with a Back to RFIs link.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'a:has-text("Back to RFIs"), form',
      },
      async () => {
        await tutorial.goto(newRoute);
        await tutorial.requireUrl("/rfis/new", "Open the New RFI form");
      },
    );

    await tutorial.step(
      {
        title: "Enter the question",
        instruction:
          "Fill in Subject (required) and the Question (required for Open). The Question field describes the information you need.",
        expected: "The subject and question are captured for the RFI.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name="subject"], [name="question"]',
      },
      async () => {
        await tutorial.fillByLabel(/^subject/i, data.subject).catch(() => undefined);
        await tutorial.fillByLabel(/question/i, data.question).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Set assignees and due date",
        instruction:
          "Set Assignees (required for Open) — these are the people who will answer — and the Due Date (required for Open). Assignees and distribution recipients are picked from the project directory.",
        expected: "The RFI has at least one assignee and a response due date.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Assignees, text=Due Date',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/assignee/i).catch(() => undefined);
        await tutorial.fillByLabel(/due date/i, data.dueDate).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Add optional details",
        instruction:
          "Optionally fill in RFI Manager, Received From, Responsible Contractor, Distribution List, Location, Drawing Number, Specification, Cost Code, Reference, and the Schedule Impact / Cost Impact selectors.",
        expected:
          "Supporting context is recorded so the assignee can answer accurately.",
        screenshot: { mode: "fullPage" },
        calloutSelector: 'text=RFI Manager, text=Distribution List, text=Cost Code',
      },
      async () => {
        await page
          .evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Choose how to save",
        instruction:
          "Select Save as Draft to keep the RFI private and unsent, or Create as Open to submit it. The required fields (Question, Assignees, Due Date) are enforced only when creating as Open.",
        expected:
          "A draft is held without notifying anyone, or an Open RFI is created and you return to the RFIs log.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Save as Draft"), button:has-text("Create as Open")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("button", { name: /create as open/i })
            .first()
            .click()
            .catch(() => undefined);
        }
      },
    );

    await tutorial.step(
      {
        title: "Confirm distribution",
        instruction:
          "When the RFI is created as Open (or a draft is later moved to Open), it is distributed by email to the resolved recipients — assignees, distribution list, and RFI manager. Each recipient's email contains a secure link to respond with no login required.",
        expected:
          "Assignees receive the RFI email with a response link; the RFI appears in the log with status Open.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Distribution List, text=Assignees',
      },
      async () => {
        // Best-effort: remain on the form to capture the distribution context.
      },
    );
  },
});
