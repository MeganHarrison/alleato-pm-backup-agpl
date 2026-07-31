import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database } from "@/types/database.types";

import { assertCommitmentChangeOrderLineItemsUnlocked } from "../commitment-change-order-line-item-lock.server";

type RouteSupabaseClient = SupabaseClient<Database>;

function createSelectChain(result: {
  data: { id: string; project_id: number; status: string | null } | null;
  error: { message: string } | null;
}) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
}

function createSupabaseClientMock(query: ReturnType<typeof createSelectChain>) {
  return {
    from: jest.fn(() => query),
  } as RouteSupabaseClient;
}

describe("assertCommitmentChangeOrderLineItemsUnlocked", () => {
  it("throws a structured precondition error for approved commitment COs", async () => {
    const query = createSelectChain({
      data: {
        id: "cco-1",
        project_id: 42,
        status: "Approved",
      },
      error: null,
    });
    const supabase = createSupabaseClientMock(query);

    await expect(
      assertCommitmentChangeOrderLineItemsUnlocked(
        supabase,
        42,
        "cco-1",
        "test#POST",
      ),
    ).rejects.toMatchObject<Partial<GuardrailError>>({
      code: "PRECONDITION_FAILED",
      message:
        "Approved commitment change orders are read-only. Change the status before editing line items.",
      details: expect.objectContaining({
        errorCode: "COMMITMENT_CHANGE_ORDER_LINE_ITEMS_LOCKED",
        lockReason: "approved",
      }),
    });
  });

  it("allows draft commitment COs through", async () => {
    const row = {
      id: "cco-2",
      project_id: 42,
      status: "draft",
    };
    const query = createSelectChain({
      data: row,
      error: null,
    });
    const supabase = createSupabaseClientMock(query);

    await expect(
      assertCommitmentChangeOrderLineItemsUnlocked(
        supabase,
        42,
        "cco-2",
        "test#POST",
      ),
    ).resolves.toEqual(row);
  });
});
