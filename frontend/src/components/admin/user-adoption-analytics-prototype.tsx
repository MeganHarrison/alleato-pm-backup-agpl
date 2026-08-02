"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

import { DetailField, KpiRow } from "@/components/ds";
import { ErrorState } from "@/components/ds/error-state";
import { SectionRuleHeading } from "@/components/layout";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";

type Range = "30" | "90";

interface TrendPoint {
  label: string;
  value: number;
}

interface RecentActivityItem {
  userId: string;
  name: string;
  entrySurface: string;
  lastSeenAt: string;
}

interface AnalyticsData {
  generatedAt: string;
  accountability: {
    rangeDays: number;
    accountCounts: { employees: number; subcontractors: number; admins: number; unclassified: number };
    activeEmployees: number;
    activeEmployeeDelta: number;
    weeklyActivity: Array<{ weekStart: string; activeEmployees: number }>;
    recentActivity: Array<{ userId: string; fullName: string; entrySurface: string; lastSeenAt: string }>;
    isComplete: boolean;
  };
}

const USER_MANAGEMENT_HREF = "/user-management";

function formatTime(iso: string): string {
  const difference = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(difference / 60_000);
  const hours = Math.floor(difference / 3_600_000);
  const days = Math.floor(difference / 86_400_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEntrySurface(entrySurface: string): string {
  return entrySurface.replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function TrendLine({ trend }: { trend: TrendPoint[] }) {
  const dimensions = { width: 620, height: 188, paddingX: 18, paddingY: 20 };
  const max = Math.max(...trend.map((point) => point.value));
  const min = Math.min(...trend.map((point) => point.value));
  const range = Math.max(max - min, 1);
  const points = trend.map((point, index) => {
    const x = dimensions.paddingX + (index / Math.max(trend.length - 1, 1)) * (dimensions.width - dimensions.paddingX * 2);
    const y = dimensions.paddingY + (1 - (point.value - min) / range) * (dimensions.height - dimensions.paddingY * 2);
    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="mt-5" data-analytics-reveal>
      <svg
        aria-label="Weekly active employee accounts trend"
        className="h-auto w-full overflow-visible text-primary"
        role="img"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        {[0.25, 0.5, 0.75].map((position) => (
          <line
            className="stroke-border"
            key={position}
            strokeWidth="1"
            x1={dimensions.paddingX}
            x2={dimensions.width - dimensions.paddingX}
            y1={dimensions.paddingY + position * (dimensions.height - dimensions.paddingY * 2)}
            y2={dimensions.paddingY + position * (dimensions.height - dimensions.paddingY * 2)}
          />
        ))}
        <path className="stroke-current" d={path} fill="none" strokeWidth="2.5" />
        {points.map((point) => (
          <g key={point.label}>
            <circle className="fill-background stroke-current" cx={point.x} cy={point.y} r="4" strokeWidth="2" />
            <text className="fill-muted-foreground text-[11px]" textAnchor="middle" x={point.x} y={dimensions.height - 2}>
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function UserAdoptionAnalyticsPrototype() {
  const root = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>("30");
  const [trackingNotesOpen, setTrackingNotesOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RecentActivityItem | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayedActiveEmployees, setDisplayedActiveEmployees] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<AnalyticsData>(`/api/admin/analytics?range=${range}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Analytics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  const accountability = data?.accountability;
  const trend: TrendPoint[] = accountability?.weeklyActivity.map((point) => ({
    label: new Date(point.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: point.activeEmployees,
  })) ?? [];
  const recentActivity: RecentActivityItem[] = accountability?.recentActivity.map((activity) => ({
    userId: activity.userId,
    name: activity.fullName,
    entrySurface: activity.entrySurface,
    lastSeenAt: activity.lastSeenAt,
  })) ?? [];
  const activeRate = accountability && accountability.accountCounts.employees > 0
    ? Math.round((accountability.activeEmployees / accountability.accountCounts.employees) * 100)
    : 0;

  useLayoutEffect(() => {
    if (!root.current || !accountability) return undefined;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const counters = { active: 0 };
    const context = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set("[data-analytics-reveal]", { opacity: 1, y: 0 });
        setDisplayedActiveEmployees(accountability.activeEmployees);
        return;
      }

      gsap.fromTo(
        "[data-analytics-reveal]",
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.42, ease: "power2.out", stagger: 0.06 },
      );
      gsap.to(counters, {
        active: accountability.activeEmployees,
        duration: 0.8,
        ease: "power2.out",
        snap: { active: 1 },
        onUpdate: () => setDisplayedActiveEmployees(counters.active),
      });
    }, root);

    return () => context.revert();
  }, [accountability]);

  if (loading && !data) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (error || !data || !accountability) {
    return <ErrorState description={error ?? "No accountability data was returned."} onRetry={load} title="Could not load employee analytics" />;
  }

  const deltaText = accountability.activeEmployeeDelta === 0
    ? `No change from the prior ${accountability.rangeDays} days`
    : `${accountability.activeEmployeeDelta > 0 ? "+" : ""}${accountability.activeEmployeeDelta} from the prior ${accountability.rangeDays} days`;

  return (
    <div className="space-y-10" ref={root}>
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between" data-analytics-reveal>
        <div className="max-w-2xl space-y-1">
          <p className="text-sm text-muted-foreground">Live accountability data</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Review current account coverage and authenticated app activity across employee accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div aria-label="Reporting period" className="flex items-center rounded-md border border-border p-0.5">
            {(["30", "90"] as const).map((value) => (
              <Button
                aria-pressed={range === value}
                className="h-8 px-3 text-xs"
                key={value}
                onClick={() => setRange(value)}
                size="sm"
                variant={range === value ? "secondary" : "ghost"}
              >
                {value} days
              </Button>
            ))}
          </div>
          <Button onClick={() => setTrackingNotesOpen((current) => !current)} size="sm" variant="ghost">
            {trackingNotesOpen ? "Hide tracking notes" : "Tracking notes"}
          </Button>
        </div>
      </div>

      {trackingNotesOpen ? (
        <section className="border-b border-border pb-6 text-sm" data-analytics-reveal>
          <SectionRuleHeading as="h2" className="mb-1 pb-0" label="Instrument before interpreting" />
          <p className="mt-2 max-w-3xl leading-6 text-muted-foreground">
            Account classifications and app-session liveness are live. Workflow completion is not: future instrumentation should
            record the user, organization, role, workflow event, and timestamp for each milestone. Events without an organization
            or user identity should be shown as unassigned, not included in employee-accountability reporting.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Current activity is authenticated session liveness and entry surface only; page-level workflow completion is not yet instrumented.
            {accountability.accountCounts.unclassified > 0 ? ` ${accountability.accountCounts.unclassified} account${accountability.accountCounts.unclassified === 1 ? " is" : "s are"} in legacy User or Contact classifications and excluded from Employee and Subcontractor counts.` : ""}
          </p>
        </section>
      ) : null}

      <section data-analytics-reveal>
        <SectionRuleHeading as="h2" className="mb-3 pb-0" label="Account reference" />
        <KpiRow
          metrics={[
            { label: "Employee accounts", value: String(accountability.accountCounts.employees), context: "Exact Employee classification", href: USER_MANAGEMENT_HREF },
            { label: "Subcontractor accounts", value: String(accountability.accountCounts.subcontractors), context: "Exact Subcontractor classification", href: USER_MANAGEMENT_HREF },
            { label: "Admins", value: String(accountability.accountCounts.admins), context: "Platform-level access", href: USER_MANAGEMENT_HREF },
          ]}
          size="medium"
        />
      </section>

      <section className="grid gap-10 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.8fr)]" data-analytics-reveal>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <SectionRuleHeading as="h2" className="mb-1 pb-0" label="Weekly employee activity" />
              <p className="mt-1 text-sm text-muted-foreground">Employees with an authenticated app session in the selected period</p>
            </div>
            <p className="text-sm text-muted-foreground">{deltaText}</p>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <p className="font-mono text-4xl font-medium tabular-nums tracking-tight text-foreground">{displayedActiveEmployees}</p>
            <p className="pb-1 text-sm text-muted-foreground">of {accountability.accountCounts.employees} employee accounts, {activeRate}% active</p>
          </div>
          {trend.length ? <TrendLine trend={trend} /> : <p className="mt-5 text-sm text-muted-foreground">No employee sessions in this period.</p>}
        </div>

        <div className="border-t border-border pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <p className="text-sm font-medium text-foreground">Recent activity</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Latest authenticated session for each active employee.
          </p>
          <div className="mt-5 divide-y divide-border">
            {recentActivity.length ? recentActivity.map((user) => (
              <Button
                className="h-auto w-full justify-start whitespace-normal px-0 py-3 text-left hover:text-primary focus-visible:text-primary"
                key={user.name}
                onClick={() => setSelectedUser(user)}
                type="button"
                variant="ghost"
              >
                <span className="block text-sm font-medium text-foreground">{user.name}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{formatEntrySurface(user.entrySurface)} · {formatTime(user.lastSeenAt)}</span>
              </Button>
            )) : <p className="py-4 text-sm text-muted-foreground">No employee sessions were recorded in this period.</p>}
          </div>
          <Button asChild className="mt-5 px-0" size="sm" variant="link">
            <a href={USER_MANAGEMENT_HREF}>Open User Management</a>
          </Button>
        </div>
      </section>

      {!accountability.isComplete ? (
        <p className="border-t border-border pt-6 text-sm text-destructive" data-analytics-reveal>
          Activity reporting reached its session safety limit. Narrow the reporting window or increase the API limit before using this period for accountability decisions.
        </p>
      ) : null}

      <SidePanel onOpenChange={(open) => !open && setSelectedUser(null)} open={Boolean(selectedUser)}>
        <SidePanelContent size="sm">
          {selectedUser ? (
            <>
              <SidePanelHeader>
                <SidePanelTitle>{selectedUser.name}</SidePanelTitle>
              </SidePanelHeader>
              <SidePanelBody className="space-y-6 text-sm">
                <div>
                  <p className="text-muted-foreground">Employee account</p>
                  <p className="mt-3 font-medium text-foreground">Active from {formatEntrySurface(selectedUser.entrySurface)}</p>
                </div>
                <div className="space-y-4 border-y border-border py-5">
                  <DetailField label="Last active">{formatTime(selectedUser.lastSeenAt)}</DetailField>
                  <DetailField label="Entry surface">{formatEntrySurface(selectedUser.entrySurface)}</DetailField>
                </div>
                <Button className="w-full" onClick={() => setSelectedUser(null)} variant="outline">
                  Close preview
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Session liveness does not identify a page-level action. Use User Management to review this account's access and classification.
                </p>
              </SidePanelBody>
            </>
          ) : null}
        </SidePanelContent>
      </SidePanel>
    </div>
  );
}
