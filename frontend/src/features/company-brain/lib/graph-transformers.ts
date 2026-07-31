import type {
  KnowledgeGraph, KnowledgeNode, KnowledgeNodeType, KnowledgeRelationship,
} from "./graph-types";

/**
 * Live-data seam. When the graph is wired to Supabase / APIs, map each source
 * system's rows into `RawKnowledgeRecord` / `RawKnowledgeLink` and pass them
 * here. The visualization only ever consumes `KnowledgeGraph`, so swapping the
 * data source never touches the rendering layer.
 */

export interface RawKnowledgeRecord {
  id: string;
  type: KnowledgeNodeType;
  title: string;
  summary?: string;
  projectId?: string;
  projectName?: string;
  sourceSystem?: string;
  sourceRecordId?: string;
  createdAt: string;
  updatedAt?: string;
  importance?: number;
  confidence?: number;
}

export interface RawKnowledgeLink {
  id: string;
  from: string;
  to: string;
  type: KnowledgeRelationship["type"];
  strength?: number;
  confidence?: number;
  createdAt?: string;
}

export function transformToKnowledgeGraph(
  records: RawKnowledgeRecord[],
  links: RawKnowledgeLink[],
): KnowledgeGraph {
  const counts = new Map<string, number>();
  const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  links.forEach((l) => { bump(l.from); bump(l.to); });

  const nodes: KnowledgeNode[] = records.map((rec) => ({
    id: rec.id,
    type: rec.type,
    title: rec.title,
    summary: rec.summary,
    projectId: rec.projectId,
    projectName: rec.projectName,
    sourceSystem: rec.sourceSystem,
    sourceRecordId: rec.sourceRecordId,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    importance: rec.importance,
    confidence: rec.confidence,
    relationshipCount: counts.get(rec.id) ?? 0,
  }));

  const known = new Set(nodes.map((n) => n.id));
  const relationships: KnowledgeRelationship[] = links
    .filter((l) => known.has(l.from) && known.has(l.to))
    .map((l) => ({
      id: l.id,
      sourceNodeId: l.from,
      targetNodeId: l.to,
      type: l.type,
      strength: l.strength ?? 0.5,
      confidence: l.confidence,
      createdAt: l.createdAt ?? new Date(0).toISOString(),
    }));

  return { nodes, relationships };
}
