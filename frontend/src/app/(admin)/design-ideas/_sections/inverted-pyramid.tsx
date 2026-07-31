"use client";

import { Button } from "@/components/ui/button";

export function InvertedPyramidSection() {
  return (
    <section id="inverted-pyramid">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">08</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Inverted Pyramid Layout</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            The interior panels alternate between white and surface-2 to reinforce the depth hierarchy
          </p>
        </div>
      </div>

      {/* Demo Card */}
      <div className="bg-card rounded-xl overflow-hidden shadow-sm mb-4">

        {/* A. Header Row */}
        <div className="p-6 px-7 border-b border-border flex items-start justify-between bg-card">
          <div>
            <div className="text-xl font-semibold tracking-[-0.02em] text-foreground">Analytics Overview</div>
            <div className="text-[13px] text-muted-foreground/60 mt-0.5">November 2024 · Updated 4 minutes ago</div>
          </div>
          <Button size="sm">
            Export Report
          </Button>
        </div>

        {/* B. KPI Row */}
        <div className="grid grid-cols-4 gap-px bg-border border-b border-border">
          {/* KPI 1 */}
          <div className="bg-card p-5 px-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Monthly Revenue</div>
            <div className="text-2xl font-bold tracking-[-0.03em] text-foreground leading-none mb-1">$248k</div>
            <div className="inline-flex text-[11px] font-semibold px-[7px] py-0.5 rounded mb-1 text-green-600 bg-green-50">
              ↑ 18.4%
            </div>
            <div className="text-[11px] text-muted-foreground/60">vs $209k last month</div>
          </div>
          {/* KPI 2 */}
          <div className="bg-card p-5 px-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Active Users</div>
            <div className="text-2xl font-bold tracking-[-0.03em] text-foreground leading-none mb-1">14,821</div>
            <div className="inline-flex text-[11px] font-semibold px-[7px] py-0.5 rounded mb-1 text-green-600 bg-green-50">
              ↑ 6.2%
            </div>
            <div className="text-[11px] text-muted-foreground/60">2,847 active today</div>
          </div>
          {/* KPI 3 */}
          <div className="bg-card p-5 px-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Avg. Session</div>
            <div className="text-2xl font-bold tracking-[-0.03em] text-foreground leading-none mb-1">4m 31s</div>
            <div className="inline-flex text-[11px] font-semibold px-[7px] py-0.5 rounded mb-1 text-red-600 bg-red-50">
              ↓ 0.8%
            </div>
            <div className="text-[11px] text-muted-foreground/60">vs 4m 35s last month</div>
          </div>
          {/* KPI 4 */}
          <div className="bg-card p-5 px-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Conversion</div>
            <div className="text-2xl font-bold tracking-[-0.03em] text-foreground leading-none mb-1">3.82%</div>
            <div className="inline-flex text-[11px] font-semibold px-[7px] py-0.5 rounded mb-1 text-green-600 bg-green-50">
              ↑ 0.3pp
            </div>
            <div className="text-[11px] text-muted-foreground/60">Target: 4.0%</div>
          </div>
        </div>

        {/* C. Mid Row */}
        <div className="grid grid-cols-[2fr_1fr] gap-px bg-border border-b border-border">
          {/* Chart Area */}
          <div className="bg-card p-6">
            <div className="text-xs font-semibold text-muted-foreground mb-4">Revenue by Source</div>
            {/* Bar: Enterprise */}
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-[11px] text-muted-foreground/60 w-14 shrink-0 text-right">Enterprise</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full">
                <div className="h-full rounded-full bg-primary opacity-70" style={{ width: "72%" }} />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground font-mono w-9">$178k</span>
            </div>
            {/* Bar: SMB */}
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-[11px] text-muted-foreground/60 w-14 shrink-0 text-right">SMB</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full">
                <div className="h-full rounded-full bg-primary opacity-70" style={{ width: "44%" }} />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground font-mono w-9">$109k</span>
            </div>
            {/* Bar: Self-serve */}
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-[11px] text-muted-foreground/60 w-14 shrink-0 text-right">Self-serve</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full">
                <div className="h-full rounded-full bg-primary opacity-70" style={{ width: "25%" }} />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground font-mono w-9">$62k</span>
            </div>
          </div>

          {/* Activity Panel */}
          <div className="bg-muted/50 p-6">
            <div className="text-xs font-semibold text-muted-foreground mb-3">Recent Activity</div>
            {/* Item 1 */}
            <div className="flex gap-2.5 py-2 border-b border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-[5px] shrink-0" />
              <p className="text-xs text-muted-foreground/60 leading-[1.5]">
                <strong className="text-muted-foreground font-medium">Alleato Group</strong> upgraded to Enterprise
              </p>
            </div>
            {/* Item 2 */}
            <div className="flex gap-2.5 py-2 border-b border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 mt-[5px] shrink-0" />
              <p className="text-xs text-muted-foreground/60 leading-[1.5]">
                <strong className="text-muted-foreground font-medium">3 new signups</strong> from referral campaign
              </p>
            </div>
            {/* Item 3 */}
            <div className="flex gap-2.5 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-[5px] shrink-0" />
              <p className="text-xs text-muted-foreground/60 leading-[1.5]">
                <strong className="text-muted-foreground font-medium">API latency spike</strong> at 14:32
              </p>
            </div>
          </div>
        </div>

        {/* D. Table Area */}
        <div className="bg-card">
          {/* Table Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground">Top Accounts by Revenue</span>
            <span className="text-xs text-primary cursor-pointer font-medium">View all accounts →</span>
          </div>

          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <th className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 px-6 pb-2.5 text-left border-b border-border">
                  Account
                </th>
                <th className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 px-4 pb-2.5 text-left border-b border-border">
                  MRR
                </th>
                <th className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 px-4 pb-2.5 text-left border-b border-border">
                  Plan
                </th>
                <th className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 px-4 pb-2.5 text-left border-b border-border">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1 */}
              <tr>
                <td className="px-6 py-2.5 text-foreground font-medium border-b border-border">Alleato Group</td>
                <td className="px-4 py-2.5 text-muted-foreground border-b border-border">$12,400</td>
                <td className="px-4 py-2.5 text-muted-foreground/60 border-b border-border">Enterprise</td>
                <td className="px-4 py-2.5 border-b border-border">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                    Active
                  </span>
                </td>
              </tr>
              {/* Row 2 */}
              <tr>
                <td className="px-6 py-2.5 text-foreground font-medium border-b border-border">Meridian Labs</td>
                <td className="px-4 py-2.5 text-muted-foreground border-b border-border">$8,200</td>
                <td className="px-4 py-2.5 text-muted-foreground/60 border-b border-border">Growth</td>
                <td className="px-4 py-2.5 border-b border-border">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                    Active
                  </span>
                </td>
              </tr>
              {/* Row 3 */}
              <tr>
                <td className="px-6 py-2.5 text-foreground font-medium">Apex Systems</td>
                <td className="px-4 py-2.5 text-muted-foreground">$6,800</td>
                <td className="px-4 py-2.5 text-muted-foreground/60">Growth</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                    Trial
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
