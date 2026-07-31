import { beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from },
}));

import {
  PlaneDraftsRepositoryError,
  updatePlaneDraft,
} from "./plane-drafts-repository";

function updateChain(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown]> = [];
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn((column: string, value: unknown) => {
      calls.push([column, value]);
      return chain;
    }),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return { chain, calls };
}

beforeEach(() => vi.clearAllMocks());

describe("Plane Drafts optimistic concurrency", () => {
  it("adds the client-observed version to the atomic update predicate", async () => {
    const { chain, calls } = updateChain({
      data: { id: "916fab35-3ca4-4576-abf5-f030f0276bf6", version: 3 },
      error: null,
    });
    from.mockReturnValue(chain);

    await updatePlaneDraft({
      projectId: 31,
      userId: "64f01345-828c-45ad-936e-1d776a1b3cf4",
      id: "916fab35-3ca4-4576-abf5-f030f0276bf6",
      expectedVersion: 2,
      updates: { title: "Revised" },
    });

    expect(calls).toContainEqual(["version", 2]);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ version: 3 }),
    );
  });

  it("fails loudly with a conflict when the compare-and-swap matches no row", async () => {
    const { chain } = updateChain({ data: null, error: null });
    from.mockReturnValue(chain);

    await expect(
      updatePlaneDraft({
        projectId: 31,
        userId: "64f01345-828c-45ad-936e-1d776a1b3cf4",
        id: "916fab35-3ca4-4576-abf5-f030f0276bf6",
        expectedVersion: 2,
        updates: { status: "final" },
      }),
    ).rejects.toMatchObject<Partial<PlaneDraftsRepositoryError>>({
      kind: "conflict",
    });
  });
});

