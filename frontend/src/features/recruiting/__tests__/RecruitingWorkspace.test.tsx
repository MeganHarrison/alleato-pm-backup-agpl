/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RECRUITING_LOCAL_STORAGE_KEY } from "@/lib/recruiting/local-repository";

import { RecruitingWorkspace } from "../RecruitingWorkspace";

describe("RecruitingWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists a synthetic intake and stage change across a remount", async () => {
    const user = userEvent.setup();
    const firstRender = render(<RecruitingWorkspace />);

    await screen.findByText(/Revision 0/);
    await user.click(screen.getByRole("button", { name: "Add sample resume" }));
    await user.click(
      screen.getByRole("button", { name: "Add sample applicant" }),
    );
    expect(window.localStorage.getItem(RECRUITING_LOCAL_STORAGE_KEY)).toContain(
      "application-sample",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Taylor Morgan" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(
      screen.getByRole("button", {
        name: "Move Taylor Morgan to another stage",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Move to Review" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "saved locally",
    );

    firstRender.unmount();
    render(<RecruitingWorkspace />);

    await waitFor(() =>
      expect(screen.getByText("Taylor Morgan")).toBeVisible(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Revision 2");
  }, 90_000);

  it("shows a recovery error instead of silently replacing corrupt saved data", async () => {
    window.localStorage.setItem(
      RECRUITING_LOCAL_STORAGE_KEY,
      "{not valid json",
    );

    render(<RecruitingWorkspace />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "not valid JSON",
    );
    expect(
      screen.getByRole("heading", { name: "Applicant Tracker" }),
    ).toBeVisible();
  });

  it("shows a recovery error when browser storage is unavailable", async () => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "localStorage",
    );
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage is blocked.", "SecurityError");
      },
    });

    try {
      render(<RecruitingWorkspace />);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "could not be updated",
      );
      expect(
        screen.getByRole("heading", { name: "Applicant Tracker" }),
      ).toBeVisible();
    } finally {
      if (storageDescriptor) {
        Object.defineProperty(window, "localStorage", storageDescriptor);
      }
    }
  });
});
