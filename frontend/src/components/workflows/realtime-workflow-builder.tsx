"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CircleAlert,
  Plus,
  RefreshCw,
  Trash2,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useRealtimeFlow,
  type RealtimeFlowStatus,
} from "@/hooks/use-realtime-flow";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

type WorkflowStepData = {
  title: string;
  description: string;
  kind: "trigger" | "action" | "review";
};

type WorkflowStepNode = Node<WorkflowStepData, "workflowStep">;

type WorkflowEditorContextValue = {
  updateNode: (id: string, patch: Partial<WorkflowStepData>) => void;
  removeNode: (id: string) => void;
};

const WorkflowEditorContext =
  React.createContext<WorkflowEditorContextValue | null>(null);

const INITIAL_NODES: WorkflowStepNode[] = [
  {
    id: "daily-trigger",
    type: "workflowStep",
    position: { x: 40, y: 160 },
    data: {
      title: "Daily schedule",
      description: "Start at 9:30 AM UTC",
      kind: "trigger",
    },
  },
  {
    id: "collect-sources",
    type: "workflowStep",
    position: { x: 340, y: 160 },
    data: {
      title: "Collect source activity",
      description: "Meetings, email, and project records",
      kind: "action",
    },
  },
  {
    id: "generate-recap",
    type: "workflowStep",
    position: { x: 640, y: 160 },
    data: {
      title: "Generate daily recap",
      description: "Compile current project context",
      kind: "action",
    },
  },
  {
    id: "review-brief",
    type: "workflowStep",
    position: { x: 940, y: 160 },
    data: {
      title: "Review briefing packet",
      description: "Hold delivery until approved",
      kind: "review",
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  {
    id: "daily-trigger-collect-sources",
    source: "daily-trigger",
    target: "collect-sources",
    type: "smoothstep",
    animated: true,
  },
  {
    id: "collect-sources-generate-recap",
    source: "collect-sources",
    target: "generate-recap",
    type: "smoothstep",
    animated: true,
  },
  {
    id: "generate-recap-review-brief",
    source: "generate-recap",
    target: "review-brief",
    type: "smoothstep",
    animated: true,
  },
];

const KIND_LABELS: Record<WorkflowStepData["kind"], string> = {
  trigger: "Trigger",
  action: "Action",
  review: "Review",
};

function WorkflowStep({ id, data, selected }: NodeProps<WorkflowStepNode>) {
  const editor = React.useContext(WorkflowEditorContext);

  if (!editor) {
    throw new Error("WorkflowStep must be rendered inside RealtimeWorkflowBuilder.");
  }

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border-0 !bg-muted-foreground"
      />
      <div
        className={cn(
          "w-64 rounded-lg bg-card p-4 shadow-xs transition-[box-shadow,background-color] duration-150",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            {KIND_LABELS[data.kind]}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="nodrag"
            aria-label={`Remove ${data.title}`}
            onClick={() => editor.removeNode(id)}
          >
            <Trash2 />
          </Button>
        </div>
        <label className="sr-only" htmlFor={`workflow-title-${id}`}>
          Step title
        </label>
        <Input
          id={`workflow-title-${id}`}
          className="nodrag h-8 border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
          value={data.title}
          onChange={(event) =>
            editor.updateNode(id, { title: event.target.value })
          }
        />
        <label className="sr-only" htmlFor={`workflow-description-${id}`}>
          Step description
        </label>
        <Input
          id={`workflow-description-${id}`}
          className="nodrag mt-1 h-7 border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
          value={data.description}
          onChange={(event) =>
            editor.updateNode(id, { description: event.target.value })
          }
        />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !border-0 !bg-muted-foreground"
      />
    </>
  );
}

const NODE_TYPES: NodeTypes = { workflowStep: WorkflowStep };

function SyncStatus({
  status,
  error,
  onReconnect,
}: {
  status: RealtimeFlowStatus;
  error: string | null;
  onReconnect: () => void;
}) {
  if (status === "error") {
    return (
      <div
        role="alert"
        className="flex min-w-0 items-center gap-2 text-xs text-destructive"
      >
        <CircleAlert className="size-4 shrink-0" />
        <span className="max-w-md truncate">{error}</span>
        <Button type="button" variant="outline" size="xs" onClick={onReconnect}>
          <RefreshCw />
          Reconnect
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "size-2 rounded-full",
          status === "connected" ? "bg-success" : "bg-warning",
        )}
      />
      {status === "connected" ? "Live collaboration" : "Connecting"}
    </div>
  );
}

function RealtimeWorkflowCanvas() {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const {
    nodes,
    edges,
    synced,
    status,
    syncError,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges,
    reconnect,
  } = useRealtimeFlow({
    channel: "alleato:admin:daily-recap-workflow:v1",
    initialNodes: INITIAL_NODES,
    initialEdges: INITIAL_EDGES,
  });

  const updateNode = React.useCallback(
    (id: string, patch: Partial<WorkflowStepData>) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === id
            ? {
                ...node,
                data: { ...(node.data as WorkflowStepData), ...patch },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const removeNode = React.useCallback(
    (id: string) => {
      setNodes((current) => current.filter((node) => node.id !== id));
      setEdges((current) =>
        current.filter((edge) => edge.source !== id && edge.target !== id),
      );
    },
    [setEdges, setNodes],
  );

  const addNode = React.useCallback(() => {
    const id = crypto.randomUUID();
    setNodes((current) => [
      ...current,
      {
        id,
        type: "workflowStep",
        position: {
          x: 140 + (current.length % 3) * 300,
          y: 340 + Math.floor(current.length / 3) * 160,
        },
        data: {
          title: "New workflow step",
          description: "Describe the expected outcome",
          kind: "action",
        },
      },
    ]);
  }, [setNodes]);

  const editor = React.useMemo(
    () => ({ updateNode, removeNode }),
    [removeNode, updateNode],
  );

  return (
    <WorkflowEditorContext.Provider value={editor}>
      <section
        className="overflow-hidden border-y border-border bg-card"
        aria-label="Daily recap workflow canvas"
      >
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Workflow className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div
                role="heading"
                aria-level={2}
                className="truncate text-sm font-semibold text-foreground"
              >
                Daily recap generation
              </div>
              <p className="text-xs text-muted-foreground">
                Live session. Drag steps or connect handles to change the flow.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SyncStatus
              status={status}
              error={syncError}
              onReconnect={reconnect}
            />
            <Button
              type="button"
              size="sm"
              onClick={addNode}
              disabled={!synced}
            >
              <Plus />
              Add step
            </Button>
          </div>
        </div>

        <div className="relative h-136 bg-background">
          <ReactFlow
            key={isMobile ? "mobile" : "desktop"}
            nodes={synced ? nodes : []}
            edges={synced ? edges : []}
            onNodesChange={synced ? onNodesChange : undefined}
            onEdgesChange={synced ? onEdgesChange : undefined}
            onConnect={synced ? onConnect : undefined}
            nodeTypes={NODE_TYPES}
            fitView={!isMobile}
            fitViewOptions={{ padding: 0.16, minZoom: 0.65 }}
            defaultViewport={
              isMobile ? { x: 24, y: 96, zoom: 0.8 } : undefined
            }
            minZoom={0.65}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              className="!bg-background"
            />
            <Controls
              showInteractive={false}
              className="!border-0 !bg-card !shadow-xs"
            />
          </ReactFlow>
          {!synced && status !== "error" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="size-4 animate-spin" />
                Connecting to the shared workflow
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </WorkflowEditorContext.Provider>
  );
}

export function RealtimeWorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <RealtimeWorkflowCanvas />
    </ReactFlowProvider>
  );
}
