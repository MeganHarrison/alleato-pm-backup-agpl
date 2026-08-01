"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { SectionRuleHeading } from "@/components/layout";
import { ErrorState } from "@/components/ds/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────

interface AnalyticsData {
  generatedAt: string;
  engagement: {
    recentLogins: Array<{ authUserId: string; lastLoginAt: string | null; email: string | null; fullName: string | null; isAdmin: boolean }>;
    recentAppUsage: Array<{ userId: string; fullName: string | null; email: string | null; lastSeenAt: string; entrySurface: string }>;
    recentLearning: Array<{ userId: string; fullName: string | null; email: string | null; title: string; lastViewedAt: string; checkpoint: number; completedAt: string | null; watchSeconds: number }>;
  };
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

// ── Sub-components ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
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

  const { engagement } = data;

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

      <section className="space-y-3">
        <SectionRuleHeading label="People & learning activity" />
        <p className="text-xs leading-5 text-muted-foreground">
          Sign-ins are from Supabase Auth. App activity begins with this release and records session liveness, not page-level browsing. Direct documentation-site viewing is anonymous.
        </p>
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="overflow-x-auto">
            <SectionRuleHeading as="h3" label="Recent sign-ins" className="mb-2 pb-0" />
            <table className="w-full text-left text-xs"><thead className="border-b border-border/60 text-muted-foreground"><tr><th className="py-2 font-medium">Person</th><th className="py-2 text-right font-medium">Last sign-in</th></tr></thead>
              <tbody className="divide-y divide-border/50">{engagement.recentLogins.length ? engagement.recentLogins.slice(0, 10).map((login) => <tr key={login.authUserId}><td className="py-2"><p className="font-medium text-foreground">{login.fullName ?? login.email ?? "Unknown user"}</p>{login.fullName && login.email ? <p className="text-muted-foreground">{login.email}</p> : null}</td><td className="py-2 text-right text-muted-foreground">{formatTime(login.lastLoginAt)}</td></tr>) : <tr><td colSpan={2} className="py-6 text-center text-muted-foreground">No Supabase Auth sign-ins were returned.</td></tr>}</tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <SectionRuleHeading as="h3" label="Recent app activity" className="mb-2 pb-0" />
            <table className="w-full text-left text-xs"><thead className="border-b border-border/60 text-muted-foreground"><tr><th className="py-2 font-medium">Person</th><th className="py-2 font-medium">Entry</th><th className="py-2 text-right font-medium">Last active</th></tr></thead>
              <tbody className="divide-y divide-border/50">{engagement.recentAppUsage.length ? engagement.recentAppUsage.slice(0, 10).map((session) => <tr key={session.userId}><td className="py-2 font-medium text-foreground">{session.fullName ?? session.email ?? "Unknown user"}</td><td className="py-2 capitalize text-muted-foreground">{session.entrySurface}</td><td className="py-2 text-right text-muted-foreground">{formatTime(session.lastSeenAt)}</td></tr>) : <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No application sessions yet. Tracking starts after release.</td></tr>}</tbody>
            </table>
          </div>
        </div>
        <div className="overflow-x-auto">
          <SectionRuleHeading as="h3" label="Training-video progress" className="mb-2 pb-0" />
          <table className="w-full text-left text-xs"><thead className="border-b border-border/60 text-muted-foreground"><tr><th className="py-2 font-medium">Person</th><th className="py-2 font-medium">Lesson</th><th className="py-2 text-right font-medium">Progress</th><th className="py-2 text-right font-medium">Last viewed</th></tr></thead>
            <tbody className="divide-y divide-border/50">{engagement.recentLearning.length ? engagement.recentLearning.slice(0, 20).map((progress) => <tr key={`${progress.userId}-${progress.title}`}><td className="py-2 font-medium text-foreground">{progress.fullName ?? progress.email ?? "Unknown user"}</td><td className="py-2 text-muted-foreground">{progress.title}</td><td className="py-2 text-right tabular-nums text-foreground">{progress.completedAt ? "Complete" : `${progress.checkpoint}%`}</td><td className="py-2 text-right text-muted-foreground">{formatTime(progress.lastViewedAt)}</td></tr>) : <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No tracked video progress yet.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
