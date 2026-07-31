jest.mock("server-only", () => ({}));

const mockListPackets = jest.fn();
const mockFrom = jest.fn();

jest.mock("../canonical-packets", () => ({
  listDailyExecutiveBriefPackets: mockListPackets,
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: mockFrom },
}));

import { listAdminDailyBriefHistory } from "../admin-history";

const packet = (overrides = {}) => ({
  id: "brief-1",
  businessDate: "2026-07-18",
  packetType: "current",
  generatedAt: "2026-07-18T12:00:00.000Z",
  compilerVersion: "v3",
  sourceIds: ["source-embedded", "source-terminal", "source-missing"],
  sources: [],
  brief: { version: "v3", projects: [] },
  ...overrides,
});

describe("admin daily brief history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps every packet revision and derives RAG readback state from source ids", async () => {
    mockListPackets.mockResolvedValue([
      packet(),
      packet({ id: "brief-1-snapshot", packetType: "snapshot", sourceIds: ["source-terminal"] }),
    ]);
    const inMock = jest.fn().mockResolvedValue({
      data: [
        { id: "source-embedded", embedding_status: "embedded", parsing_status: "complete" },
        { id: "source-terminal", embedding_status: "skipped_low_content", parsing_status: "complete" },
      ],
      error: null,
    });
    const selectMock = jest.fn().mockReturnValue({ in: inMock });
    mockFrom.mockReturnValue({ select: selectMock });

    await expect(listAdminDailyBriefHistory()).resolves.toEqual([
      expect.objectContaining({
        id: "brief-1",
        sourceCount: 3,
        embeddedSourceCount: 1,
        terminalSourceCount: 1,
        missingSourceCount: 1,
        briefFormat: "structured",
      }),
      expect.objectContaining({
        id: "brief-1-snapshot",
        packetType: "snapshot",
        sourceCount: 1,
        embeddedSourceCount: 0,
        terminalSourceCount: 1,
        missingSourceCount: 0,
      }),
    ]);
    expect(mockFrom).toHaveBeenCalledWith("rag_document_metadata");
    expect(inMock).toHaveBeenCalledWith("id", ["source-embedded", "source-terminal", "source-missing"]);
  });

  it("fails loudly when the RAG readback is unavailable", async () => {
    mockListPackets.mockResolvedValue([packet()]);
    const inMock = jest.fn().mockResolvedValue({ data: null, error: { message: "RAG is unavailable" } });
    mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue({ in: inMock }) });

    await expect(listAdminDailyBriefHistory()).rejects.toThrow(
      "Daily Brief admin RAG readback failed: RAG is unavailable",
    );
  });
});
