/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";

import { createSkillGrowthDataAccess } from "@/features/training/skill-growth-server";
import { getCurrentUser } from "@/lib/auth/current-user";

import TrainingGrowthPage from "../page";

jest.mock("@/features/training", () => ({
  SkillGrowthClient: () => <div>Skill growth workspace</div>,
}));

jest.mock("@/features/training/skill-growth-server", () => ({
  createSkillGrowthDataAccess: jest.fn(),
}));

jest.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn().mockReturnValue({}),
}));
jest.mock("@/lib/training/server", () => ({
  getRoles: jest.fn().mockResolvedValue([]),
  resolveViewerRole: jest.fn().mockReturnValue("project-manager"),
}));
jest.mock("@/lib/users/current-user-profile-server", () => ({
  loadCurrentUserProfilePayload: jest
    .fn()
    .mockResolvedValue({ title: "Project Manager" }),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

describe("TrainingGrowthPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects signed-out learners to the real authentication route", async () => {
    jest.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(TrainingGrowthPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/auth/login");
    expect(createSkillGrowthDataAccess).not.toHaveBeenCalled();
  });

  it("loads authenticated learner data and renders the shared route", async () => {
    jest.mocked(getCurrentUser).mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    } as never);
    jest.mocked(createSkillGrowthDataAccess).mockReturnValue({
      load: jest.fn().mockResolvedValue({
        roles: [],
        checkins: [],
        historyTruncated: false,
      }),
      save: jest.fn(),
    });

    render(await TrainingGrowthPage());

    expect(screen.getByText("My Growth")).toBeInTheDocument();
    expect(screen.getByText("Skill growth workspace")).toBeInTheDocument();
  });
});
