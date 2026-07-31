import { expect, test } from "@jest/globals";

import {
  mergeTrainingDocMetadata,
  normalizeTrainingDocInput,
} from "../server";

test("normalizeTrainingDocInput preserves first-class control-plane fields", () => {
  const normalized = normalizeTrainingDocInput({
    title: "Create a Commitment",
    slug: " create-a-commitment ",
    tool_category: " Commitments ",
    tool_module: " commitments ",
    task_key: " commitments.create-commitment ",
    qa_status: "needs_update",
    qa_notes: " Refresh screenshots after header change. ",
    review_notes: " Product naming still under review. ",
    source_route: " /1034/commitments/new ",
  });

  expect(normalized.slug).toBe("create-a-commitment");
  expect(normalized.tool_category).toBe("Commitments");
  expect(normalized.tool_module).toBe("commitments");
  expect(normalized.task_key).toBe("commitments.create-commitment");
  expect(normalized.qa_status).toBe("needs_update");
  expect(normalized.qa_notes).toBe("Refresh screenshots after header change.");
  expect(normalized.review_notes).toBe("Product naming still under review.");
  expect(normalized.source_route).toBe("/1034/commitments/new");
});

test("mergeTrainingDocMetadata mirrors first-class control-plane fields for legacy consumers", () => {
  const metadata = mergeTrainingDocMetadata(
    {
      appToolCategory: "Old Category",
      tutorialModule: "old-module",
      tutorialId: "old.task",
    },
    {
      tool_category: "Commitments",
      tool_module: "commitments",
      task_key: "commitments.create-commitment",
    },
  );

  expect(metadata).toMatchObject({
    appToolCategory: "Commitments",
    tutorialModule: "commitments",
    tutorialId: "commitments.create-commitment",
  });
});

test("mergeTrainingDocMetadata stores structured audit findings for the audit layer", () => {
  const metadata = mergeTrainingDocMetadata(
    {},
    {
      audit_status: "product_gap",
      audit_notes: "Alleato is missing one approval step from the audited flow.",
      blocker_type: "workflow",
      blocker_owner: "frontend",
      product_gap_issue_id: "AAI-852",
    },
  );

  expect(metadata).toMatchObject({
    lastParityStatus: "product_gap",
    auditNotes: "Alleato is missing one approval step from the audited flow.",
    blockerType: "workflow",
    blockerOwner: "frontend",
    productGapIssueId: "AAI-852",
  });
});
