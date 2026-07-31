"use client";

import * as React from "react";
import {
  ArrowRight,
  FileImage,
  FileQuestion,
} from "lucide-react";

import { InfoAlert } from "@/components/ds/InfoAlert";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AppPageScreenshotItem,
  AppPageScreenshotManifest,
} from "./types";

type FilterId =
  | "product_tools"
  | "all"
  | "captured"
  | "captured_http_404"
  | "captured_access_denied"
  | "skipped_dynamic_record"
  | "skipped"
  | "main"
  | "admin"
  | "tables";

interface FilterGroup {
  id: FilterId;
  label: string;
  predicate: (item: AppPageScreenshotItem) => boolean;
}

const FILTERS: FilterGroup[] = [
  {
    id: "product_tools",
    label: "Product tools",
    predicate: (item) => Boolean(item.tool),
  },
  { id: "all", label: "All routes", predicate: () => true },
  { id: "captured", label: "Captured", predicate: (item) => item.status === "captured" },
  {
    id: "captured_http_404",
    label: "Production 404",
    predicate: (item) => item.status === "captured_http_404",
  },
  {
    id: "captured_access_denied",
    label: "Access denied",
    predicate: (item) => item.status === "captured_access_denied",
  },
  {
    id: "skipped_dynamic_record",
    label: "Needs record ID",
    predicate: (item) => item.status === "skipped_dynamic_record",
  },
  {
    id: "skipped",
    label: "Other skipped",
    predicate: (item) => item.status.startsWith("skipped") && item.status !== "skipped_dynamic_record",
  },
  { id: "main", label: "Project app", predicate: (item) => item.scope === "main" },
  { id: "admin", label: "Admin", predicate: (item) => item.scope === "admin" },
  { id: "tables", label: "Tables", predicate: (item) => item.scope === "tables" },
];

function statusTone(status: string): string {
  if (status === "captured") return "text-emerald-700";
  if (status === "captured_http_404") return "text-amber-700";
  if (status === "captured_access_denied") return "text-amber-700";
  if (status.startsWith("skipped")) return "text-muted-foreground";
  return "text-destructive";
}

