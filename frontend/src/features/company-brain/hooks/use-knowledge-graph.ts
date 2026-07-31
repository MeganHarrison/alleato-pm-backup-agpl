"use client";

import { useMemo } from "react";

import { buildMockKnowledgeGraph } from "../lib/mock-knowledge-data";
import type {
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeRelationship,
  TimeRange,
} from "../lib/graph-types";

export interface KnowledgeGraphIndex {
  graph: KnowledgeGraph;
  nodeById: Map<string, KnowledgeNode>;
  relationshipsByNode: Map<string, KnowledgeRelationship[]>;
  neighbors: (nodeId: string) => Set<string>;
}

const RANGE_WINDOW_MS: Partial<Record<TimeRange, number>> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function filterKnowledgeGraphByTimeRange(
  graph: KnowledgeGraph,
  timeRange: TimeRange,
  now = new Date(),
): KnowledgeGraph {
  const windowMs = RANGE_WINDOW_MS[timeRange];
  if (!windowMs) return graph;

  const cutoff = now.getTime() - windowMs;
  const nodes = graph.nodes.filter((node) => {
    const createdAt = new Date(node.createdAt).getTime();
    return Number.isFinite(createdAt) && createdAt >= cutoff;
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const relationships = graph.relationships.filter(
    (relationship) =>
      nodeIds.has(relationship.sourceNodeId) &&
      nodeIds.has(relationship.targetNodeId),
  );
  const relationshipCountByNode = new Map<string, number>();
  relationships.forEach((relationship) => {
    relationshipCountByNode.set(
      relationship.sourceNodeId,
      (relationshipCountByNode.get(relationship.sourceNodeId) ?? 0) + 1,
    );
    relationshipCountByNode.set(
      relationship.targetNodeId,
      (relationshipCountByNode.get(relationship.targetNodeId) ?? 0) + 1,
    );
  });

  return {
    nodes: nodes.map((node) => ({
      ...node,
      relationshipCount: relationshipCountByNode.get(node.id) ?? 0,
    })),
    relationships,
  };
}

/**
 * Provides the knowledge graph plus lookup indexes. Currently seeded from
 * deterministic mock data; swap `buildMockKnowledgeGraph` for a live loader
 * (see `graph-transformers.ts`) without changing consumers.
 */
export function useKnowledgeGraph(
  seed?: number,
  timeRange: TimeRange = "live",
): KnowledgeGraphIndex {
  return useMemo(() => {
    const graph = filterKnowledgeGraphByTimeRange(
      buildMockKnowledgeGraph(seed),
      timeRange,
    );
    const nodeById = new Map<string, KnowledgeNode>();
    graph.nodes.forEach((n) => nodeById.set(n.id, n));

    const relationshipsByNode = new Map<string, KnowledgeRelationship[]>();
    const addRel = (id: string, r: KnowledgeRelationship) => {
      const list = relationshipsByNode.get(id);
      if (list) list.push(r);
      else relationshipsByNode.set(id, [r]);
    };
    graph.relationships.forEach((r) => {
      addRel(r.sourceNodeId, r);
      addRel(r.targetNodeId, r);
    });

    const neighbors = (nodeId: string) => {
      const set = new Set<string>();
      (relationshipsByNode.get(nodeId) ?? []).forEach((r) => {
        set.add(r.sourceNodeId === nodeId ? r.targetNodeId : r.sourceNodeId);
      });
      return set;
    };

    return { graph, nodeById, relationshipsByNode, neighbors };
  }, [seed, timeRange]);
}
