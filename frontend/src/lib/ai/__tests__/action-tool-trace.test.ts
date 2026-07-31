import { preserveActionToolTraceOutput } from "../action-tool-trace";

describe("preserveActionToolTraceOutput", () => {
  it("keeps structured createChangeEvent output available for chat cards", () => {
    const output = preserveActionToolTraceOutput({
      rawOutput: {
        success: true,
        message: "Change request logged.",
        record: {
          id: "ce-1",
          project_id: 1067,
          number: "001",
          title: "CR-9299-0030 Design Updates",
          status: "Open",
        },
      },
      summarizedOutput: {
        source: null,
        count: null,
        summary: null,
        error: null,
      },
    });

    expect(output).toMatchObject({
      success: true,
      message: "Change request logged.",
      record: {
        id: "ce-1",
        project_id: 1067,
      },
    });
  });

  it("leaves ordinary read-tool summaries compact", () => {
    expect(
      preserveActionToolTraceOutput({
        rawOutput: { source: "semantic", count: 3 },
        summarizedOutput: { source: "semantic", count: 3 },
      }),
    ).toEqual({ source: "semantic", count: 3 });
  });

  it("preserves a generative UI receipt so it can rehydrate after reload", () => {
    const output = preserveActionToolTraceOutput({
      rawOutput: {
        success: true,
        action: "created",
        receipt: { status: "complete", contractId: "contract-1" },
        widget: {
          type: "prime_contract_draft",
          id: "prime-contract-contract-1",
          status: "created",
        },
      },
      summarizedOutput: { error: null },
    });

    expect(output).toMatchObject({
      receipt: { status: "complete", contractId: "contract-1" },
      widget: {
        type: "prime_contract_draft",
        status: "created",
      },
    });
  });
});
