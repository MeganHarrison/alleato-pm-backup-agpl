"use client";

import { Badge } from "@/components/ds";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Pause,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";

export function BadgesSection() {
  return (
    <section id="badges" className="scroll-mt-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">
          14
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Badges & Pills
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Status indicators, labels, counts, and role chips. Use semantic
            variants to convey meaning without color alone.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Variant Row */}
        <div className="rounded-xl bg-card p-6 shadow-sm">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            All Variants
          </p>
          <div className="flex flex-wrap gap-3">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
          </div>
        </div>

        {/* Semantic Status */}
        <div className="rounded-xl bg-card p-6 shadow-sm">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            Semantic Status Badges
          </p>
          <div className="flex flex-wrap gap-3">
            <Badge variant="active">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </Badge>
            <Badge variant="inactive">
              <Circle className="h-3 w-3" />
              Inactive
            </Badge>
            <Badge variant="warning">
              <Clock className="h-3 w-3" />
              Pending
            </Badge>
            <Badge variant="destructive">
              <XCircle className="h-3 w-3" />
              Rejected
            </Badge>
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3" />
              Approved
            </Badge>
            <Badge variant="outline">
              <Pause className="h-3 w-3" />
              On Hold
            </Badge>
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3" />
              Overdue
            </Badge>
          </div>
        </div>

        {/* Role Badges */}
        <div className="rounded-xl bg-card p-6 shadow-sm">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            Role / Permission Chips
          </p>
          <div className="flex flex-wrap gap-3">
            <Badge variant="admin">Admin</Badge>
            <Badge variant="project-manager">Project Manager</Badge>
            <Badge variant="superintendent">Superintendent</Badge>
            <Badge variant="foreman">Foreman</Badge>
            <Badge variant="viewer">Viewer</Badge>
          </div>
        </div>

        {/* In Context: Table Row Use */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            In Context — Table Rows
          </h3>
          <div className="rounded-xl bg-card shadow-sm overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Contract
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Vendor
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Value
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  {
                    contract: "SC-001",
                    vendor: "Pacific Steel Works",
                    value: "$842,000",
                    status: "active" as const,
                    statusLabel: "Active",
                    trend: "up",
                  },
                  {
                    contract: "SC-002",
                    vendor: "Meridian Concrete",
                    value: "$1,240,000",
                    status: "warning" as const,
                    statusLabel: "Pending",
                    trend: "neutral",
                  },
                  {
                    contract: "SC-003",
                    vendor: "Alpine Electrical",
                    value: "$388,000",
                    status: "success" as const,
                    statusLabel: "Approved",
                    trend: "up",
                  },
                  {
                    contract: "SC-004",
                    vendor: "Summit Framing",
                    value: "$210,000",
                    status: "destructive" as const,
                    statusLabel: "Overdue",
                    trend: "down",
                  },
                ].map(({ contract, vendor, value, status, statusLabel, trend }) => (
                  <tr key={contract} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-[12px] text-muted-foreground">
                      {contract}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">
                      {vendor}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-foreground">
                      {value}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={status}>{statusLabel}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {trend === "up" && (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      )}
                      {trend === "down" && (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      {trend === "neutral" && (
                        <Flame className="h-4 w-4 text-amber-500" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Count / Number Badges */}
        <div className="rounded-xl bg-card p-6 shadow-sm">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            Count Badges (Notification Dots)
          </p>
          <div className="flex flex-wrap items-center gap-6">
            {[
              { label: "Inbox", count: 4 },
              { label: "Alerts", count: 12 },
              { label: "Reviews", count: 99 },
              { label: "Updates", count: 0 },
            ].map(({ label, count }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[13px] text-foreground">{label}</span>
                {count > 0 ? (
                  <Badge
                    variant="default"
                    className="h-4.5 min-w-[1.1rem] px-1 text-[10px] font-bold"
                  >
                    {count > 99 ? "99+" : count}
                  </Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
