"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";

import { Button, ErrorState, InfoAlert, StatusBadge } from "@/components/ds";
import type { StatusVariant } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetchWithTransientRouteRetry } from "@/lib/api-client";

type ReadinessLevel = "ready" | "attention" | "blocked" | "unknown";

interface OperationsReadinessStatus {
  generatedAt: string;
  status: "ready" | "attention" | "blocked";
  summary: string;
  counts: {
    ready: number;
    attention: number;
    blocked: number;
    unknown: number;
  };
  items: ReadinessItem[];
}

interface ReadinessItem {
  id: "source-data" | "tasks" | "project-intelligence" | "daily-brief";
  question: string;
  answer: string;
  level: ReadinessLevel;
  checkedAt: string;
  metrics: Array<{ label: string; value: string }>;
  blocker: string | null;
  cause: string;
  prevention: string;
  primaryAction: { label: string; href: string };
  runActions: ReadinessRunAction[];
}

interface ReadinessRunAction {
  id: string;
  label: string;
  endpoint: string;
  method: "POST";
  body?: Record<string, unknown>;
  confirm?: string;
}

const levelConfig: Record<
  ReadinessLevel,
  {
    label: string;
    answer: "Yes" | "No" | "Review" | "Unknown";
    variant: StatusVariant;
  }
> = {
  ready: {
    label: "Ready",
    answer: "Yes",
    variant: "success",
  },
  attention: {
    label: "Needs follow-up",
    answer: "No",
    variant: "warning",
  },
  blocked: {
    label: "Blocked",
    answer: "No",
    variant: "error",
  },
  unknown: {
    label: "Unknown",
    answer: "Unknown",
    variant: "neutral",
  },
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function LoadingState() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="divide-y divide-border/60">
        <Skeleton className="h-32 w-full py-5" />
        <Skeleton className="h-32 w-full py-5" />
        <Skeleton className="h-32 w-full py-5" />
        <Skeleton className="h-32 w-full py-5" />
      </div>
    </div>
  );
}

function compactMetrics(item: ReadinessItem): string {
  if (item.metrics.length === 0) return "No metrics returned.";
  return item.metrics
    .map((metric) => `${metric.label}: ${metric.value}`)
    .join("; ");
}

function ReadinessRow({ item, index }: { item: ReadinessItem; index: number }) {
  const config = levelConfig[item.level];

  return (
    <section className="grid gap-5 py-6 first:pt-0 md:grid-cols-[2rem_minmax(0,1fr)_auto]">
      <div className="pt-1 text-sm tabular-nums text-muted-foreground">
        {index + 1}.
      </div>
      <div className="min-w-0 space-y-3">
        <div className="space-y-1">
          <SectionRuleHeading label={item.question} className="mb-0 pb-0" />
          <p className="text-sm leading-6 text-foreground">{item.answer}</p>
        </div>

        <dl className="space-y-2 text-sm leading-6">
          <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <dt className="font-medium text-muted-foreground">Evidence</dt>
            <dd className="text-foreground">{compactMetrics(item)}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <dt className="font-medium text-muted-foreground">Issue</dt>
            <dd className="text-foreground">
              {item.blocker ?? "No active blocker reported."}
            </dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <dt className="font-medium text-muted-foreground">Prevention</dt>
            <dd className="text-foreground">{item.prevention}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          Checked {formatDate(item.checkedAt)}
        </p>
      </div>
      <div className="flex items-start gap-3 md:justify-end">
        <StatusBadge status={config.answer} variant={config.variant} />
        <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
          <Link href={item.primaryAction.href}>{item.primaryAction.label}</Link>
        </Button>
      </div>
    </section>
  );
}

export function OperationsReadinessPanel() {
  const [status, setStatus] = React.useState<OperationsReadinessStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadStatus = React.useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const payload = await apiFetchWithTransientRouteRetry<OperationsReadinessStatus>(
        "/api/admin/operations-readiness/status",
        undefined,
        { retries: 2, delayMs: 750 },
      );
      setStatus(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load operations readiness.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadStatus("initial");
  }, [loadStatus]);

  if (loading) return <LoadingState />;

  if (error && !status) {
    return (
      <ErrorState
        title="Readiness could not be loaded"
        description={error}
        onRetry={() => void loadStatus("refresh")}
      />
    );
  }

  if (!status) {
    return (
      <InfoAlert variant="warning">
        Operations readiness returned no status payload.
      </InfoAlert>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={status.status === "ready" ? "All clear" : "Action needed"}
              variant={status.status === "ready" ? "success" : "warning"}
            />
            <span className="text-sm text-muted-foreground">
              Last checked {formatDate(status.generatedAt)}
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {status.summary}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={refreshing}
          onClick={() => void loadStatus("refresh")}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </section>

      {error ? (
        <InfoAlert variant="error">
          {error}
        </InfoAlert>
      ) : null}

      <section className="divide-y divide-border/60">
        {status.items.map((item, index) => (
          <ReadinessRow key={item.id} item={item} index={index} />
        ))}
      </section>
    </div>
  );
}
