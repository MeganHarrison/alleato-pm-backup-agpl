/** @jest-environment jsdom */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { reviewFreshnessCheck, reviewResource } from "@/lib/training/server";

import { decideTrainingFreshness, decideTrainingResource } from "../actions";

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

jest.mock("@/lib/training/server", () => ({
  reviewFreshnessCheck: jest.fn(),
  reviewResource: jest.fn(),
}));

const reviewFreshnessCheckMock = jest.mocked(reviewFreshnessCheck);
const reviewResourceMock = jest.mocked(reviewResource);
const revalidatePathMock = jest.mocked(revalidatePath);
const redirectMock = jest.mocked(redirect);
const resourceId = "9b2ce458-b438-4147-96a0-54f28a58b994";
const checkId = "10eaaf47-e1fc-4867-8954-05911f10f298";

function reviewForm(
  decision: "publish" | "archive",
  notes = decision === "archive" ? "This source is not suitable." : "",
) {
  const formData = new FormData();
  formData.set("resourceId", resourceId);
  formData.set("decision", decision);
  formData.set(
    "reasonCodes",
    decision === "publish" ? "field_applicable" : "wrong_role_topic",
  );
  formData.set("relevance", "4");
  formData.set("depth", "4");
  formData.set("quality", "4");
  formData.set("notes", notes);
  return formData;
}

function freshnessForm(
  decision: "keep" | "archive",
  notes = "The source evidence was reviewed.",
) {
  const formData = new FormData();
  formData.set("checkId", checkId);
  formData.set("decision", decision);
  formData.set("notes", notes);
  return formData;
}

describe("decideTrainingResource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("publishes through the canonical mutation and revalidates reviewer and learner routes", async () => {
    reviewResourceMock.mockResolvedValue("published");

    await expect(
      decideTrainingResource({ status: "idle" }, reviewForm("publish")),
    ).rejects.toThrow(
      "REDIRECT:/training/review?reviewStatus=success&reviewMessage=Training+resource+published.",
    );

    expect(reviewResourceMock).toHaveBeenCalledWith({
      resourceId,
      decision: "publish",
      reasonCodes: ["field_applicable"],
      ratings: { relevance: 4, depth: 4, quality: 4 },
    });
    expect(revalidatePathMock).toHaveBeenNthCalledWith(1, "/training/review");
    expect(revalidatePathMock).toHaveBeenNthCalledWith(2, "/training");
  });

  it("returns a specific mutation failure without claiming success", async () => {
    reviewResourceMock.mockRejectedValue(
      new Error(
        `Training resource ${resourceId} is no longer pending review. Refresh the queue before deciding again.`,
      ),
    );

    await expect(
      decideTrainingResource({ status: "idle" }, reviewForm("archive")),
    ).resolves.toEqual({
      status: "error",
      message: expect.stringContaining("no longer pending review"),
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("records the administrator explanation when archiving a candidate", async () => {
    reviewResourceMock.mockResolvedValue("archived");

    await expect(
      decideTrainingResource(
        { status: "idle" },
        reviewForm("archive", "The source is paid and too shallow."),
      ),
    ).rejects.toThrow(/Training\+resource\+archived/);

    expect(reviewResourceMock).toHaveBeenCalledWith({
      resourceId,
      decision: "archive",
      reasonCodes: ["wrong_role_topic"],
      ratings: { relevance: 4, depth: 4, quality: 4 },
      notes: "The source is paid and too shallow.",
    });
  });

  it("requires explanatory feedback before archiving", async () => {
    await expect(
      decideTrainingResource(
        { status: "idle" },
        reviewForm("archive", "short"),
      ),
    ).resolves.toEqual({
      status: "error",
      message: expect.stringMatching(/explain what is wrong/i),
    });

    expect(reviewResourceMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects malformed input before calling the mutation", async () => {
    const formData = new FormData();
    formData.set("resourceId", "not-a-resource");
    formData.set("decision", "publish");

    await expect(
      decideTrainingResource({ status: "idle" }, formData),
    ).resolves.toEqual({
      status: "error",
      message: expect.stringMatching(/select reasons/i),
    });
    expect(reviewResourceMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("decideTrainingFreshness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["keep", /Training\+resource\+kept/],
    ["archive", /Stale\+training\+resource\+archived/],
  ] as const)(
    "records a %s decision with reviewer feedback",
    async (decision, message) => {
      reviewFreshnessCheckMock.mockResolvedValue(decision);

      await expect(
        decideTrainingFreshness(freshnessForm(decision)),
      ).rejects.toThrow(message);

      expect(reviewFreshnessCheckMock).toHaveBeenCalledWith({
        checkId,
        decision,
        notes: "The source evidence was reviewed.",
      });
      expect(revalidatePathMock).toHaveBeenNthCalledWith(1, "/training/review");
      expect(revalidatePathMock).toHaveBeenNthCalledWith(2, "/training");
    },
  );

  it("rejects missing reviewer feedback before mutation", async () => {
    await expect(
      decideTrainingFreshness(freshnessForm("archive", "short")),
    ).rejects.toThrow(/add\+a\+short\+review\+note/i);

    expect(reviewFreshnessCheckMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("surfaces a named freshness mutation failure", async () => {
    reviewFreshnessCheckMock.mockRejectedValue(
      new Error("This freshness finding was already reviewed."),
    );

    await expect(
      decideTrainingFreshness(freshnessForm("keep")),
    ).rejects.toThrow(/reviewStatus=error/);
    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("already+reviewed"),
    );
  });
});
