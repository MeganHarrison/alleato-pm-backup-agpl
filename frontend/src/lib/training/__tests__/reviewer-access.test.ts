jest.mock("server-only", () => ({}));

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

import {
  canCurrentUserReviewTraining,
  requireTrainingReviewer,
  requireTrainingReviewerPageAccess,
} from "../reviewer-access";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

jest.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const redirectMock = jest.mocked(redirect);
const getCurrentUserMock = jest.mocked(getCurrentUser);
const createClientMock = jest.mocked(createClient);
const rpcMock = jest.fn();
const reviewerId = "a50665e0-509d-4d87-a930-d2cfd3abc22a";

describe("training reviewer access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentUserMock.mockResolvedValue({ id: reviewerId } as never);
    createClientMock.mockResolvedValue({ rpc: rpcMock } as never);
  });

  it("uses current_is_app_admin as the shared visibility and identity owner", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    await expect(canCurrentUserReviewTraining()).resolves.toBe(true);
    await expect(requireTrainingReviewer("training.test")).resolves.toBe(
      reviewerId,
    );
    await expect(requireTrainingReviewerPageAccess()).resolves.toBe(reviewerId);

    expect(rpcMock).toHaveBeenCalledTimes(3);
    expect(rpcMock).toHaveBeenCalledWith("current_is_app_admin");
  });

  it("denies an is_admin profile that does not satisfy the active-person RPC", async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    await expect(canCurrentUserReviewTraining()).resolves.toBe(false);
    await expect(requireTrainingReviewer("training.test")).rejects.toThrow(
      "Training reviewer access required.",
    );
    await expect(requireTrainingReviewerPageAccess()).rejects.toThrow(
      "REDIRECT:/access-denied?reason=training-reviewer",
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/access-denied?reason=training-reviewer",
    );
  });

  it("redirects an anonymous page caller and rejects an anonymous mutation", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(requireTrainingReviewer("training.test")).rejects.toThrow(
      "Sign in before accessing training review controls.",
    );
    await expect(requireTrainingReviewerPageAccess()).rejects.toThrow(
      "REDIRECT:/auth/login",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("fails loudly when the canonical admin RPC is unavailable", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "RPC unavailable" },
    });

    await expect(canCurrentUserReviewTraining()).rejects.toThrow(
      "Training reviewer access check failed: RPC unavailable",
    );
  });
});
