"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Calendar,
  FilePlus2,
  User,
  Building2,
  Target,
  Lightbulb,
  ChevronRight,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ds";
import { AiFeedbackControl } from "@/components/ai/ai-feedback-control";
import { cn } from "@/lib/utils";
import type { InsightRow } from "./insights-types";
import { SEVERITY_VARIANT_MAP, STATUS_VARIANT_MAP } from "./insights-types";

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">
          {label}
        </p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

function InsightDetail({
  item,
  onOpenFull,
}: {
  item: InsightRow;
  onOpenFull: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {item.title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <AiFeedbackControl
            surface="insight_card"
            subjectType={item.type}
            subjectId={item.id}
            projectId={item.projectId}
            contentText={[item.title, item.why_it_matters].filter(Boolean).join(" ")}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenFull}
            className="gap-1.5"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Full view
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={
              (STATUS_VARIANT_MAP[item.status] as
                | "destructive"
                | "default"
                | "outline"
                | "secondary") ?? "outline"
            }
            className="capitalize"
          >
            {item.status.replace(/_/g, " ")}
          </Badge>
          <Badge
            variant={
              (SEVERITY_VARIANT_MAP[item.severity] as
                | "destructive"
                | "default"
                | "outline"
                | "secondary") ?? "outline"
            }
            className="capitalize"
          >
            {item.severity}
          </Badge>
          <Badge variant="secondary" className="capitalize">
            {item.type.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {item.confidence} confidence
          </Badge>
        </div>

        {/* Summary */}
        {item.description && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Summary
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {item.description}
            </p>
          </div>
        )}

        {/* Why it matters */}
        {item.why_it_matters && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Why it matters
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {item.why_it_matters}
            </p>
          </div>
        )}

        {/* Next action */}
        {item.next_action && (
          <div className="rounded-md bg-muted/50 px-3 py-2.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Next action
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {item.next_action}
            </p>
          </div>
        )}

        {/* Convert a change-management signal into a tracked change event */}
        {item.type === "change_management" && item.projectId != null && (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/${item.projectId}/change-events/new`}>
              <FilePlus2 className="h-3.5 w-3.5" />
              Create change event
            </Link>
          </Button>
        )}

        {/* Meta fields */}
        <div className="space-y-3 border-t border-border/40 pt-4">
          {item.project_name && (
            <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Project">
              {item.project_name}
            </DetailRow>
          )}
          {item.owner && (
            <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Owner">
              {item.owner}
            </DetailRow>
          )}
          {item.created_at && (
            <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created">
              {formatDate(item.created_at)}
            </DetailRow>
          )}
        </div>
      </div>
    </div>
  );
}

function CompactInsightRow({
  item,
  isSelected,
  onClick,
}: {
  item: InsightRow;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        "w-full h-auto text-left px-3 py-2.5 border-b border-border/40 rounded-none justify-start",
        "hover:bg-muted/40 transition-colors duration-100",
        isSelected && "bg-muted/60 border-l-2 border-l-primary",
      )}
    >
      <div className="w-full flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground line-clamp-2 flex-1">
          {item.title}
        </p>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground transition-opacity",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        <Badge
          variant={
            (SEVERITY_VARIANT_MAP[item.severity] as
              | "destructive"
              | "default"
              | "outline"
              | "secondary") ?? "outline"
          }
          className="text-xs capitalize"
        >
          {item.severity}
        </Badge>
        <Badge variant="outline" className="text-xs capitalize">
          {item.type.replace(/_/g, " ")}
        </Badge>
      </div>
      {item.project_name && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {item.project_name}
        </p>
      )}
    </Button>
  );
}

interface InsightsSplitViewProps {
  items: InsightRow[];
}

export function InsightsSplitView({ items }: InsightsSplitViewProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null,
  );

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border-t border-border/40">
      {/* Left: list */}
      <div className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-r border-border/40 bg-background">
        {items.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">No insights</p>
          </div>
        ) : (
          items.map((item) => (
            <CompactInsightRow
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              onClick={() => setSelectedId(item.id)}
            />
          ))
        )}
      </div>

      {/* Right: detail */}
      <div className="min-w-0 flex-1 overflow-hidden bg-background">
        {selectedItem ? (
          <InsightDetail
            item={selectedItem}
            onOpenFull={() => router.push(`/insights/${selectedItem.id}`)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<Lightbulb className="h-6 w-6" />}
              title="Select an insight"
              description="Choose an insight from the list to view details."
            />
          </div>
        )}
      </div>
    </div>
  );
}
