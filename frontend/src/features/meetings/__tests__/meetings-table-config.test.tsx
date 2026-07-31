/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import {
  buildMeetingTableColumns,
  meetingDefaultVisibleColumns,
} from "@/features/meetings/meetings-table-config";
import { MEETING_CATEGORY_OPTIONS } from "@/lib/meetings/domain";
import type { Meeting } from "@/lib/validation/meetings";

function buildMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: "meeting-1",
    title: "Weekly Coordination",
    date: "2026-07-01T15:00:00.000Z",
    type: "meeting",
    category: "Project",
    source: null,
    url: null,
    project: "Exol Morrisville",
    project_id: 101,
    action_items: null,
    audio: null,
    bullet_points: null,
    description: "Coordination meeting",
    duration_minutes: 45,
    keywords: ["coordination"],
    overview: null,
    sentiment: null,
    content: null,
    notes: null,
    participants: null,
    participants_array: [],
    status: "embedded",
    embedding_status: "embedded",
    summary: null,
    summary_bullets: null,
    summary_embedding: null,
    fireflies_link: null,
    video: null,
    created_at: "2026-07-01T15:00:00.000Z",
    deleted_at: null,
    updated_at: "2026-07-01T15:00:00.000Z",
    ...overrides,
  };
}

describe("meetings table config", () => {
  it("keeps Annual Review available as a built-in meeting category", () => {
    expect(MEETING_CATEGORY_OPTIONS).toContain("Annual Review");
  });

  it("uses the requested default visible column order after description", () => {
    expect(meetingDefaultVisibleColumns).toEqual([
      "title",
      "project",
      "date",
      "description",
      "summary",
      "links",
      "category",
      "embedding",
      "bullet_points",
      "sentiment",
      "keywords",
    ]);
  });

  it("formats action items without raw markdown markers", () => {
    const meeting = buildMeeting({
      action_items: "**Jesse Dawson**\n- Review permit set\n- Follow up with Nathan",
    });
    const actionItemsColumn = buildMeetingTableColumns().find(
      (column) => column.id === "action_items",
    );

    if (!actionItemsColumn) {
      throw new Error("Action items column missing");
    }

    render(<>{actionItemsColumn.render(meeting)}</>);

    expect(screen.getByText("Jesse Dawson")).toBeInTheDocument();
    expect(screen.getByText("Review permit set")).toBeInTheDocument();
    expect(screen.queryByText("**Jesse Dawson**")).not.toBeInTheDocument();
    expect(actionItemsColumn.csvValue?.(meeting)).toBe(
      "Jesse Dawson; Review permit set; Follow up with Nathan",
    );
  });

  it("uses the RAG embedding status instead of document processing status", () => {
    const embeddingColumn = buildMeetingTableColumns().find(
      (column) => column.id === "embedding",
    );

    if (!embeddingColumn) {
      throw new Error("Embedding column missing");
    }

    const meeting = buildMeeting({
      status: "complete",
      embedding_status: "embedded",
    });

    render(<>{embeddingColumn.render(meeting)}</>);

    expect(screen.getByText("Embedded")).toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });
});
