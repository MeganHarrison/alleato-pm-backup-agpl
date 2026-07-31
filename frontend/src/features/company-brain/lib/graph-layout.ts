import { CATEGORY_META } from "./graph-colors";
import type { KnowledgeGraph, KnowledgeNode, KnowledgeNodeType } from "./graph-types";

/** Stable hash → [0,1) so node offsets/phases are deterministic (no hydration drift). */
export function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export interface ClusterLayout {
  type: KnowledgeNodeType;
  index: number;
  ax: number;
  ay: number;
  nodeIds: string[];
  anchorId: string;
}

export interface NodePlacement {
  bx: number;
  by: number;
  r: number;
  anchor: boolean;
  phase: number;
}

export interface GraphLayout {
  cx: number;
  cy: number;
  brainR: number;
  clusterR: number;
  clusters: ClusterLayout[];
  placement: Map<string, NodePlacement>;
}

/**
 * Places 12 category clusters radially around a central brain and scatters each
 * category's nodes into a soft blob. Offset by half a step so no cluster lands
 * dead-center top (header) or bottom (metrics bar).
 */
export function computeLayout(graph: KnowledgeGraph, W: number, H: number): GraphLayout {
  const cx = W / 2;
  const cy = H / 2;
  const minD = Math.min(W, H);
  const compact = W < 760;
  const brainR = Math.max(70, minD * 0.15);
  const clusterR = minD * (compact ? 0.42 : 0.4);
  const spreadX = compact ? 0.92 : 1.28;
  const blob = minD * (compact ? 0.052 : 0.075);

  const order = CATEGORY_META.map((c) => c.type);
  const byType = new Map<KnowledgeNodeType, KnowledgeNode[]>();
  order.forEach((t) => byType.set(t, []));
  graph.nodes.forEach((n) => byType.get(n.type)?.push(n));

  const clusters: ClusterLayout[] = [];
  const placement = new Map<string, NodePlacement>();
  const step = order.length;

  order.forEach((type, i) => {
    const list = byType.get(type) ?? [];
    const ang = (i / step) * Math.PI * 2 - Math.PI / 2 + Math.PI / step;
    let ax = cx + Math.cos(ang) * clusterR * spreadX;
    let ay = cy + Math.sin(ang) * clusterR;
    ax = Math.max(70, Math.min(W - 70, ax));
    ay = Math.max(104, Math.min(H - 150, ay));

    const nodeIds = list.map((n) => n.id);
    clusters.push({ type, index: i, ax, ay, nodeIds, anchorId: nodeIds[0] ?? "" });

    list.forEach((node, k) => {
      const ox = (hash01(node.id + "x") * 2 - 1);
      const oy = (hash01(node.id + "y") * 2 - 1);
      placement.set(node.id, {
        bx: k === 0 ? ax : ax + ox * blob,
        by: k === 0 ? ay : ay + oy * blob * 0.9,
        r: k === 0 ? 5.5 : 2.4 + hash01(node.id + "r") * 1.8,
        anchor: k === 0,
        phase: hash01(node.id + "p") * 6.28,
      });
    });
  });

  return { cx, cy, brainR, clusterR, clusters, placement };
}
