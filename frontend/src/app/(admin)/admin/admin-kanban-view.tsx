"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { cn } from "@/lib/utils";
import { createRestrictToContainer } from "@/features/kanban/utils/restrict-to-container";
import type { AdminMenuItem, AdminMenuSection } from "./admin-dashboard-data";

type AdminKanbanItem = AdminMenuItem & {
  id: string;
};

type AdminKanbanColumns = Record<string, AdminKanbanItem[]>;

function buildColumns(sections: AdminMenuSection[]): AdminKanbanColumns {
  return Object.fromEntries(
    sections.map((section) => [
      section.title,
      section.groups.flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          id: `${section.title}:${item.route}`,
        })),
      ),
    ]),
  );
}

function AdminPageCard({
  item,
  overlay = false,
}: {
  item: AdminKanbanItem;
  overlay?: boolean;
}) {
  const Icon = item.icon;

  const cardBody = (
    <>
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-foreground">
              {item.label}
            </span>
            {item.badge ? (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {item.badge}
              </span>
            ) : null}
            {item.href ? (
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70" />
            ) : null}
          </div>
          <code className="mt-1 block truncate text-[11px] text-muted-foreground/70">
            {item.route}
          </code>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {item.description}
      </p>
    </>
  );

  return (
    <KanbanItem value={item.id} disabled={overlay}>
      <div
        className={cn(
          "rounded-md border border-border/70 bg-background p-3 shadow-xs transition-colors",
          !overlay && "hover:border-border hover:bg-muted/20",
          overlay && "w-80 shadow-md",
        )}
      >
        <div className="flex items-start gap-2">
          {!overlay ? (
            <KanbanItemHandle
              aria-label={`Move ${item.label}`}
              className="-ml-1 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </KanbanItemHandle>
          ) : null}
          {item.href && !overlay ? (
            <Link
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1"
            >
              {cardBody}
            </Link>
          ) : (
            <div className="min-w-0 flex-1">{cardBody}</div>
          )}
        </div>
      </div>
    </KanbanItem>
  );
}

function AdminPageColumn({
  title,
  items,
}: {
  title: string;
  items: AdminKanbanItem[];
}) {
  return (
    <KanbanColumn value={title} className="w-full shrink-0 md:w-80">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {title}
          </span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-background px-1.5 text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-inset ring-border/70">
            {items.length}
          </span>
        </div>
        <KanbanColumnHandle asChild>
          <Button variant="ghost" size="icon" className="size-8 shrink-0">
            <GripVertical className="h-4 w-4" />
            <span className="sr-only">Move {title} column</span>
          </Button>
        </KanbanColumnHandle>
      </div>
      <div className="flex flex-col gap-2 p-0.5">
        {items.map((item) => (
          <AdminPageCard key={item.id} item={item} />
        ))}
      </div>
    </KanbanColumn>
  );
}

export function AdminKanbanView({
  sections,
}: {
  sections: AdminMenuSection[];
}) {
  const initialColumns = React.useMemo(() => buildColumns(sections), [sections]);
  const [columns, setColumns] =
    React.useState<AdminKanbanColumns>(initialColumns);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const restrictToBoard = React.useCallback(
    createRestrictToContainer(() => containerRef.current),
    [],
  );

  return (
    <div ref={containerRef} className="min-w-0">
      <Kanban
        value={columns}
        onValueChange={(nextColumns) => setColumns(nextColumns)}
        getItemValue={(item) => item.id}
        modifiers={[restrictToBoard]}
        autoScroll={false}
      >
        <div className="w-full overflow-x-auto pb-4">
          <KanbanBoard className="flex flex-col items-start gap-4 md:flex-row">
            {Object.entries(columns).map(([title, items]) => (
              <AdminPageColumn key={title} title={title} items={items} />
            ))}
          </KanbanBoard>
        </div>
        <KanbanOverlay>
          {({ value, variant }) => {
            if (variant === "column") {
              const items = columns[value] ?? [];
              return <AdminPageColumn title={String(value)} items={items} />;
            }

            const item = Object.values(columns)
              .flat()
              .find((candidate) => candidate.id === value);
            return item ? <AdminPageCard item={item} overlay /> : null;
          }}
        </KanbanOverlay>
      </Kanban>
    </div>
  );
}
