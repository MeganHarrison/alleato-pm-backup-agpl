"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/ds";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidePanel,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type {
  DailyContentResponse,
  LifecycleDocumentsResponse,
} from "@/app/api/admin/source-sync/_contracts";

type DailySource = DailyContentResponse["sources"][number];
type LifecycleDocument = LifecycleDocumentsResponse["documents"][number];

// ---- date helpers (local calendar day) -------------------------------------

function toDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

function parseLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDay(dateStr: string, days: number): string {
  const base = parseLocal(dateStr);
  return toDateStr(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

function dayLabel(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return "Today";
  if (dateStr === shiftDay(today, -1)) return "Yesterday";
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ---- per-source status ------------------------------------------------------

type SourceStatus = "vectorized" | "pending" | "empty";

function statusOf(source: DailySource): SourceStatus {
  if (source.synced === 0) return "empty";
  if (source.embedded >= source.synced) return "vectorized";
  return "pending";
}

function StatusDot({ source }: { source: DailySource }) {
  const status = statusOf(source);
  const config: Record<SourceStatus, { className: string; label: string }> = {
    vectorized: { className: "bg-status-success", label: "All synced content is vectorized" },
    pending: {
      className: "bg-status-warning",
      label: `${Math.max(source.synced - source.embedded, 0)} awaiting vectorization`,
    },
    empty: { className: "bg-muted-foreground/40", label: "Nothing synced on this day" },
  };
  const { className, label } = config[status];
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      title={label}
      aria-label={label}
    />
  );
}

// ---- day switcher ----------------------------------------------------------

function DaySwitcher({
  date,
  onChange,
}: {
  date: string;
  onChange: (next: string) => void;
}) {
  const today = todayStr();
  const isToday = date === today;
  const isYesterday = date === shiftDay(today, -1);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        aria-label="Previous day"
        onClick={() => onChange(shiftDay(date, -1))}
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        aria-label="Next day"
        disabled={isToday}
        onClick={() => onChange(shiftDay(date, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="flex overflow-hidden rounded-md border border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(shiftDay(today, -1))}
          className={cn(
            "h-8 rounded-none",
            isYesterday && "bg-muted font-medium text-foreground",
          )}
        >
          Yesterday
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(today)}
          className={cn(
            "h-8 rounded-none border-l border-border",
            isToday && "bg-muted font-medium text-foreground",
          )}
        >
          Today
        </Button>
      </div>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Pick a day">
            <CalendarDays className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={parseLocal(date)}
            onSelect={(next) => {
              if (next) {
                onChange(toDateStr(next));
                setPickerOpen(false);
              }
            }}
            disabled={{ after: parseLocal(today) }}
            captionLayout="dropdown"
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---- summary table ---------------------------------------------------------

function SummaryRow({
  source,
  onOpen,
}: {
  source: DailySource;
  onOpen: () => void;
}) {
  const pending = Math.max(source.synced - source.embedded, 0);
  const empty = source.synced === 0;

  const lastSynced = formatTime(source.latestAt);

  return (
    <Button
      variant="ghost"
      onClick={onOpen}
      disabled={empty}
      className={cn(
        "grid h-auto w-full grid-cols-[1fr_auto_auto_auto_1.25rem] items-center gap-x-6 rounded-none px-2 py-3 text-left font-normal",
        empty ? "cursor-default opacity-100 hover:bg-transparent" : "hover:bg-muted/40",
      )}
    >
      <span className="flex items-center gap-2.5">
        <StatusDot source={source} />
        <span className="font-medium text-foreground">{source.label}</span>
      </span>
      <span className="tabular-nums text-foreground">
        {source.synced.toLocaleString()}
      </span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {empty ? (
          "—"
        ) : (
          <>
            <span className="text-foreground">{source.embedded.toLocaleString()}</span>
            {pending > 0 ? (
              <span className="text-muted-foreground"> · {pending.toLocaleString()} pending</span>
            ) : null}
          </>
        )}
      </span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {lastSynced || "—"}
      </span>
      <ChevronRight
        className={cn(
          "h-4 w-4 justify-self-end text-muted-foreground",
          empty && "invisible",
        )}
      />
    </Button>
  );
}

function SummaryTable({
  data,
  onOpen,
}: {
  data: DailyContentResponse;
  onOpen: (source: DailySource) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto_auto_1.25rem] items-center gap-x-6 border-b border-border pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Source</span>
        <span className="text-right">Synced</span>
        <span className="text-right">Embedded</span>
        <span className="text-right">Last synced</span>
        <span />
      </div>
      <div className="divide-y divide-border">
        {data.sources.map((source) => (
          <SummaryRow key={source.key} source={source} onOpen={() => onOpen(source)} />
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_auto_1.25rem] items-center gap-x-6 border-t border-border pt-3 text-sm">
        <span className="font-medium text-foreground">All sources</span>
        <span className="font-semibold tabular-nums text-foreground">
          {data.totals.synced.toLocaleString()}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {data.totals.embedded.toLocaleString()}
        </span>
        <span />
        <span />
      </div>
    </div>
  );
}

// ---- drill-down file list --------------------------------------------------

function FileRow({ doc }: { doc: LifecycleDocument }) {
  const href = doc.detailHref ?? doc.webUrl;
  const external = !doc.detailHref && Boolean(doc.webUrl);
  const title = doc.title || "Untitled";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        {href ? (
          external ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm text-foreground hover:text-primary hover:underline"
            >
              {title}
            </a>
          ) : (
            <Link
              href={href}
              className="block truncate text-sm text-foreground hover:text-primary hover:underline"
            >
              {title}
            </Link>
          )
        ) : (
          <span className="block truncate text-sm text-foreground">{title}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {doc.projectName ?? "Unassigned"}
          {formatTime(doc.date) ? ` · ${formatTime(doc.date)}` : ""}
        </span>
      </div>
      <span
        className={cn(
          "shrink-0 text-xs",
          doc.stages.vectorized ? "text-status-success" : "text-muted-foreground",
        )}
      >
        {doc.stages.vectorized ? "Embedded" : "Pending"}
      </span>
    </div>
  );
}

function FilesSheet({
  source,
  date,
  onClose,
}: {
  source: DailySource | null;
  date: string;
  onClose: () => void;
}) {
  const [data, setData] = React.useState<LifecycleDocumentsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!source) return;
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    setSearch("");
    apiFetch<LifecycleDocumentsResponse>(
      `/api/admin/source-sync/lifecycle-documents?source=${source.key}&start=${date}&end=${date}`,
    )
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load files.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [source, date]);

  const query = search.trim().toLowerCase();
  const documents = (data?.documents ?? []).filter((doc) => {
    if (!query) return true;
    return (
      (doc.title ?? "").toLowerCase().includes(query) ||
      (doc.projectName ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <SidePanel open={Boolean(source)} onOpenChange={(open) => !open && onClose()}>
      <SidePanelContent size="sm" className="flex flex-col">
        <SidePanelHeader>
          <SidePanelTitle>
            {source?.label} · {dayLabel(date)}
          </SidePanelTitle>
        </SidePanelHeader>

        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <span className="text-sm text-muted-foreground">
            {data
              ? `${data.total.toLocaleString()} file${data.total === 1 ? "" : "s"}${
                  data.truncated ? " (showing first 500)" : ""
                }`
              : ""}
          </span>
          <ExpandableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search files..."
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {loading ? (
            <div className="space-y-2 py-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="py-3">
              <InfoAlert variant="error" role="alert">
                {error}
              </InfoAlert>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-10">
              <EmptyState
                title={query ? "No matching files" : "No files"}
                description={
                  query
                    ? "No files match your search on this day."
                    : "Nothing from this source synced on this day."
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {documents.map((doc) => (
                <FileRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>
      </SidePanelContent>
    </SidePanel>
  );
}

// ---- panel -----------------------------------------------------------------

export function DailyContentPanel() {
  const [date, setDate] = React.useState<string>(todayStr());
  const [data, setData] = React.useState<DailyContentResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [openSource, setOpenSource] = React.useState<DailySource | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch<DailyContentResponse>(`/api/admin/source-sync/daily-content?date=${date}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load sync summary.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date]);

  const nothingSynced = data && data.totals.synced === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{dayLabel(date)}</p>
        <DaySwitcher date={date} onChange={setDate} />
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <InfoAlert variant="error" role="alert">
          {error}
        </InfoAlert>
      ) : nothingSynced ? (
        <EmptyState
          title={`Nothing synced ${dayLabel(date).toLowerCase()}`}
          description="No emails, meeting transcripts, documents, or Teams messages were synced on this day. Pick another day above."
        />
      ) : data ? (
        <SummaryTable data={data} onOpen={setOpenSource} />
      ) : null}

      <DeepDiveLinks />

      <FilesSheet source={openSource} date={date} onClose={() => setOpenSource(null)} />
    </div>
  );
}

// ---- deep-dive links -------------------------------------------------------

function DeepDiveLinks() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
      <Link
        href="/rag"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
      >
        Lifecycle funnel &amp; sync history
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
      >
        Per-document status &amp; retry
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
