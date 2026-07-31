/** @jest-environment jsdom */

import { getPersistedActionToolParts } from "../persisted-action-tool-parts";

describe("persisted assistant action widgets", () => {
  it("rehydrates a Prime Contract draft from its persisted tool trace", () => {
    const parts = getPersistedActionToolParts([
      {
        tool: "createPrimeContract",
        status: "success",
        timestamp: "2026-07-18T12:00:00.000Z",
        input: { projectId: 43, confirmed: false },
        output: {
          action: "preview",
          widget: {
            type: "prime_contract_draft",
            id: "prime-contract-draft-43-PC-0004",
            title: "Prime Contract draft",
          },
        },
      },
    ]);

    expect(parts).toEqual([
      expect.objectContaining({
        type: "tool-createPrimeContract",
        state: "output-available",
        output: expect.objectContaining({
          widget: expect.objectContaining({ type: "prime_contract_draft" }),
        }),
      }),
    ]);
  });

  it("does not promote unknown traces into chat UI", () => {
    expect(
      getPersistedActionToolParts([
        {
          tool: "unregisteredWriteTool",
          status: "success",
          output: { success: true },
        },
      ]),
    ).toEqual([]);
  });
});
