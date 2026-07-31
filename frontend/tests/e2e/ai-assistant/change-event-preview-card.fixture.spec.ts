import { expect, test } from "@playwright/test";
import path from "node:path";

test("change event preview card fixture shows form-aligned draft fields", async ({
  page,
}) => {
  await page.goto("/auth/ai-change-event-preview-card");

  const card = page.getByTestId("assistant-preview-review-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Change event draft");
  await expect(card).toContainText("General information");
  await expect(card).toContainText("Owner-requested lobby finish change");
  await expect(card).toContainText("Source and contract");
  await expect(card).toContainText("Prime contract");
  await expect(card).toContainText("Revenue settings");
  await expect(card).toContainText("Line items");
  await expect(card).toContainText("Not supported by chat create yet");
  await expect(card).not.toContainText("Attachments");
  await expect(card).not.toContainText("attachments should be uploaded");

  const formCard = page.getByTestId("assistant-change-event-form-card-v2");
  await expect(formCard).toBeVisible();
  await expect(formCard).toContainText("New change event");
  await expect(formCard.getByLabel("Title")).toContainText(
    "Owner-requested lobby finish change",
  );
  await expect(formCard).toContainText("Prime contract");
  await expect(formCard.getByLabel("Prime contract")).toContainText(
    "614ccdf0-25c6-4f85-a4cc-0ce94d6f36cf",
  );
  await expect(formCard).toContainText("Line item revenue source");
  await expect(formCard.getByLabel("Line item revenue source")).toHaveValue(
    "Match Revenue to Latest Cost",
  );
  await expect(formCard).toContainText("Add line item");
  await expect(formCard).toContainText("Cost $0.00 | Revenue $0.00 | Net $0.00");
  await expect(formCard).toContainText(
    "Chat create does not write line items yet",
  );
  await expect(formCard).not.toContainText("Attachments");
  await expect(formCard).not.toContainText("Chat create does not upload attachments yet");

  await page.screenshot({
    path: path.resolve(
      process.cwd(),
      "../docs/ops/evidence/2026-06-27-ai-change-event-chat-card-fields/change-event-preview-card-playwright.png",
    ),
    fullPage: true,
  });
});
