/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { requireAppAdminPageAccess } from "@/lib/auth/require-app-admin";
import ProjectCreationLogPage from "../page";

jest.mock("@/lib/auth/require-app-admin", () => ({
  requireAppAdminPageAccess: jest.fn(),
}));

jest.mock("../project-creation-log-client", () => ({
  ProjectCreationLogClient: () => <div>Project creation log table</div>,
}));

describe("ProjectCreationLogPage", () => {
  it("uses the app-admin page gate before rendering the table", async () => {
    render(await ProjectCreationLogPage());

    expect(requireAppAdminPageAccess).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Project creation log table")).toBeInTheDocument();
  });
});
