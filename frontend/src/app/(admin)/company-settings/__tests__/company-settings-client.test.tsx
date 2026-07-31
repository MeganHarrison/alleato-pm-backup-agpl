/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";

import { CompanySettingsClient } from "../company-settings-client";
import CompanySettingsPage from "../page";

jest.mock("@/lib/auth/require-app-admin", () => ({
  requireAppAdminPageAccess: jest.fn(),
}));

describe("CompanySettingsClient", () => {
  it("changes the active catalog without exposing protected settings as editable", () => {
    render(<CompanySettingsClient />);

    expect(screen.getByRole("heading", { name: "Access & organization" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage users" })).toHaveAttribute(
      "href",
      "/user-management",
    );

    fireEvent.click(screen.getByRole("button", { name: "Meetings" }));

    expect(screen.getByRole("heading", { name: "Meetings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage templates" })).toHaveAttribute(
      "href",
      "/meeting-templates",
    );
    expect(screen.getByText("Meeting types")).toBeInTheDocument();
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /meeting types/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Audit & operations" }));

    expect(screen.getByRole("link", { name: "View creation log" })).toHaveAttribute(
      "href",
      "/company-settings/project-creation-log",
    );
  });
});

describe("CompanySettingsPage", () => {
  const { requireAppAdminPageAccess: requireAppAdminPageAccessMock } =
    jest.requireMock("@/lib/auth/require-app-admin") as {
      requireAppAdminPageAccess: jest.Mock;
    };

  beforeEach(() => {
    requireAppAdminPageAccessMock.mockReset();
  });

  it("uses the app-admin page guard instead of the legacy dashboard allowlist", async () => {
    render(await CompanySettingsPage());

    expect(requireAppAdminPageAccessMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Company Settings" })).toBeInTheDocument();
  });
});
