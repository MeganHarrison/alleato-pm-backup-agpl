"use client";

export function BentoGridSection() {
  return (
    <section id="bento">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">05</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Bento Grid — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">Same 1px gap technique — but the gap color uses dark border, not light</p>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-px bg-border rounded-xl overflow-hidden shadow-sm mb-4">

        {/* Row 1 */}

        {/* Hero Cell */}
        <div className="col-span-5 min-h-[140px] bg-card p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Total Revenue</p>
          <p className="text-[28px] font-bold tracking-[-0.03em] text-foreground">$248,391</p>
          <div className="inline-flex items-center text-xs font-semibold px-[7px] py-0.5 rounded text-green-600 bg-green-50 mt-2">
            ↑ 18.4% vs last month
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1.5">Updated 2 minutes ago</p>
        </div>

        {/* Wide Cell */}
        <div className="col-span-4 bg-card p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Active Projects</p>
          <p className="text-[28px] font-bold tracking-[-0.03em] text-foreground">47</p>
          <div className="inline-flex items-center text-xs font-semibold px-[7px] py-0.5 rounded text-green-600 bg-green-50 mt-2">
            ↑ 3 new this week
          </div>
          {/* Mini chart */}
          <div className="flex items-end gap-[3px] h-10 mt-3">
            <div className="flex-1 bg-primary/20 rounded-t-sm" style={{ height: "30%" }} />
            <div className="flex-1 bg-primary/20 rounded-t-sm" style={{ height: "45%" }} />
            <div className="flex-1 bg-primary/20 rounded-t-sm" style={{ height: "60%" }} />
            <div className="flex-1 bg-primary/20 rounded-t-sm" style={{ height: "40%" }} />
            <div className="flex-1 bg-primary/20 rounded-t-sm" style={{ height: "70%" }} />
            <div className="flex-1 bg-primary/20 rounded-t-sm" style={{ height: "55%" }} />
            <div className="flex-1 bg-primary rounded-t-sm" style={{ height: "85%" }} />
          </div>
        </div>

        {/* Narrow Cell */}
        <div className="col-span-3 bg-card p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Churn Rate</p>
          <p className="text-[28px] font-bold tracking-[-0.03em] text-foreground">2.1%</p>
          <div className="inline-flex items-center text-xs font-semibold px-[7px] py-0.5 rounded text-red-600 bg-red-50 mt-2">
            ↓ 0.4%
          </div>
        </div>

        {/* Row 2 */}

        {/* Two-thirds Cell — Revenue by Channel */}
        <div className="col-span-8 bg-card p-6 pb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-4">Revenue by Channel</p>

          {[
            { label: "Direct", pct: 82, value: "$82k" },
            { label: "Organic", pct: 64, value: "$64k" },
            { label: "Referral", pct: 47, value: "$47k" },
            { label: "Paid", pct: 38, value: "$38k" },
            { label: "Social", pct: 22, value: "$22k" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-2.5 mb-2">
              <span className="text-[11px] text-muted-foreground/60 w-14 shrink-0 text-right">{row.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary opacity-70"
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground font-mono w-9">{row.value}</span>
            </div>
          ))}
        </div>

        {/* One-third Cell — Top Accounts */}
        <div className="col-span-4 bg-card p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-3">Top Accounts</p>

          {[
            { name: "Alleato Group", value: "$42k" },
            { name: "Acme Corp", value: "$31k" },
            { name: "Horizon LLC", value: "$28k" },
            { name: "Meridian Co", value: "$19k" },
          ].map((row, i, arr) => (
            <div
              key={row.name}
              className={`flex items-center justify-between gap-3 py-2 ${i < arr.length - 1 ? "border-b border-border" : ""}`}
            >
              <span className="text-[13px] text-muted-foreground">{row.name}</span>
              <span className="text-[13px] font-semibold text-foreground font-mono">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Row 3 — Footer bar */}
        <div className="col-span-12 bg-muted/50 px-6 py-5 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Recent Transactions</span>
          <span className="text-xs text-primary cursor-pointer font-medium">View all →</span>
        </div>

      </div>
    </section>
  );
}
