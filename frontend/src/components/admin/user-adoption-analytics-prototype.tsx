"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

import { DetailField, KpiRow } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
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

interface AdoptionSnapshot {
  activeEmployees: number;
  employeeAccounts: number;
  activeDelta: string;
  workflowUsers: number;
  workflowDelta: string;
  trend: TrendPoint[];
}

interface RecentActivityItem {
  name: string;
  role: string;
  latestActivity: string;
  activityContext: string;
  recordedAt: string;
}

const snapshots: Record<Range, AdoptionSnapshot> = {
  "30": {
    activeEmployees: 63,
    employeeAccounts: 74,
    activeDelta: "+7 from the prior 30 days",
    workflowUsers: 44,
    workflowDelta: "+5 from the prior 30 days",
    trend: [
      { label: "Jul 1", value: 41 },
      { label: "Jul 8", value: 47 },
      { label: "Jul 15", value: 45 },
      { label: "Jul 22", value: 56 },
      { label: "Jul 29", value: 63 },
    ],
  },
  "90": {
    activeEmployees: 63,
    employeeAccounts: 74,
    activeDelta: "+18 from the prior 90 days",
    workflowUsers: 44,
    workflowDelta: "+16 from the prior 90 days",
    trend: [
      { label: "May 6", value: 24 },
      { label: "May 20", value: 28 },
      { label: "Jun 3", value: 35 },
      { label: "Jun 17", value: 39 },
      { label: "Jul 1", value: 41 },
      { label: "Jul 15", value: 45 },
      { label: "Jul 29", value: 63 },
    ],
  },
};

const workflow = [
  { label: "Employee account", users: 74, detail: "Has access to the organization" },
  { label: "Opened a project", users: 68, detail: "Reached a project workspace" },
  { label: "Added a budget", users: 52, detail: "Completed the first financial setup step" },
  { label: "Created a commitment", users: 44, detail: "Used a core execution workflow" },
  { label: "Completed a change or invoice", users: 29, detail: "Reached a recurring operating workflow" },
];

const roleAdoption = [
  { role: "Project managers", project: "92%", budget: "81%", commitment: "73%", change: "58%" },
  { role: "Operations", project: "84%", budget: "64%", commitment: "49%", change: "37%" },
  { role: "Accounting", project: "71%", budget: "76%", commitment: "62%", change: "69%" },
];

