/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api-client";

import { PlaneDraftsPage } from "./plane-drafts-page";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "31" }),
}));

vi.mock("@/lib/toast/app-toast", () => ({
  appToast: {
    success: vi.fn(),
  },
}));

const draft = {
  id: "draft-1",
  user_id: "user-1",
  project_id: 31,
  artifact_type: "note",
  title: "Owner ceiling decision",
  status: "draft",
  version: 1,
  content: { text: "Confirm pricing before Friday." },
  context_snapshot: {},
  session_id: null,
  promoted_to: null,
  promoted_at: null,
  tags: [],
  created_at: "2026-07-30T10:00:00.000Z",
  updated_at: "2026-07-30T11:00:00.000Z",
} as const;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Plane Drafts persisted workspace", () => {
  it("loads the current user's project drafts and updates through the owner API", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ artifacts: [draft] })
      .mockResolvedValueOnce({ ok: true, id: draft.id, version: 2 })
      .mockResolvedValueOnce({
        artifacts: [{ ...draft, title: "Revised title" }],
      });

    render(<PlaneDraftsPage projectId={31} />);

    const title = await screen.findByText("Owner ceiling decision");
    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      "/api/plane-drafts?project_id=31",
    );

    fireEvent.click(title);
    fireEvent.change(screen.getByLabelText("Draft title"), {
      target: { value: "Revised title" },
    });
    fireEvent.change(screen.getByLabelText("Draft content"), {
      target: { value: "Revised decision." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenNthCalledWith(
        2,
        "/api/plane-drafts",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            action: "update",
            project_id: 31,
            id: "draft-1",
            version: 1,
            title: "Revised title",
            text: "Revised decision.",
          }),
        }),
      ),
    );
    expect(await screen.findByText("Revised title")).toBeTruthy();
  });

  it("keeps owner failures visible instead of showing a false empty state", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(
      new Error("Draft owner is unavailable."),
    );

    render(<PlaneDraftsPage />);

    expect(await screen.findByText("Draft owner is unavailable.")).toBeTruthy();
    expect(screen.queryByText("No drafts yet")).toBeNull();
  });

  it("includes the rendered draft version in status mutations", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ artifacts: [draft] })
      .mockResolvedValueOnce({ artifact: { ...draft, status: "final", version: 2 } })
      .mockResolvedValueOnce({ artifacts: [] });

    render(<PlaneDraftsPage projectId={31} />);

    await screen.findByText(draft.title);
    fireEvent.click(
      screen.getByRole("button", { name: `Finalize ${draft.title}` }),
    );

    await waitFor(() =>
      expect(apiFetch).toHaveBeenNthCalledWith(
        2,
        "/api/plane-drafts",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            action: "finalize",
            project_id: 31,
            id: draft.id,
            version: draft.version,
          }),
        }),
      ),
    );
  });
});
