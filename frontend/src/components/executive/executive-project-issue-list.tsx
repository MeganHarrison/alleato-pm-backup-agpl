"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FolderOpen } from "lucide-react";
import { EmptyState, InfoAlert } from "@/components/ds";
import {
  ExecutiveSignalCard,
  type ExecutiveRelatedTask,
} from "@/components/executive/executive-signal-card";
import type { ExecutiveProjectOption } from "@/components/executive/executive-project-link-form";
import type { ExecutiveTaskAssigneeOption } from "@/components/executive/executive-task-draft-form";
import { SectionRuleHeading } from "@/components/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { BrandonBriefItem } from "@/lib/executive/brandon-daily-update";
import { cn } from "@/lib/utils";

export type ExecutiveProjectIssueEntry = {
  id: string;
  section: "needsBrandon" | "waitingOnOthers" | "importantUpdates" | "carryForward";
  item: BrandonBriefItem;
  relatedTasks: ExecutiveRelatedTask[];
  followUpId?: string;
  actionLabel?: string;
  projectHref?: string | null;
  currentProjectId?: number | null;
};

type ProjectIssueGroup = {
  key: string;
  label: string;
  entries: ExecutiveProjectIssueEntry[];
  unlinked: boolean;
};

function normalizeProjectLabel(value: string) {
  return value.replace(/\s+/g, " ").trim() || "No project linked";
}

function displayProjectLabel(value: string) {
  const label = normalizeProjectLabel(value);
  return label.replace(/^\d{2,5}\s*[-:]?\s+/, "").trim() || label;
}

function projectGroupKey(value: string) {
  return normalizeProjectLabel(value).toLowerCase();
}

function isUnlinkedProject(value: string) {
  return /no project linked/i.test(normalizeProjectLabel(value));
}

function groupIssuesByProject(entries: ExecutiveProjectIssueEntry[]): ProjectIssueGroup[] {
  const groups = new Map<string, ProjectIssueGroup>();

  for (const entry of entries) {
    const label = normalizeProjectLabel(entry.item.project);
    const key = projectGroupKey(label);
    const existing = groups.get(key);

    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(key, {
        key,
        label,
        entries: [entry],
        unlinked: isUnlinkedProject(label),
      });
    }
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.unlinked !== right.unlinked) return left.unlinked ? 1 : -1;
    return left.label.localeCompare(right.label);
  });
}

function ProjectFilterRow({
  groups,
  selectedProjectKey,
  onSelectProject,
}: {
  groups: ProjectIssueGroup[];
  selectedProjectKey: string;
  onSelectProject: (projectKey: string) => void;
}) {
  return (
    <div className="flex justify-end">
      <Select value={selectedProjectKey} onValueChange={onSelectProject}>
        <SelectTrigger
          variant="inline"
          size="sm"
          className="h-7 w-auto max-w-full gap-1 px-0 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-0"
          aria-label="Filter executive issues by project"
        >
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="all">All projects</SelectItem>
          {groups.map((group) => (
            <SelectItem key={group.key} value={group.key}>
              {displayProjectLabel(group.label)} ({group.entries.length})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProjectIssueGroupSection({
  group,
  open,
  onOpenChange,
  employees,
  projects,
}: {
  group: ProjectIssueGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: ExecutiveTaskAssigneeOption[];
  projects: ExecutiveProjectOption[];
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-t border-border/70 first:border-t-0"
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 py-4 text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-primary">
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">{displayProjectLabel(group.label)}</span>
            {group.unlinked && (
              <span className="shrink-0 text-xs font-medium text-destructive">
                Project link required
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="pb-6">
        <div className="divide-y divide-border/70">
          {group.entries.map((entry, index) => (
            <ExecutiveSignalCard
              key={entry.id}
              item={entry.item}
              employees={employees}
              hasMatchingTask={entry.relatedTasks.length > 0}
              relatedTasks={entry.relatedTasks}
              followUpId={entry.followUpId}
              actionLabel={entry.actionLabel}
              projectHref={entry.projectHref}
              currentProjectId={entry.currentProjectId}
              projects={projects}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ExecutiveProjectIssueList({
  entries,
  employees,
  projects,
}: {
  entries: ExecutiveProjectIssueEntry[];
  employees: ExecutiveTaskAssigneeOption[];
  projects: ExecutiveProjectOption[];
}) {
  const groups = useMemo(() => groupIssuesByProject(entries), [entries]);
  const [selectedProjectKey, setSelectedProjectKey] = useState("all");
  const visibleGroups =
    selectedProjectKey === "all"
      ? groups
      : groups.filter((group) => group.key === selectedProjectKey);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(
    groups[0]?.key ?? null,
  );
  const unlinkedCount = entries.filter((entry) =>
    isUnlinkedProject(entry.item.project),
  ).length;

  useEffect(() => {
    if (visibleGroups.length === 0) {
      setOpenGroupKey(null);
      return;
    }

    if (!openGroupKey || !visibleGroups.some((group) => group.key === openGroupKey)) {
      setOpenGroupKey(visibleGroups[0]?.key ?? null);
    }
  }, [openGroupKey, visibleGroups]);

  if (entries.length === 0) {
    return (
      <section className="space-y-4">
        <SectionRuleHeading label="Project Issues" />
        <EmptyState
          icon={<FolderOpen />}
          title="No active executive issues"
          description="Nothing high-confidence surfaced in the current packet."
          className="py-8"
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <ProjectFilterRow
        groups={groups}
        selectedProjectKey={selectedProjectKey}
        onSelectProject={setSelectedProjectKey}
      />

      {unlinkedCount > 0 && (
        <InfoAlert variant="error" className="text-xs leading-5">
          {unlinkedCount} item{unlinkedCount === 1 ? "" : "s"} need project
          linkage before they can become reliable project work.
        </InfoAlert>
      )}

      <div>
        {visibleGroups.map((group) => (
          <ProjectIssueGroupSection
            key={group.key}
            group={group}
            open={openGroupKey === group.key}
            onOpenChange={(nextOpen) =>
              setOpenGroupKey(nextOpen ? group.key : null)
            }
            employees={employees}
            projects={projects}
          />
        ))}
      </div>
    </section>
  );
}
