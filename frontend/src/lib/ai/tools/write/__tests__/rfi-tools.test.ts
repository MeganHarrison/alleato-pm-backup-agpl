jest.mock("ai", () => ({
  tool: (definition: unknown) => definition,
}));

import { createRfiWriteTools } from "../rfi-tools";

function createInternals() {
  const maybeExistingNumbers = {
    eq: jest.fn(() => maybeExistingNumbers),
    order: jest.fn(() => maybeExistingNumbers),
    limit: jest.fn(async () => ({
      data: [{ number: 11 }],
      error: null,
    })),
  };
  const insertResult = {
    select: jest.fn(() => insertResult),
    single: jest.fn(async () => ({
      data: {
        id: "rfi-12",
        number: 12,
        status: "open",
        subject: "Clarify ceiling support",
      },
      error: null,
    })),
  };
  const rfiTable = {
    select: jest.fn(() => maybeExistingNumbers),
    insert: jest.fn(() => insertResult),
  };
  const supabase = {
    from: jest.fn((tableName: string) => {
      if (tableName !== "rfis") {
        throw new Error(`Unexpected table ${tableName}`);
      }
      return rfiTable;
    }),
  };
  const recordWriteAudit = jest.fn(async () => undefined);
  const finalizeWriteAudit = jest.fn(async () => undefined);
  const failWriteAudit = jest.fn(async () => undefined);
  const getReplayResponse = jest.fn(async () => null);

  return {
    internals: {
      userId: "00000000-0000-4000-8000-000000000001",
      options: {},
      supabase,
      resolveIdempotencyKey: jest.fn(() => "eve-receipt-1"),
      getReplayResponse,
      recordWriteAudit,
      finalizeWriteAudit,
      failWriteAudit,
      enforceProjectWriteAccess: jest.fn(async () => ({
        ok: true as const,
        projectId: 67,
      })),
    } as never,
    rfiTable,
    recordWriteAudit,
    finalizeWriteAudit,
    failWriteAudit,
    getReplayResponse,
  };
}

const approvedInput = {
  projectId: 67,
  subject: "Clarify ceiling support",
  question: "Which support detail governs above Corridor 2?",
  costImpact: "tbd" as const,
  scheduleImpact: "no" as const,
  confirmed: true,
  idempotencyKey: "eve-receipt-1",
};

it("reserves the Eve idempotency receipt before inserting one RFI", async () => {
  const fixture = createInternals();
  const execute = createRfiWriteTools(fixture.internals).createRFI
    .execute;
  if (!execute) throw new Error("createRFI execute is missing");

  const output = await execute(approvedInput, {
    toolCallId: "call-1",
    messages: [],
  } as never);

  expect(output).toMatchObject({
    success: true,
    record: { id: "rfi-12", number: 12 },
  });
  expect(fixture.recordWriteAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      idempotencyKey: "eve-receipt-1",
      status: "pending",
      toolName: "createRFI",
    }),
  );
  expect(
    fixture.recordWriteAudit.mock.invocationCallOrder[0],
  ).toBeLessThan(fixture.rfiTable.insert.mock.invocationCallOrder[0]);
  expect(fixture.rfiTable.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      created_by: "00000000-0000-4000-8000-000000000001",
      number: 12,
      project_id: 67,
    }),
  );
  expect(fixture.finalizeWriteAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      idempotencyKey: "eve-receipt-1",
      toolName: "createRFI",
    }),
  );
});

it("returns the existing receipt and performs zero writes on replay", async () => {
  const fixture = createInternals();
  fixture.getReplayResponse.mockResolvedValue({
    success: true,
    record: { id: "rfi-existing", number: 12 },
  });
  const execute = createRfiWriteTools(fixture.internals).createRFI
    .execute;
  if (!execute) throw new Error("createRFI execute is missing");

  const output = await execute(approvedInput, {
    toolCallId: "call-replayed",
    messages: [],
  } as never);

  expect(output).toMatchObject({
    success: true,
    record: { id: "rfi-existing" },
  });
  expect(fixture.recordWriteAudit).not.toHaveBeenCalled();
  expect(fixture.rfiTable.insert).not.toHaveBeenCalled();
  expect(fixture.finalizeWriteAudit).not.toHaveBeenCalled();
});
