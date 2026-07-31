export type AiProfileMemoryType =
  | "fact"
  | "preference"
  | "lesson"
  | "commitment"
  | "context";

export type AiProfileMemory = {
  id: string;
  type: AiProfileMemoryType;
  content: string;
  confidence: number;
  importance: number;
  project_id: number | null;
  source: string;
  visibility: string;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number | null;
};

export type AiProfileMemorySummary = {
  total: number;
  privateCount: number;
  teamCount: number;
  projectCount: number;
  preferenceCount: number;
  recent: AiProfileMemory[];
  byType: Record<AiProfileMemoryType, number>;
};

const MEMORY_TYPES: AiProfileMemoryType[] = [
  "preference",
  "commitment",
  "fact",
  "lesson",
  "context",
];

export function buildAiProfileMemorySummary(
  memories: AiProfileMemory[],
): AiProfileMemorySummary {
  const byType = Object.fromEntries(
    MEMORY_TYPES.map((type) => [type, 0]),
  ) as Record<AiProfileMemoryType, number>;

  for (const memory of memories) {
    byType[memory.type] += 1;
  }

  return {
    total: memories.length,
    privateCount: memories.filter((memory) => memory.visibility !== "team")
      .length,
    teamCount: memories.filter((memory) => memory.visibility === "team").length,
    projectCount: memories.filter((memory) => memory.project_id !== null).length,
    preferenceCount: byType.preference,
    recent: [...memories]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 5),
    byType,
  };
}

export function formatAiProfileMemoryType(type: AiProfileMemoryType): string {
  switch (type) {
    case "preference":
      return "Preference";
    case "commitment":
      return "Commitment";
    case "fact":
      return "Fact";
    case "lesson":
      return "Lesson";
    case "context":
      return "Context";
  }
}
