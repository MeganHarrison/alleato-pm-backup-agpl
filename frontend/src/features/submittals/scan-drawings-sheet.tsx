"use client";

import { useState } from "react";
import { CheckCircle2, CircleHelp, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ds/status-badge";
import { EmptyState } from "@/components/ds";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { useRequiredSubmittals, type RequiredSubmittalItem } from "@/hooks/use-submittals";
import { apiFetch } from "@/lib/api-client";
import { appToast } from "@/lib/toast/app-toast";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

interface Props {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function groupByDiscipline(items: RequiredSubmittalItem[]) {
  const groups = new Map<string, RequiredSubmittalItem[]>();
  for (const item of items) {
    const key = item.discipline ?? "Other";
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function ScanDrawingsSheet({ projectId, open, onOpenChange }: Props) {
  const { data, isLoading } = useRequiredSubmittals(projectId);
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "missing">("missing");

  const items = data?.items ?? [];
  const filtered = filter === "missing" ? items.filter((i) => !i.existingSubmittal) : items;
  const groups = groupByDiscipline(filtered);

  async function handleCreate(item: RequiredSubmittalItem) {
    const key = `${item.drawingId}:${item.impliedSubmittal}`;
    setCreating((s) => new Set(s).add(key));
    try {
      await apiFetch(`/api/projects/${projectId}/submittals`, {
        method: "POST",
        body: JSON.stringify({
          title: item.impliedSubmittal,
          specification_section: null,
          status: "Open",
        }),
      });
      appToast.success(`Created: ${item.impliedSubmittal}`);
      await queryClient.invalidateQueries({ queryKey: ["submittals", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["required-submittals", projectId] });
    } catch {
      appToast.error("Failed to create submittal");
    } finally {
      setCreating((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Required Submittals from Drawings</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Scanning drawings…
          </div>
        ) : !data || data.summary.totalImplied === 0 ? (
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="No implied submittals found"
            description="Upload drawings and wait for the AI vision analysis to complete, then scan again."
          />
        ) : (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="flex items-center gap-6 text-sm">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{data.summary.totalImplied}</span> implied
              </span>
              <span className="text-muted-foreground">
                <span className="font-semibold text-primary">{data.summary.covered}</span> covered
              </span>
              <span className="text-muted-foreground">
                <span className="font-semibold text-destructive">{data.summary.missing}</span> missing
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant={filter === "missing" ? "default" : "outline"}
                  onClick={() => setFilter("missing")}
                >
                  Missing only
                </Button>
                <Button
                  size="sm"
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <InfoAlert variant="success">All implied submittals are covered.</InfoAlert>
            ) : (
              groups.map(([discipline, groupItems]) => (
                <div key={discipline} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {discipline}
                  </p>
                  <div className="divide-y divide-border rounded-md border border-border">
                    {groupItems.map((item) => {
                      const key = `${item.drawingId}:${item.impliedSubmittal}`;
                      const isCreating = creating.has(key);
                      return (
                        <div key={key} className="flex items-start justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.existingSubmittal ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                              ) : (
                                <CircleHelp className="h-3.5 w-3.5 shrink-0 text-warning" />
                              )}
                              <span className="text-sm text-foreground">{item.impliedSubmittal}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.drawingNumber} — {item.drawingTitle}
                            </p>
                            {item.existingSubmittal && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <Link
                                  href={`/${projectId}/submittals/${item.existingSubmittal.id}`}
                                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                >
                                  #{item.existingSubmittal.number} {item.existingSubmittal.title}
                                </Link>
                                {item.existingSubmittal.status && (
                                  <StatusBadge status={item.existingSubmittal.status} />
                                )}
                              </div>
                            )}
                          </div>
                          {!item.existingSubmittal && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isCreating}
                              onClick={() => handleCreate(item)}
                              className="shrink-0"
                            >
                              {isCreating ? "Creating…" : "Create"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
