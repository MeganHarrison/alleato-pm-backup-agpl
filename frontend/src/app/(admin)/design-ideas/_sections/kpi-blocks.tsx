"use client";

export function KpiBlocksSection() {
  return (
    <section id="kpi">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">12</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">KPI / Metric Blocks — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">Same anatomy, but the container gets shadow-sm to float off the canvas</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-border shadow-sm mb-6">
        {/* Wrong side */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-600 bg-red-50 px-2 py-[3px] rounded mb-5">
            ✗ Wrong — Lazy metric cards
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Revenue", value: "$248k" },
              { label: "Users", value: "14,821" },
              { label: "Conv.", value: "3.82%" },
            ].map((item) => (
              <div key={item.label} className="bg-muted/50 border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground/60 mb-1.5">{item.label}</div>
                <div className="text-[22px] font-bold text-foreground">{item.value}</div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            No shadow, no delta, no context. Gray cards on white look depressed.
          </p>
        </div>

        {/* Right side */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-green-600 bg-green-50 px-2 py-[3px] rounded mb-5">
            ✓ Right — Full-context with shadow
          </div>

          <div className="grid grid-cols-3 gap-px bg-border rounded-xl overflow-hidden shadow-sm">
            {/* Cell 1: Revenue */}
            <div className="bg-card p-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/60 mb-3">
                REVENUE
              </div>
              <div className="flex items-end gap-2.5 mb-1.5">
                <span className="text-[28px] font-bold tracking-[-0.03em] text-foreground leading-none">$248k</span>
                <span className="text-[11px] font-semibold px-[7px] py-0.5 rounded mb-0.5 text-green-600 bg-green-50">
                  ↑ 18%
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground/60">vs $209k last month</div>
            </div>

            {/* Cell 2: Active Users */}
            <div className="bg-card p-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/60 mb-3">
                ACTIVE USERS
              </div>
              <div className="flex items-end gap-2.5 mb-1.5">
                <span className="text-[28px] font-bold tracking-[-0.03em] text-foreground leading-none">14,821</span>
                <span className="text-[11px] font-semibold px-[7px] py-0.5 rounded mb-0.5 text-green-600 bg-green-50">
                  ↑ 6.2%
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground/60">2,847 today</div>
            </div>

            {/* Cell 3: Conversion */}
            <div className="bg-card p-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/60 mb-3">
                CONVERSION
              </div>
              <div className="flex items-end gap-2.5 mb-1.5">
                <span className="text-[28px] font-bold tracking-[-0.03em] text-foreground leading-none">3.82%</span>
                <span className="text-[11px] font-semibold px-[7px] py-0.5 rounded mb-0.5 text-red-600 bg-red-50">
                  ↓ 0.1pp
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground/60">Target: 4.0%</div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            White cells with shadow-sm. Three text tiers per cell. The 1px gap grid reads as a unified lifted panel.
          </p>
        </div>
      </div>
    </section>
  );
}
