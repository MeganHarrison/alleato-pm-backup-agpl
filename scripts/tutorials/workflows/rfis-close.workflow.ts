import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface RfisCloseData extends TutorialSeedData {
  projectId: number;
  submitWorkflow: boolean;
}

export default defineTutorial<RfisCloseData>({
  id: "rfis.rfis-close",
  title: "Close an RFI",
  module: "rfis",
  slug: "rfis-close",
  description:
    "Close an answered RFI from its detail page to lock it as resolved and notify everyone on the distribution.",
  dataPath: "./rfis-close.data.json",
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
          "From the project's RFIs log, select the RFI you want to close to open its detail page.",
        expected:
          "The RFI detail page loads showing the General Information panel with the RFI #, Status, Subject, and Question.",
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
        title: "Confirm an answer is on record",
        instruction:
          "Scroll to the Responses section and confirm the assignee's answer is present, and check the Formal Responses for one marked Official if you require an answer of record.",
        expected:
          "You can see the response text and know the RFI has been answered before you close it.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Responses, text=Formal Responses',
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
        title: "Open the actions menu",
        instruction:
          "In the page header, open the overflow (three-dot) actions menu next to the Create Change Event button.",
        expected: "The menu opens with Edit, Delete, and a status action.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button[aria-haspopup="menu"], button:has-text("Create Change Event")',
      },
      async () => {
        await page
          .getByRole("button", { name: /more|actions|menu/i })
          .first()
          .click()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Select Close RFI",
        instruction:
          "When the RFI status is Open, the status action reads Close RFI. Select it.",
        expected:
          "The status updates to Closed and the Closed Date field on the detail page is populated.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Close RFI',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("menuitem", { name: /close rfi/i })
            .first()
            .click()
            .catch(() => undefined);
        }
      },
    );

    await tutorial.step(
      {
        title: "Verify notification",
        instruction:
          "Closing the RFI sends a close notification to the resolved recipients (assignees, distribution list, RFI manager). This send is best-effort: a failed email surfaces as a non-blocking warning and does not undo the close.",
        expected:
          "The RFI shows Closed and the project team is notified that an answer is available; if email could not be sent you see a warning, not an error.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Status, text=Closed Date',
      },
      async () => {
        // Best-effort: remain on the detail page to capture the close result.
      },
    );

    await tutorial.step(
      {
        title: "Reopen if needed",
        instruction:
          "If the RFI was closed in error, reopen the actions menu — the status action now reads Reopen RFI. Select it to return the RFI to Open.",
        expected:
          "The status returns to Open and the RFI can accept further responses again.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Reopen RFI, button[aria-haspopup="menu"]',
      },
      async () => {
        await page
          .getByRole("button", { name: /more|actions|menu/i })
          .first()
          .click()
          .catch(() => undefined);
      },
    );
  },
});
