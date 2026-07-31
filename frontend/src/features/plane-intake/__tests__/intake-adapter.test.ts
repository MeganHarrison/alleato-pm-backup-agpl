/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import {
  formatIntakeIdentifier,
  intakeItemMatches,
  mergeIntakeItems,
  normalizeOutlookIntake,
  normalizeTaskIntake,
  resolveAdjacentIntakeKey,
  type OutlookIntakeEmail,
} from "@/features/plane-intake/intake-adapter";
import type { TasksRow } from "@/features/tasks/task-utils";

function task(overrides: Partial<TasksRow> = {}): TasksRow {
  return {
    id: "task-1",
    metadata_id: null,
    segment_id: null,
    source_chunk_id: null,
    schedule_task_id: null,
    description: "Confirm storefront lead time",
    assignee_person_id: null,
    assignee_name: "Jordan Lee",
    assignee_email: "jordan@example.com",
    meeting_title: null,
    project_id: 42,
    project_name: "Civic Center",
    client_id: null,
    due_date: null,
    priority: "high",
    status: "open",
    source_system: "outlook",
    embedding: null,
    created_at: "2026-07-29T10:00:00Z",
    updated_at: null,
    project_ids: [42],
    file_name: null,
    source_title: "Owner coordination",
    source_type: "email",
    source_date: null,
    source_url: null,
    source_web_url: null,
    fireflies_link: null,
    meeting_link: null,
    source_context: null,
    title: null,
    assigned_by: null,
    extraction_source: null,
    extraction_model: null,
    extraction_prompt_version: null,
    extraction_metadata: null,
    ...overrides,
  };
}

function email(overrides: Partial<OutlookIntakeEmail> = {}): OutlookIntakeEmail {
  return {
    id: 9,
    subject: "Storefront submittal",
    body: "Please confirm the revised detail.",
    bodyHtml: null,
    bodyText: "Please confirm the revised detail.",
    fromName: "Taylor Reed",
    fromEmail: "taylor@example.com",
    toList: ["pm@example.com"],
    matchStatus: "matched",
    assignmentMethod: "automatic",
    assignmentConfidence: 0.91,
    receivedAt: "2026-07-30T10:00:00Z",
    hasAttachments: true,
    webLink: "https://outlook.office.com/mail/item/9",
    createdAt: "2026-07-30T10:01:00Z",
    project: { id: 42, name: "Civic Center", projectNumber: "2407" },
    ...overrides,
  };
}

describe("formatIntakeIdentifier", () => {
  it("formats numeric Outlook ids without assuming string methods", () => {
    const [item] = normalizeOutlookIntake([email({ id: 101 })], 42);

    expect(formatIntakeIdentifier(item!, "CIVIC")).toBe("OUTLOOK-101");
  });
});

describe("Plane intake adapter", () => {
  it("maps canonical task statuses to open and closed intake tabs", () => {
    expect(normalizeTaskIntake([task()])[0]?.tab).toBe("open");
    expect(normalizeTaskIntake([task({ status: "done" })])[0]?.tab).toBe("closed");
  });

  it("only includes Outlook intake matched to the active project", () => {
    const rows = normalizeOutlookIntake(
      [email(), email({ id: 10, project: { id: 77, name: "Other", projectNumber: null } })],
      42,
    );
    expect(rows.map((row) => row.key)).toEqual(["outlook:9"]);
  });

  it("sorts merged intake newest first and searches source context", () => {
    const rows = mergeIntakeItems([task()], [email()], 42);
    expect(rows.map((row) => row.key)).toEqual(["outlook:9", "task:task-1"]);
    expect(intakeItemMatches(rows[1]!, "Jordan")).toBe(true);
    expect(intakeItemMatches(rows[0]!, "storefront")).toBe(true);
  });

  it("cycles intake navigation in both directions", () => {
    const rows = mergeIntakeItems(
      [
        task(),
        task({
          id: "task-2",
          created_at: "2026-07-28T10:00:00Z",
        }),
      ],
      [email()],
      42,
    );
    expect(resolveAdjacentIntakeKey(rows, "outlook:9", "next")).toBe(
      "task:task-1",
    );
    expect(resolveAdjacentIntakeKey(rows, "outlook:9", "previous")).toBe(
      "task:task-2",
    );
    expect(resolveAdjacentIntakeKey(rows, "task:task-2", "next")).toBe(
      "outlook:9",
    );
  });
});
