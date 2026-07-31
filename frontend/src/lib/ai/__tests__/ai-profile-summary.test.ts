import {
  buildAiProfileMemorySummary,
  formatAiProfileMemoryType,
  type AiProfileMemory,
} from "@/lib/ai/ai-profile-summary";

const baseMemory: AiProfileMemory = {
  id: "mem_1",
  type: "fact",
  content: "Megan owns project intelligence rollout decisions.",
  confidence: 0.92,
  importance: 0.8,
  project_id: null,
  source: "manual",
  visibility: "private",
  created_at: "2026-06-20T12:00:00.000Z",
  last_accessed_at: null,
  access_count: 0,
};

describe("ai profile summary", () => {
  it("summarizes counts by type, visibility, and project scope", () => {
    const summary = buildAiProfileMemorySummary([
      baseMemory,
      {
        ...baseMemory,
        id: "mem_2",
        type: "preference",
        visibility: "team",
        project_id: 25125,
      },
      {
        ...baseMemory,
        id: "mem_3",
        type: "commitment",
        visibility: "private",
        project_id: 25125,
      },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.privateCount).toBe(2);
    expect(summary.teamCount).toBe(1);
    expect(summary.projectCount).toBe(2);
    expect(summary.preferenceCount).toBe(1);
    expect(summary.byType).toMatchObject({
      commitment: 1,
      context: 0,
      fact: 1,
      lesson: 0,
      preference: 1,
    });
  });

  it("keeps the five newest memories for review", () => {
    const memories = Array.from({ length: 7 }, (_, index) => ({
      ...baseMemory,
      id: `mem_${index}`,
      created_at: `2026-06-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
    }));

    const summary = buildAiProfileMemorySummary(memories);

    expect(summary.recent.map((memory) => memory.id)).toEqual([
      "mem_6",
      "mem_5",
      "mem_4",
      "mem_3",
      "mem_2",
    ]);
  });

  it("returns stable empty counts when there are no memories", () => {
    const summary = buildAiProfileMemorySummary([]);

    expect(summary).toMatchObject({
      total: 0,
      privateCount: 0,
      teamCount: 0,
      projectCount: 0,
      preferenceCount: 0,
    });
    expect(summary.recent).toEqual([]);
    expect(summary.byType.preference).toBe(0);
  });

  it("formats memory type labels for display", () => {
    expect(formatAiProfileMemoryType("commitment")).toBe("Commitment");
    expect(formatAiProfileMemoryType("context")).toBe("Context");
  });
});
