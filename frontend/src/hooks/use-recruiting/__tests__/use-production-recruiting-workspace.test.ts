/** @jest-environment jsdom */

import { runIdempotentRecruitingMutation } from "@/hooks/use-recruiting/use-production-recruiting-workspace";

describe("runIdempotentRecruitingMutation", () => {
  it("reuses the command key when the real reload contract reports failure", async () => {
    const pendingKeys = new Map<
      string,
      { idempotencyKey: string; requestHash: string }
    >();
    const executedCommands: Array<{
      idempotencyKey: string;
      requestHash: string;
    }> = [];
    const execute = jest.fn(async (
      idempotencyKey: string,
      requestHash: string,
    ) => {
      executedCommands.push({ idempotencyKey, requestHash });
    });
    const firstReload = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);

    await expect(
      runIdempotentRecruitingMutation({
        pendingKeys,
        operationKey: "requisition.create:REQ-101",
        execute,
        reload: firstReload,
      }),
    ).rejects.toThrow("saved, but current recruiting data could not be reloaded");

    expect(pendingKeys.get("requisition.create:REQ-101")).toEqual(
      executedCommands[0],
    );

    await runIdempotentRecruitingMutation({
      pendingKeys,
      operationKey: "requisition.create:REQ-101",
      execute,
      reload: async () => true,
    });

    expect(executedCommands[1]).toEqual(executedCommands[0]);
    expect(pendingKeys.has("requisition.create:REQ-101")).toBe(false);
  });
});
