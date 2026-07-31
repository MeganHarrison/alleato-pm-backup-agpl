import { redirect } from "next/navigation";

import ProjectsPage from "../page";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("legacy projects route", () => {
  it("redirects to the canonical company portfolio", () => {
    ProjectsPage();

    expect(redirect).toHaveBeenCalledWith("/");
  });
});
