import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { AlertCircle, CheckCircle2, Clock, FileText } from "lucide-react";
import { KanbanCardShell, KanbanColumnShell, KanbanEmptyAction } from "./kanban";

const meta: Meta = {
  title: "Data Display/Kanban",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const columns = [
  {
    title: "Draft",
    tone: "neutral" as const,
    icon: <FileText className="h-3.5 w-3.5 text-muted-foreground" />,
    cards: [
      { id: "1", title: "CO-049 — Electrical reroute", meta: "$8,500", priority: "medium" as const },
      { id: "2", title: "CO-050 — Skylight modification", meta: "$22,000", priority: "low" as const },
    ],
  },
  {
    title: "In Review",
    tone: "info" as const,
    icon: <Clock className="h-3.5 w-3.5 text-status-info" />,
    cards: [
      { id: "3", title: "CO-047 — HVAC scope change", meta: "$45,200", priority: "high" as const },
      { id: "4", title: "CO-048 — Concrete pour delay", meta: "$12,000", priority: "urgent" as const },
    ],
  },
  {
    title: "Approved",
    tone: "success" as const,
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />,
    cards: [
      { id: "5", title: "CO-042 — MEP coordination", meta: "$22,500", priority: "medium" as const },
      { id: "6", title: "CO-043 — Door hardware upgrade", meta: "$5,800", priority: "low" as const },
      { id: "7", title: "CO-044 — Added parking spaces", meta: "$38,000", priority: "medium" as const },
    ],
  },
  {
    title: "Rejected",
    tone: "warning" as const,
    icon: <AlertCircle className="h-3.5 w-3.5 text-status-warning" />,
    cards: [],
  },
];

export const Default = {
  render: () => (
    <div className="flex gap-3 overflow-x-auto rounded-lg border border-border bg-background p-3">
      {columns.map((col) => (
        <KanbanColumnShell
          key={col.title}
          title={col.title}
          icon={col.icon}
          count={col.cards.length}
          tone={col.tone}
          onAdd={() => {}}
        >
          {col.cards.length === 0 ? (
            <KanbanEmptyAction onClick={() => {}}>
              + Add change order
            </KanbanEmptyAction>
          ) : (
            col.cards.map((card) => (
              <KanbanCardShell
                key={card.id}
                density="default"
              >
                <p className="text-sm font-medium">{card.title}</p>
                <p className="text-xs text-muted-foreground">{card.meta}</p>
              </KanbanCardShell>
            ))
          )}
        </KanbanColumnShell>
      ))}
    </div>
  ),
};

export const Compact = {
  render: () => (
    <div className="flex gap-3 overflow-x-auto rounded-lg border border-border bg-background p-3">
      {columns.map((col) => (
        <KanbanColumnShell
          key={col.title}
          title={col.title}
          icon={col.icon}
          count={col.cards.length}
          tone={col.tone}
        >
          {col.cards.map((card) => (
            <KanbanCardShell key={card.id} density="compact">
              <p className="text-xs font-medium">{card.title}</p>
            </KanbanCardShell>
          ))}
        </KanbanColumnShell>
      ))}
    </div>
  ),
};
