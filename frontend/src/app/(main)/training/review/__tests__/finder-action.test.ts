/** @jest-environment jsdom */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runTrainingResourceFinderAdmin } from "@/lib/training/admin-finder";
import { requireTrainingReviewer } from "@/lib/training/reviewer-access";

import { findTrainingResources } from "../finder-action";

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

jest.mock("@/lib/training/admin-finder", () => ({
  runTrainingResourceFinderAdmin: jest.fn(),
}));

jest.mock("@/lib/training/reviewer-access", () => ({
  requireTrainingReviewer: jest.fn(),
}));

const runFinderMock = jest.mocked(runTrainingResourceFinderAdmin);
const requireReviewerMock = jest.mocked(requireTrainingReviewer);
const revalidatePathMock = jest.mocked(revalidatePath);
const redirectMock = jest.mocked(redirect);

function finderForm(
  roleSlug = "project-manager",
  topicSlug = "change-management",
) {
  const formData = new FormData();
  formData.set("roleSlug", roleSlug);
  formData.set("topicSlug", topicSlug);
  return formData;
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    status: "completed" as const,
    query: "construction training",
    roleSlug: "project-manager",
    topicSlug: "change-management",
    dryRun: false,
    searchedCount: 3,
    acceptedCount: 1,
    insertedCount: 1,
    duplicateCount: 1,
    rejectedCount: 1,
    failedCount: 0,
    outcomes: [],
    ...overrides,
  };
}

describe("findTrainingResources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireReviewerMock.mockResolvedValue(
      "a50665e0-509d-4d87-a930-d2cfd3abc22a",
    );
  });

  it("checks app-admin access before creating review candidates", async () => {
    runFinderMock.mockResolvedValue(result());

    await expect(findTrainingResources(finderForm())).rejects.toThrow(
      /reviewStatus=success/,
    );

    expect(requireReviewerMock).toHaveBeenCalledWith("training.findResources");
    expect(requireReviewerMock.mock.invocationCallOrder[0]).toBeLessThan(
      runFinderMock.mock.invocationCallOrder[0],
    );
    expect(runFinderMock).toHaveBeenCalledWith({
      roleSlug: "project-manager",
      topicSlug: "change-management",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/training/review");
    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("Added+1+review+candidate"),
    );
  });

  it("fails before the backend when app-admin access is denied", async () => {
    requireReviewerMock.mockRejectedValue(
      new Error("Training reviewer access required."),
    );

    await expect(findTrainingResources(finderForm())).rejects.toThrow(
      /reviewStatus=error/,
    );

    expect(runFinderMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("Training+reviewer+access+required"),
    );
  });

  it("surfaces partial writes as an error while refreshing the queue", async () => {
    runFinderMock.mockResolvedValue(
      result({ status: "partial", insertedCount: 1, failedCount: 2 }),
    );

    await expect(findTrainingResources(finderForm())).rejects.toThrow(
      /reviewStatus=error/,
    );

    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("but+2+writes+failed"),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/training/review");
  });

  it("rejects malformed role or topic slugs before authorization or backend work", async () => {
    await expect(
      findTrainingResources(finderForm("not a slug")),
    ).rejects.toThrow(/Choose\+a\+valid\+training\+role/);

    expect(requireReviewerMock).not.toHaveBeenCalled();
    expect(runFinderMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
