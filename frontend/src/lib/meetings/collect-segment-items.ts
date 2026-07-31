import { dedupeSemanticText } from "./text-dedupe";

interface SegmentLike {
  tasks?: unknown;
  risks?: unknown;
  decisions?: unknown;
  opportunities?: unknown;
}

function extractText(item: unknown): string | null {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const description = (item as Record<string, unknown>).description;
    if (typeof description === "string") return description;
  }
  return null;
}

export interface CollectedSegmentItems {
  tasks: string[];
  risks: string[];
  decisions: string[];
  opportunities: string[];
}

export function collectSegmentItems(
  segments: SegmentLike[]
): CollectedSegmentItems {
  const tasks: string[] = [];
  const risks: string[] = [];
  const decisions: string[] = [];
  const opportunities: string[] = [];

  for (const segment of segments) {
    const sources: Array<[unknown, string[]]> = [
      [segment.tasks, tasks],
      [segment.risks, risks],
      [segment.decisions, decisions],
      [segment.opportunities, opportunities],
    ];
    for (const [source, target] of sources) {
      if (!Array.isArray(source)) continue;
      for (const item of source as unknown[]) {
        const text = extractText(item);
        if (text) target.push(text);
      }
    }
  }

  return {
    tasks: dedupeSemanticText(tasks),
    risks: dedupeSemanticText(risks),
    decisions: dedupeSemanticText(decisions),
    opportunities: dedupeSemanticText(opportunities),
  };
}