const recentActivity: RecentActivityItem[] = [
  {
    name: "Carmen Holt",
    role: "Project manager · Northline Builders",
    latestActivity: "Updated the Northline budget",
    activityContext: "Budget · Northline civic center",
    recordedAt: "16 minutes ago",
  },
  {
    name: "David Ellis",
    role: "Operations · Riverstone Construction",
    latestActivity: "Added three project documents",
    activityContext: "Documents · Riverstone medical office",
    recordedAt: "42 minutes ago",
  },
  {
    name: "Maya Simmons",
    role: "Accounting · Summit Civil",
    latestActivity: "Reviewed commitment invoice values",
    activityContext: "Commitment · Summit transit station",
    recordedAt: "1 hour ago",
  },
];

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
  const [displayedValues, setDisplayedValues] = useState({ active: 0, workflow: 0 });
  const snapshot = snapshots[range];
  const workflowRate = Math.round((snapshot.workflowUsers / snapshot.employeeAccounts) * 100);
  const activeRate = Math.round((snapshot.activeEmployees / snapshot.employeeAccounts) * 100);

  useLayoutEffect(() => {
    if (!root.current) return undefined;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const counters = { active: 0, workflow: 0 };
    const context = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set("[data-analytics-reveal]", { opacity: 1, y: 0 });
        setDisplayedValues({ active: snapshot.activeEmployees, workflow: snapshot.workflowUsers });
        return;
      }

      gsap.fromTo(
        "[data-analytics-reveal]",
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.42, ease: "power2.out", stagger: 0.06 },
      );
      gsap.to(counters, {
        active: snapshot.activeEmployees,
        workflow: snapshot.workflowUsers,
        duration: 0.8,
        ease: "power2.out",
        snap: { active: 1, workflow: 1 },
        onUpdate: () => setDisplayedValues({ active: counters.active, workflow: counters.workflow }),
      });
    }, root);

    return () => context.revert();
  }, [snapshot]);

  const coverageText = useMemo(
    () => `${workflow.length} core events in the prototype workflow are illustrative`,
    [],
  );

  return (
    <div className="space-y-10" ref={root}>
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between" data-analytics-reveal>
        <div className="max-w-2xl space-y-1">
          <p className="text-sm text-muted-foreground">Prototype, illustrative data</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Review employee account coverage, recent activity, and usage of the operating workflows they own.
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
            This prototype does not claim these measurements are live. Production should record the user, organization, role,
            workflow event, and timestamp for each milestone. Events without an organization or user identity should be shown as
            unassigned, not included in employee-accountability reporting.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{coverageText}.</p>
        </section>
      ) : null}

      <section data-analytics-reveal>
        <SectionRuleHeading as="h2" className="mb-3 pb-0" label="Account reference" />
        <KpiRow
          metrics={[
            { label: "Employee accounts", value: "74", context: "Internal app accounts" },
            { label: "Subcontractor accounts", value: "15", context: "External collaborator accounts" },
            { label: "Admins", value: "8", context: "Platform-level access" },
          ]}
          size="medium"
        />
      </section>

      <section className="grid gap-10 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.8fr)]" data-analytics-reveal>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <SectionRuleHeading as="h2" className="mb-1 pb-0" label="Weekly employee activity" />
              <p className="mt-1 text-sm text-muted-foreground">Employees with a meaningful project action in the selected period</p>
            </div>
            <p className="text-sm text-muted-foreground">{snapshot.activeDelta}</p>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <p className="font-mono text-4xl font-medium tabular-nums tracking-tight text-foreground">{displayedValues.active}</p>
            <p className="pb-1 text-sm text-muted-foreground">of {snapshot.employeeAccounts} employee accounts, {activeRate}% active</p>
          </div>
          <TrendLine trend={snapshot.trend} />
        </div>

        <div className="border-t border-border pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <p className="text-sm font-medium text-foreground">Recent activity</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Latest meaningful work recorded across employee accounts.
          </p>
          <div className="mt-5 divide-y divide-border">
            {recentActivity.map((user) => (
              <Button
                className="h-auto w-full justify-start whitespace-normal px-0 py-3 text-left hover:text-primary focus-visible:text-primary"
                key={user.name}
                onClick={() => setSelectedUser(user)}
                type="button"
                variant="ghost"
              >
                <span className="block text-sm font-medium text-foreground">{user.name}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{user.latestActivity} · {user.recordedAt}</span>
              </Button>
            ))}
          </div>
          <Button className="mt-5 px-0" onClick={() => setSelectedUser(recentActivity[0])} size="sm" variant="link">
            Open activity feed
          </Button>
        </div>
      </section>

      <section className="border-t border-border pt-8" data-analytics-reveal>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <SectionRuleHeading as="h2" className="mb-1 pb-0" label="Employee workflow usage" />
            <p className="mt-1 text-sm text-muted-foreground">An accountability view of the operating workflows employees complete</p>
          </div>
          <p className="text-sm text-muted-foreground">{displayedValues.workflow} used a core workflow, {workflowRate}% of employees</p>
        </div>
        <ol className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          {workflow.map((step, index) => {
            const conversion = Math.round((step.users / workflow[0].users) * 100);
            return (
              <li className="space-y-2" key={step.label}>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span className="font-mono tabular-nums">{conversion}%</span>
                </div>
                <div className="h-1.5 bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${conversion}%` }} />
                </div>
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                <p className="text-xs leading-5 text-muted-foreground">{step.users} users, {step.detail}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="border-t border-border pt-8" data-analytics-reveal>
        <div>
          <SectionRuleHeading as="h2" className="mb-1 pb-0" label="Adoption by role" />
          <p className="mt-1 text-sm text-muted-foreground">Compare expected workflow use across employee roles</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 text-right font-medium">Project</th>
                <th className="pb-3 text-right font-medium">Budget</th>
                <th className="pb-3 text-right font-medium">Commitment</th>
                <th className="pb-3 text-right font-medium">Change or invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roleAdoption.map((role) => (
                <tr key={role.role}>
                  <td className="py-4 font-medium text-foreground">{role.role}</td>
                  <td className="py-4 text-right font-mono tabular-nums text-foreground">{role.project}</td>
                  <td className="py-4 text-right font-mono tabular-nums text-foreground">{role.budget}</td>
                  <td className="py-4 text-right font-mono tabular-nums text-foreground">{role.commitment}</td>
                  <td className="py-4 text-right font-mono tabular-nums text-foreground">{role.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SidePanel onOpenChange={(open) => !open && setSelectedUser(null)} open={Boolean(selectedUser)}>
        <SidePanelContent size="sm">
          {selectedUser ? (
            <>
              <SidePanelHeader>
                <SidePanelTitle>{selectedUser.name}</SidePanelTitle>
              </SidePanelHeader>
              <SidePanelBody className="space-y-6 text-sm">
                <div>
                  <p className="text-muted-foreground">{selectedUser.role}</p>
                  <p className="mt-3 font-medium text-foreground">{selectedUser.latestActivity}</p>
                </div>
                <div className="space-y-4 border-y border-border py-5">
                  <DetailField label="Recorded">{selectedUser.recordedAt}</DetailField>
                  <DetailField label="Context">{selectedUser.activityContext}</DetailField>
                </div>
                <Button className="w-full" onClick={() => setSelectedUser(null)} variant="outline">
                  Close preview
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Prototype behavior: production should open the canonical user or organization record with the filtered activity history.
                </p>
              </SidePanelBody>
            </>
          ) : null}
        </SidePanelContent>
      </SidePanel>
    </div>
  );
}
