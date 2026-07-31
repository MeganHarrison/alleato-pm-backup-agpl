"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Activity,
  CheckCircle2,
  RefreshCw,
  Shield,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiFetch } from "@/lib/api-client";
import { KpiRow } from "@/components/ds/kpi";
import { SectionRuleHeading } from "@/components/layout";
import { ErrorState } from "@/components/ds/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface SeverityBreakdown {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}

interface ErrorWindow {
  total: number;
  bySeverity: SeverityBreakdown;
}

interface ErrorGroup {
  id: string;
  title: string;
  severity: string;
  event_count: number;
  last_seen_at: string;
  status: string;
}

interface ErrorSeries {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface PagePerformance {
  pagePath: string;
  errors24h: number;
  errors7d: number;
  errors30d: number;
  lastSeenAt: string;
}

interface SyncStatus {
  sync_type: string;
  status: string | null;
  last_successful_sync_at: string | null;
  last_sync_at: string | null;
  error_message: string | null;
}

interface AnalyticsData {
  generatedAt: string;
  users: {
    total: number;
    active: number;
    admins: number;
    newLast7d: number;
  };
  errors: {
    last24h: ErrorWindow;
    last7d: ErrorWindow;
    last30d: ErrorWindow;
    topGroups: ErrorGroup[];
    series: ErrorSeries[];
    pagePerformance: PagePerformance[];
  };
  ai: {
    events30d: number;
    events7d: number;
    events24h: number;
    thumbsUp: number;
    thumbsDown: number;
  };
  sync: { statuses: SyncStatus[] };
  feedback: { recentCount7d: number; recent: unknown[] };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-orange-500/10 text-orange-600",
  medium: "bg-yellow-500/10 text-yellow-700",
  low: "bg-muted text-muted-foreground",
};

const SYNC_STATUS_ICON: Record<string, React.ReactNode> = {
  ok: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  success: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  error: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  pending: <Activity className="h-3.5 w-3.5 text-yellow-500" />,
  running: <Activity className="h-3.5 w-3.5 text-blue-500 animate-pulse" />,
};

// ── Sub-components ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-48 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

function SyncRow({ s }: { s: SyncStatus }) {
  const icon = SYNC_STATUS_ICON[s.status ?? ""] ?? (
    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
  );
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="truncate text-xs font-medium text-foreground capitalize">
          {s.sync_type.replace(/_/g, " ")}
        </span>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">{formatTime(s.last_successful_sync_at)}</p>
        {s.error_message && (
          <p className="mt-0.5 text-xs text-destructive truncate max-w-40">
            {s.error_message.slice(0, 60)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Custom Recharts Tooltip ────────────────────────────────────────────────

function ErrorChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="rounded-lg bg-muted px-3 py-2 shadow-xs text-xs">
      <p className="mb-1.5 font-semibold text-foreground">{label} — {total} errors</p>
      {payload.map((p) =>
        p.value > 0 ? (
          <div key={p.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="capitalize text-muted-foreground">{p.name}:</span>
            <span className="font-medium text-foreground">{p.value}</span>
          </div>
        ) : null,
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────

export function PlatformAnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AnalyticsData>("/api/admin/analytics");
      setData(res);
      setRefreshedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error || !data) {
    return (
      <ErrorState
        title="Could not load analytics"
        description={error ?? "Unknown error"}
        onRetry={load}
      />
    );
  }

  const { errors, ai, sync } = data;

  const aiSatisfaction =
    ai.thumbsUp + ai.thumbsDown > 0
      ? Math.round((ai.thumbsUp / (ai.thumbsUp + ai.thumbsDown)) * 100)
      : null;

  return (
    <div className="space-y-10">

      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {refreshedAt ? `Last refreshed ${formatTime(refreshedAt.toISOString())}` : ""}
        </p>
        <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 h-7 text-xs">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* ── Page Performance ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionRuleHeading label="Page Performance" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/60 text-muted-foreground">
              <tr>
                <th className="px-0 py-2 font-medium">Page</th>
                <th className="px-3 py-2 text-right font-medium">24h errors</th>
                <th className="px-3 py-2 text-right font-medium">7d errors</th>
                <th className="px-3 py-2 text-right font-medium">30d errors</th>
                <th className="px-0 py-2 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {errors.pagePerformance.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                    No page error signals in the last 30 days.
                  </td>
                </tr>
              ) : (
                errors.pagePerformance.map((page) => (
                  <tr key={page.pagePath}>
                    <td className="max-w-0 truncate px-0 py-2 font-medium text-foreground">
                      {page.pagePath}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {page.errors24h}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {page.errors7d}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {page.errors30d}
                    </td>
                    <td className="px-0 py-2 text-right text-muted-foreground">
                      {formatTime(page.lastSeenAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Error KPIs ──────────────────────────────────────────────────── */}
      <section>
        <SectionRuleHeading icon={<AlertTriangle className="h-4 w-4" />} label="App Errors" />
        <KpiRow
          metrics={[
            {
              label: "Errors (24h)",
              value: errors.last24h.total.toString(),
              size: "medium",
              delta: errors.last24h.total > 0
                ? { value: `${errors.last24h.bySeverity.critical ?? 0} critical`, positive: false }
                : undefined,
            },
            {
              label: "Errors (7d)",
              value: errors.last7d.total.toString(),
              size: "medium",
            },
            {
              label: "Errors (30d)",
              value: errors.last30d.total.toString(),
              size: "medium",
            },
            {
              label: "Error Groups",
              value: errors.topGroups.length.toString(),
              context: "active groups",
              size: "medium",
            },
          ]}
        />
      </section>

      {/* ── Error Chart + Top Groups ─────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionRuleHeading label="Error Trend (14 days)" />
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errors.series} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: string) => formatDate(v)}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ErrorChartTooltip />} />
                <Bar dataKey="critical" stackId="a" fill="hsl(var(--destructive))" radius={0} name="critical" />
                <Bar dataKey="high" stackId="a" fill="#f97316" radius={0} name="high" />
                <Bar dataKey="medium" stackId="a" fill="#eab308" radius={0} name="medium" />
                <Bar dataKey="low" stackId="a" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} name="low" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <SectionRuleHeading label="Top Error Groups" />
          <div className="divide-y divide-border/50">
            {errors.topGroups.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No error groups found.</p>
            ) : (
              errors.topGroups.slice(0, 6).map((g) => (
                <div key={g.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground">{g.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Last seen {formatTime(g.last_seen_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px] h-4 px-1.5", SEVERITY_BG[g.severity])}
                    >
                      {g.severity}
                    </Badge>
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      {g.event_count}×
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── AI Engagement + Sync Health ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionRuleHeading icon={<Zap className="h-4 w-4" />} label="AI Engagement" />
          <KpiRow
            metrics={[
              { label: "Events (24h)", value: ai.events24h.toString(), size: "small" },
              { label: "Events (7d)", value: ai.events7d.toString(), size: "small" },
              { label: "Events (30d)", value: ai.events30d.toString(), size: "small" },
              {
                label: "Satisfaction",
                value: aiSatisfaction !== null ? `${aiSatisfaction}%` : "—",
                size: "small",
                delta:
                  aiSatisfaction !== null
                    ? { value: `${ai.thumbsUp}↑ ${ai.thumbsDown}↓`, positive: aiSatisfaction >= 70 }
                    : undefined,
              },
            ]}
          />
          <div className="mt-4 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold text-foreground">{ai.thumbsUp}</span>
              <span className="text-xs text-muted-foreground">positive</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold text-foreground">{ai.thumbsDown}</span>
              <span className="text-xs text-muted-foreground">negative</span>
            </div>
          </div>
        </section>

        <section>
          <SectionRuleHeading icon={<Shield className="h-4 w-4" />} label="Sync Health" />
          <div className="divide-y divide-border/50">
            {sync.statuses.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No sync records found.</p>
            ) : (
              sync.statuses.map((s) => (
                <SyncRow key={s.sync_type} s={s} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
