"use client";

import * as React from "react";
import {
  Files,
  PencilRuler,
  FileCheck,
  FileText,
  ScrollText,
  CircleHelp,
  FileDiff,
  FileStack,
  Image,
  Mail,
  Calendar,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SMART_GROUPS,
  type SmartGroup,
  type SmartGroupCounts,
} from "@/features/documents/smart-groups";

const ICONS: Record<string, LucideIcon> = {
  files: Files,
  blueprints: PencilRuler,
  "file-check": FileCheck,
  "file-text": FileText,
  "file-description": ScrollText,
  "help-circle": CircleHelp,
  "file-diff": FileDiff,
  "file-stack": FileStack,
  photo: Image,
  mail: Mail,
  calendar: Calendar,
};

function RailItem({
  group,
  count,
  active,
  onSelect,
}: {
  group: SmartGroup;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = ICONS[group.icon] ?? Files;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSelect}
      className={cn(
        "w-full justify-start gap-2 px-2 py-1.5 text-sm font-normal",
        active
          ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">{group.label}</span>
      <span className="tabular-nums text-xs">{count}</span>
    </Button>
  );
}

export function SmartGroupRail({
  counts,
  activeGroupId,
  onSelect,
}: {
  counts: SmartGroupCounts;
  activeGroupId: string;
  onSelect: (groupId: string) => void;
}): React.ReactElement {
  return (
    <nav className="flex h-full w-full flex-col gap-0.5 overflow-y-auto border-r border-border bg-background p-3">
      <p className="px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        Smart groups
      </p>
      {SMART_GROUPS.map((group) => (
        <RailItem
          key={group.id}
          group={group}
          count={counts[group.id] ?? 0}
          active={group.id === activeGroupId}
          onSelect={() => onSelect(group.id)}
        />
      ))}
    </nav>
  );
}

/**
 * Horizontally-scrollable pill row used below the `md` breakpoint, where the
 * vertical rail would steal too much width from the file table. Each pill is a
 * compact icon + label + count chip.
 */
export function SmartGroupPills({
  counts,
  activeGroupId,
  onSelect,
}: {
  counts: SmartGroupCounts;
  activeGroupId: string;
  onSelect: (groupId: string) => void;
}): React.ReactElement {
  return (
    <nav
      aria-label="Smart groups"
      className="flex w-full gap-1.5 overflow-x-auto bg-background px-3 py-2"
    >
      {SMART_GROUPS.map((group) => {
        const Icon = ICONS[group.icon] ?? Files;
        const active = group.id === activeGroupId;
        const count = counts[group.id] ?? 0;
        return (
          <Button
            key={group.id}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelect(group.id)}
            className={cn(
              "h-8 shrink-0 gap-1.5 rounded-full border px-3 text-xs font-normal",
              active
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{group.label}</span>
            <span className="tabular-nums text-[11px] opacity-70">{count}</span>
          </Button>
        );
      })}
    </nav>
  );
}
