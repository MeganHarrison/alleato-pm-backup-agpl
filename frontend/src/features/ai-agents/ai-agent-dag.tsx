"use client";

import * as React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
  BackgroundVariant,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { type AiAgent, STATUS_COLORS, STATUS_LABELS } from "./ai-agents-table-config";

// ─── Layout ───────────────────────────────────────────────────────────────────

const NODE_W = 224; // w-56
const NODE_H = 76;
const H_GAP = 48;
const V_GAP = 96;

function computeLayout(agents: AiAgent[]): { nodes: Node[]; edges: Edge[] } {
  const slugToAgent = new Map(agents.map((a) => [a.slug, a]));

  // Depth = longest path from any root (cycle-safe)
  const depth = new Map<string, number>();
  function getDepth(slug: string, visiting = new Set<string>()): number {
    if (depth.has(slug)) return depth.get(slug)!;
    if (visiting.has(slug)) return 0;
    visiting.add(slug);
    const agent = slugToAgent.get(slug);
    if (!agent?.dependencies?.length) {
      depth.set(slug, 0);
      return 0;
    }
    const max = Math.max(
      ...agent.dependencies.map((dep) => getDepth(dep, new Set(visiting))),
    );
    const d = max + 1;
    depth.set(slug, d);
    return d;
  }
  agents.forEach((a) => getDepth(a.slug));

  // Group by depth (rows)
  const byDepth = new Map<number, AiAgent[]>();
  agents.forEach((a) => {
    const d = depth.get(a.slug) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(a);
  });

  // Center each row relative to the widest row
  const maxRowCount = Math.max(...Array.from(byDepth.values()).map((g) => g.length));
  const canvasWidth = maxRowCount * (NODE_W + H_GAP) - H_GAP;

  const nodes: Node[] = [];
  byDepth.forEach((group, row) => {
    const rowWidth = group.length * (NODE_W + H_GAP) - H_GAP;
    const startX = (canvasWidth - rowWidth) / 2;
    group.forEach((agent, i) => {
      nodes.push({
        id: agent.slug,
        type: "agentNode",
        position: { x: startX + i * (NODE_W + H_GAP), y: row * (NODE_H + V_GAP) },
        data: agent as unknown as Record<string, unknown>,
      });
    });
  });

  // Edges: dep → dependent
  const edges: Edge[] = [];
  agents.forEach((agent) => {
    agent.dependencies?.forEach((depSlug) => {
      if (!slugToAgent.has(depSlug)) return;
      edges.push({
        id: `${depSlug}->${agent.slug}`,
        source: depSlug,
        target: agent.slug,
        animated: agent.status === "production" || agent.status === "beta",
        style: { stroke: "hsl(var(--border))", strokeWidth: 1.5 },
        type: "smoothstep",
      });
    });
  });

  return { nodes, edges };
}

// ─── Custom node ──────────────────────────────────────────────────────────────

type AgentNodeData = AiAgent & { onClick?: (agent: AiAgent) => void };

function AgentNode({ data, selected }: NodeProps) {
  const agent = data as unknown as AgentNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />
      <div
        className={`
          w-56 rounded-md bg-muted px-3 py-2.5 text-left cursor-pointer
          transition-shadow hover:shadow-xs
          ${selected ? "ring-2 ring-primary ring-offset-2" : ""}
        `}
        onClick={() => agent.onClick?.(agent)}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${STATUS_COLORS[agent.status]}`}
          >
            {STATUS_LABELS[agent.status]}
          </span>
          {agent.domain && (
            <span className="text-[10px] text-muted-foreground capitalize">{agent.domain}</span>
          )}
          {agent.gapCount > 0 && (
            <span className="ml-auto text-[10px] text-status-warning font-medium">
              {agent.gapCount}⚠
            </span>
          )}
        </div>
        <div className="text-xs font-medium text-foreground leading-snug truncate">
          {agent.name}
        </div>
        {agent.trigger_type && (
          <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">
            {agent.trigger_type}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2" />
    </>
  );
}

const nodeTypes: NodeTypes = { agentNode: AgentNode };

// ─── DAG component ────────────────────────────────────────────────────────────

interface AiAgentDagProps {
  agents: AiAgent[];
  onNodeClick: (agent: AiAgent) => void;
  selectedAgentId: string | null;
}

export function AiAgentDag({ agents, onNodeClick, selectedAgentId }: AiAgentDagProps) {
  const { nodes: baseNodes, edges } = React.useMemo(
    () => computeLayout(agents),
    [agents],
  );

  // Inject onClick + mark selected
  const nodes = React.useMemo(
    () =>
      baseNodes.map((n) => ({
        ...n,
        selected: n.id === selectedAgentId,
        data: { ...(n.data as unknown as AiAgent), onClick: onNodeClick },
      })),
    [baseNodes, selectedAgentId, onNodeClick],
  );

  if (!agents.length) return null;

  return (
    <div className="h-[calc(100vh-10rem)] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
        <Controls showInteractive={false} className="!shadow-xs !border !border-border !rounded-md" />
      </ReactFlow>
    </div>
  );
}
