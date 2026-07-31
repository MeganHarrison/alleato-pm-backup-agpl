"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout";
import { EmptyState } from "@/components/ds";
import {
  Sparkles,
  Zap,
  Wrench,
  Clock,
  Search,
  Brain,
  DollarSign,
  Calendar,
  Users,
  Shield,
  Layout,
  Database,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RELEASES,
  type UpdateType,
  type UpdateArea,
  type UpdateEntry,
  type Release,
} from "@/data/changelog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_META: Record<
  UpdateType,
  { label: string; icon: React.ElementType; className: string }
> = {
  new: {
    label: "New",
    icon: Sparkles,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  improved: {
    label: "Improved",
    icon: Zap,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  fixed: {
    label: "Fixed",
    icon: Wrench,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "coming-soon": {
    label: "Coming Soon",
    icon: Clock,
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

const AREA_META: Record<
  UpdateArea,
  { label: string; icon: React.ElementType }
> = {
  ai: { label: "AI", icon: Brain },
  financial: { label: "Financial", icon: DollarSign },
  operations: { label: "Operations", icon: Calendar },
  ui: { label: "UI / UX", icon: Layout },
  infrastructure: { label: "Infrastructure", icon: Database },
  integrations: { label: "Integrations", icon: Users },
  security: { label: "Security", icon: Shield },
};

const AREA_FILTERS = [
  { value: "all", label: "All areas" },
  ...Object.entries(AREA_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

const TYPE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "new", label: "New" },
  { value: "improved", label: "Improved" },
  { value: "fixed", label: "Fixed" },
  { value: "coming-soon", label: "Coming Soon" },
];

// ---------------------------------------------------------------------------
// Entry card
// ---------------------------------------------------------------------------

function UpdateCard({ entry }: { entry: UpdateEntry }) {
  const typeMeta = TYPE_META[entry.type];
  const areaMeta = AREA_META[entry.area];
  const TypeIcon = typeMeta.icon;
  const AreaIcon = areaMeta.icon;

  return (
    <div className="flex gap-4 py-4 group">
      {/* Type icon */}
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
          typeMeta.className
        )}
      >
        <TypeIcon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-foreground">
            {entry.title}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              typeMeta.className
            )}
          >
            {typeMeta.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {entry.description}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <AreaIcon className="h-3 w-3" />
          <span>{areaMeta.label}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Release block
// ---------------------------------------------------------------------------

function ReleaseBlock({
  release,
  entries,
}: {
  release: Release;
  entries: UpdateEntry[];
}) {
  if (entries.length === 0) return null;

  return (
    <div className="flex gap-6">
      {/* Left: version + date */}
      <div className="w-32 shrink-0 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            v{release.version}
          </span>
          {release.label && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {release.label}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{release.date}</p>
      </div>

      {/* Right: entries */}
      <div className="flex-1 rounded-lg border border-border bg-card px-5 divide-y divide-border/60">
        {entries.map((entry, i) => (
          <UpdateCard key={i} entry={entry} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UpdatesPage() {
  const [search, setSearch] = React.useState("");
  const [areaFilter, setAreaFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");

  const filteredReleases = React.useMemo(() => {
    return RELEASES.map((release) => {
      const entries = release.entries.filter((entry) => {
        if (areaFilter !== "all" && entry.area !== areaFilter) return false;
        if (typeFilter !== "all" && entry.type !== typeFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            entry.title.toLowerCase().includes(q) ||
            entry.description.toLowerCase().includes(q)
          );
        }
        return true;
      });
      return { release, entries };
    }).filter(({ entries }) => entries.length > 0);
  }, [search, areaFilter, typeFilter]);


  return (
    <PageShell variant="detail" title="What's New" description="A running log of features added, improved, and fixed across all areas of the platform.">
    <div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-8">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search updates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AREA_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Release timeline */}
      {filteredReleases.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title="No updates match your filters"
          description="Try adjusting the filters to find what you're looking for."
        />
      ) : (
        <div className="space-y-6">
          {filteredReleases.map(({ release, entries }) => (
            <ReleaseBlock
              key={release.version}
              release={release}
              entries={entries}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-10 flex flex-wrap items-center gap-4 pt-6 border-t border-border">
        <span className="text-xs text-muted-foreground font-medium">Legend:</span>
        {Object.entries(TYPE_META).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <span
              key={key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium",
                meta.className
              )}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
            </span>
          );
        })}
      </div>
    </div>
    </PageShell>
  );
}
