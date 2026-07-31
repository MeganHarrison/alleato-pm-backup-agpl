/**
 * Company Brain — knowledge graph data contract.
 *
 * The visualization binds ONLY to these shapes. Raw Supabase / API records are
 * converted into `KnowledgeNode` / `KnowledgeRelationship` by a transformer
 * (see `graph-transformers.ts`), so the graph never depends on table shapes.
 */

export type KnowledgeNodeType =
  | "meeting"
  | "email"
  | "teams_message"
  | "document"
  | "drawing"
  | "task"
  | "rfi"
  | "submittal"
  | "change_event"
  | "decision"
  | "risk"
  | "opportunity";

export interface KnowledgeNode {
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
  relationshipCount: number;
  metadata?: Record<string, unknown>;
}

export type KnowledgeRelationshipType =
  | "references"
  | "generated"
  | "related_to"
  | "caused"
  | "resolved"
  | "assigned"
  | "impacts"
  | "supports"
  | "contradicts"
  | "derived_from";

export interface KnowledgeRelationship {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: KnowledgeRelationshipType;
  strength: number;
  confidence?: number;
  createdAt: string;
}

export interface KnowledgeActivity {
  id: string;
  nodeId: string;
  action: "created" | "updated" | "connected" | "processed";
  occurredAt: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
}

export type TimeRange = "live" | "24h" | "7d" | "30d" | "all";
