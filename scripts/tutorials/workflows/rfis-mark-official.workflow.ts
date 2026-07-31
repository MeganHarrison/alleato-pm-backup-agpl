import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface RfisMarkOfficialData extends TutorialSeedData {
  projectId: number;
  submitWorkflow: boolean;
}

export default defineTutorial<RfisMarkOfficialData>({
  id: "rfis.rfis-mark-official",
  title: "Record the official RFI answer",
  module: "rfis",
  slug: "rfis-mark-official",
  description:
    "Designate one submitted response as the RFI's official answer of record on the detail page.",
  dataPath: "./rfis-mark-official.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const listRoute = `/${data.projectId}/rfis`;

    await tutorial.step(
      {
        title: "Open the RFI",
        instruction:
          "From the project's RFIs log, select the RFI to open its detail page.",
        expected: "The RFI detail page loads.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'table tbody tr a, text=General Information',
      },
      async () => {
        await tutorial.goto(listRoute);
        await tutorial.requireUrl("/rfis", "Open the RFI");
        await page
          .locator("table tbody tr a, tbody tr td a, [role=row] a")
          .first()
          .click()
          .catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Find the Responses section",
        instruction:
          "Scroll to the Responses section, which lists the answers submitted through the no-login channels. Each response shows the responder, a source badge (Web, Email, or App), and the date.",
        expected:
          "You see every formal response submitted for this RFI. If no responses have been submitted yet, this section does not appear.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Responses',
      },
      async () => {
        await page
          .getByText(/responses/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Identify the correct answer",
        instruction:
          "Read the responses and identify the one that is the authoritative answer to the RFI question.",
        expected: "You know which response should become the answer of record.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Responses',
      },
      async () => {
        // Best-effort: remain on the Responses section to review the answers.
      },
    );

    await tutorial.step(
      {
        title: "Mark it as official",
        instruction:
          "On the chosen response, select Mark as official.",
        expected:
          "The response gains an Official badge, and the action on that response changes to Remove official mark.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Mark as official")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("button", { name: /mark as official/i })
            .first()
            .click()
            .catch(() => undefined);
        }
      },
    );

    await tutorial.step(
      {
        title: "Change the official answer if needed",
        instruction:
          "To switch the official answer to a different response, select Remove official mark on the current one, then Mark as official on the correct response.",
        expected: "Only the intended response carries the Official badge.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Remove official mark"), button:has-text("Mark as official")',
      },
      async () => {
        // Best-effort: remain on the Responses section to capture the official badge state.
      },
    );
  },
});