function ScreenshotRail({
  activeFilter,
  counts,
  onSelect,
}: {
  activeFilter: FilterId;
  counts: Record<FilterId, number>;
  onSelect: (filter: FilterId) => void;
}) {
  return (
    <nav className="flex h-full w-full flex-col gap-0.5 overflow-y-auto border-r border-border bg-muted/30 p-2">
      <p className="px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        Page screenshots
      </p>
      {FILTERS.map((filter) => (
        <Button
          key={filter.id}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelect(filter.id)}
          className={cn(
            "w-full justify-start gap-2 px-2 py-1.5 text-sm font-normal",
            activeFilter === filter.id
              ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <FileImage className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate text-left">{filter.label}</span>
          <span className="tabular-nums text-xs">{counts[filter.id] ?? 0}</span>
        </Button>
      ))}
    </nav>
  );
}

function ScreenshotCard({
  item,
  selected,
  onSelect,
}: {
  item: AppPageScreenshotItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const hasImage = Boolean(item.imageUrl);
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(item.id)}
      className={cn(
        "group flex h-auto w-full min-w-0 flex-col items-stretch gap-0 overflow-hidden rounded-lg border p-0 text-left hover:bg-muted/20",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-border",
      )}
    >
      <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-border bg-muted/40">
        {hasImage ? (
          <img
            src={item.imageUrl ?? ""}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <FileQuestion className="h-9 w-9 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="flex min-w-0 items-start gap-2 p-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {item.displayRoute}
          </span>
          <span className={cn("block truncate text-xs", statusTone(item.status))}>
            {item.statusLabel} · {item.scope}
          </span>
        </span>
      </span>
    </Button>
  );
}

function PreviewPane({ item }: { item: AppPageScreenshotItem | null }) {
  if (!item) {
    return (
      <aside className="flex h-full min-h-0 flex-col border-l border-border bg-background">
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          Select a page screenshot.
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="border-b border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {item.displayRoute}
            </p>
            <p className={cn("mt-1 text-xs", statusTone(item.status))}>
              {item.statusLabel}
            </p>
          </div>
          {item.url ? (
            <Button asChild size="icon" variant="ghost" className="h-9 w-9 shrink-0">
              <a href={item.url} target="_blank" rel="noreferrer" aria-label="Open page">
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-3">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={`Screenshot of ${item.displayRoute}`}
            className="w-full rounded-md border border-border bg-background"
          />
        ) : (
          <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
            No screenshot was generated for this route.
          </div>
        )}
      </div>
      <div className="space-y-2 border-t border-border p-3 text-xs">
        <div>
          <p className="text-muted-foreground">Source</p>
          <p className="break-all font-mono text-foreground">{item.source}</p>
        </div>
        {item.unresolved?.length ? (
          <div>
            <p className="text-muted-foreground">Missing params</p>
            <p className="font-mono text-foreground">{item.unresolved.join(", ")}</p>
          </div>
        ) : null}
        {item.error ? (
          <div>
            <p className="text-muted-foreground">Error</p>
            <p className="text-destructive">{item.error}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function AppPageScreenshotBrowser({
  manifest,
  items,
  error,
}: {
  manifest: AppPageScreenshotManifest | null;
  items: AppPageScreenshotItem[];
  error: string | null;
}) {
  const [activeFilter, setActiveFilter] = React.useState<FilterId>("product_tools");
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    items.find((item) => item.tool && item.status === "captured")
      ?.id ??
      items.find((item) => item.scope === "main" && item.status === "captured")
      ?.id ??
      items.find((item) => item.status === "captured")?.id ??
      items[0]?.id ??
      null,
  );

  const counts = React.useMemo(() => {
    return FILTERS.reduce(
      (next, filter) => {
        next[filter.id] = items.filter(filter.predicate).length;
        return next;
      },
      {} as Record<FilterId, number>,
    );
  }, [items]);

  const filteredItems = React.useMemo(() => {
    const filter = FILTERS.find((candidate) => candidate.id === activeFilter) ?? FILTERS[0];
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!filter.predicate(item)) return false;
      if (!needle) return true;
      return [item.displayRoute, item.source, item.statusLabel, item.scope]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [activeFilter, items, search]);

  React.useEffect(() => {
    if (!filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]?.id ?? null);
    }
  }, [filteredItems, selectedId]);

  const selectedItem =
    items.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;

  return (
    <>
      <div className="flex h-[calc(100vh-9rem)] w-full overflow-hidden">
        <div className="hidden w-52 shrink-0 md:block">
          <ScreenshotRail
            activeFilter={activeFilter}
            counts={counts}
            onSelect={setActiveFilter}
          />
        </div>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                App training
              </p>
              <h1 className="truncate text-xl font-semibold text-foreground">
                App Page Screenshots
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {manifest
                  ? `${manifest.routeSet ?? "all"} · ${manifest.targetRoutes} target routes · ${manifest.summary.captured ?? 0} captured · ${manifest.summary.captured_access_denied ?? 0} access denied`
                  : "Screenshot manifest unavailable"}
              </p>
            </div>
            <div className="flex w-full justify-start sm:w-80 sm:justify-end">
              <ExpandableSearch
                value={search}
                onChange={setSearch}
                placeholder="Search screenshots"
                ariaLabel="Search screenshots"
                defaultExpanded
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
            {FILTERS.map((filter) => (
              <Button
                key={filter.id}
                type="button"
                variant={activeFilter === filter.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveFilter(filter.id)}
                className="shrink-0"
              >
                {filter.label}
              </Button>
            ))}
          </div>
          {error ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <InfoAlert variant="error" role="alert" className="max-w-md">
                <div>
                  <p className="font-medium text-foreground">Manifest could not load.</p>
                  <p className="mt-1 text-muted-foreground">{error}</p>
                </div>
              </InfoAlert>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {filteredItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredItems.map((item) => (
                    <ScreenshotCard
                      key={item.id}
                      item={item}
                      selected={item.id === selectedItem?.id}
                      onSelect={setSelectedId}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                  No routes match this filter.
                </div>
              )}
            </div>
          )}
        </main>
        <div className="hidden max-w-2xl basis-2/5 shrink-0 xl:block">
          <PreviewPane item={selectedItem} />
        </div>
      </div>
    </>
  );
}
