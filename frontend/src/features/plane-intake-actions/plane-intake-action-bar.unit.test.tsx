// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlaneIntakeActionBar } from "./plane-intake-action-bar";
import type {
  PlaneIntakeAction,
  PlaneIntakeActionRequest,
  PlaneIntakeActionResponse,
} from "./contracts";

vi.mock("@/lib/toast/app-toast", () => ({
  appToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function responseFor(
  request: PlaneIntakeActionRequest,
): PlaneIntakeActionResponse {
  return {
    source: request.source,
    sourceId: request.sourceId,
    projectId: request.projectId,
    action: request.action,
    taskId:
      request.action === "duplicate" ? request.duplicateTaskId : "task-1",
    idempotent: false,
    state: {
      decision:
        request.action === "accept"
          ? "accepted"
          : request.action === "decline"
            ? "declined"
            : request.action === "duplicate"
              ? "duplicate"
              : "pending",
      snoozed_till:
        request.action === "snooze" ? request.snoozeUntil : null,
      duplicate_task_id:
        request.action === "duplicate" ? request.duplicateTaskId : null,
      accepted_task_id: request.action === "accept" ? "task-1" : null,
      resolved_at: null,
      updated_at: "2026-07-31T13:00:00.000Z",
      updated_by: "user-1",
    },
  };
}

function renderActions({
  snoozedUntil = null,
}: {
  snoozedUntil?: string | null;
} = {}) {
  const performAction = vi.fn(
    async (request: PlaneIntakeActionRequest) => responseFor(request),
  );
  const onCompleted = vi.fn();

  const rendered = render(
    <PlaneIntakeActionBar
      source="outlook"
      sourceId="42"
      projectId={31}
      snoozedUntil={snoozedUntil}
      duplicateCandidates={[
        {
          id: "11111111-1111-4111-8111-111111111111",
          identifier: "ALLE-17",
          title: "Existing storefront task",
        },
      ]}
      performAction={performAction}
      onCompleted={onCompleted}
    />,
  );

  return { performAction, onCompleted, unmount: rendered.unmount };
}

afterEach(() => cleanup());

async function expectAction(
  performAction: ReturnType<typeof vi.fn>,
  action: PlaneIntakeAction,
) {
  await waitFor(() =>
    expect(performAction).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "outlook",
        sourceId: "42",
        projectId: 31,
        action,
      }),
    ),
  );
}

describe("PlaneIntakeActionBar", () => {
  it("submits accept and decline decisions", async () => {
    const user = userEvent.setup();
    const { performAction } = renderActions();

    await user.click(screen.getByRole("button", { name: "Accept" }));
    await user.click(
      screen.getByRole("button", { name: "Add to project" }),
    );
    await expectAction(performAction, "accept");

    await user.click(screen.getByRole("button", { name: "Decline" }));
    const declineDialog = screen.getByRole("alertdialog");
    await user.click(
      within(declineDialog).getByRole("button", { name: "Decline" }),
    );
    await expectAction(performAction, "decline");
  });

  it("submits a future snooze and then supports unsnooze", async () => {
    const user = userEvent.setup();
    const first = renderActions();

    await user.click(
      screen.getByRole("button", { name: "More intake actions" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Snooze" }));
    const dialog = screen.getByRole("dialog");
    const futureDay = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button[data-day]"),
    ).find(
      (button) =>
        !button.disabled &&
        new Date(button.dataset.day ?? 0).getTime() > Date.now(),
    );
    expect(futureDay).toBeDefined();
    await user.click(futureDay!);
    await user.click(
      within(dialog).getByRole("button", { name: "Snooze" }),
    );
    await expectAction(first.performAction, "snooze");
    expect(first.performAction).toHaveBeenCalledWith(
      expect.objectContaining({ snoozeUntil: expect.any(String) }),
    );

    first.unmount();
    const second = renderActions({
      snoozedUntil: "2099-08-01T13:00:00.000Z",
    });
    await user.click(
      screen.getByRole("button", { name: "More intake actions" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Un-snooze" }));
    await expectAction(second.performAction, "unsnooze");
  });

  it("submits the selected duplicate task", async () => {
    const user = userEvent.setup();
    const { performAction } = renderActions();

    await user.click(
      screen.getByRole("button", { name: "More intake actions" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Mark as duplicate" }),
    );
    await user.click(
      screen.getByRole("button", { name: /ALLE-17 Existing storefront task/ }),
    );

    await expectAction(performAction, "duplicate");
    expect(performAction).toHaveBeenCalledWith(
      expect.objectContaining({
        duplicateTaskId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });
});
