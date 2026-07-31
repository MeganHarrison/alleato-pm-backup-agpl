/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { RealtimeWorkflowBuilder } from "../realtime-workflow-builder";

const setNodes = jest.fn();

jest.mock("@xyflow/react/dist/style.css", () => ({}));

jest.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));

jest.mock("@/hooks/use-realtime-flow", () => ({
  useRealtimeFlow: () => ({
    nodes: [
      {
        id: "one",
        type: "workflowStep",
        position: { x: 0, y: 0 },
        data: {
          title: "Daily schedule",
          description: "Start at 9:30 AM UTC",
          kind: "trigger",
        },
      },
    ],
    edges: [],
    synced: true,
    status: "connected",
    syncError: null,
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
    onConnect: jest.fn(),
    setNodes,
    setEdges: jest.fn(),
    reconnect: jest.fn(),
  }),
}));

jest.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  ReactFlow: ({
    nodes,
    nodeTypes,
  }: {
    nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
    nodeTypes: Record<
      string,
      (props: {
        id: string;
        data: Record<string, unknown>;
        selected: boolean;
      }) => React.ReactNode
    >;
  }) => (
    <div>
      {nodes.map((node) => {
        const NodeComponent = nodeTypes[node.type];
        return (
          <NodeComponent
            key={node.id}
            id={node.id}
            data={node.data}
            selected={false}
          />
        );
      })}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
  BackgroundVariant: { Dots: "dots" },
}));

describe("RealtimeWorkflowBuilder", () => {
  beforeEach(() => {
    setNodes.mockClear();
  });

  it("shows a live collaboration state and allows adding a workflow step", () => {
    render(<RealtimeWorkflowBuilder />);

    expect(screen.getByText("Live collaboration")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));

    expect(setNodes).toHaveBeenCalledWith(expect.any(Function));
  });

  it("keeps synchronized workflow labels editable", () => {
    render(<RealtimeWorkflowBuilder />);

    fireEvent.change(screen.getByLabelText("Step title"), {
      target: { value: "Updated schedule" },
    });

    expect(setNodes).toHaveBeenCalledWith(expect.any(Function));
  });
});
