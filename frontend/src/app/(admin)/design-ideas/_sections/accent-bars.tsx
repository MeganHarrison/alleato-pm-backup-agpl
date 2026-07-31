"use client";

export function AccentBarsSection() {
  return (
    <section id="accents">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">07</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Accent &amp; Indicator Bars — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">Same pattern — but status colors need more saturation to hold against white</p>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">

        {/* 1. Left border accent */}
        <div className="rounded-lg border-l-[3px] border-l-primary shadow-sm overflow-hidden">
          <div className="bg-card p-4 px-5">
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] text-primary bg-primary/[0.07] border border-primary/20 px-[7px] py-0.5 rounded-sm mb-2">
              Active
            </span>
            <p className="text-[13px] font-semibold text-foreground mb-1">Left border accent</p>
            <p className="text-[12px] text-muted-foreground/60 leading-[1.5]">
              3px solid accent. The card behind it is white with shadow-sm for elevation.
            </p>
          </div>
        </div>

        {/* 2. Top status stripe */}
        <div className="rounded-lg border-t-2 border-t-green-600 shadow-sm overflow-hidden">
          <div className="bg-card p-4 px-5">
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] text-green-600 bg-green-50 border border-green-600/20 px-[7px] py-0.5 rounded-sm mb-2">
              Healthy
            </span>
            <p className="text-[13px] font-semibold text-foreground mb-1">Top status stripe</p>
            <p className="text-[12px] text-muted-foreground/60 leading-[1.5]">
              2px solid green on top. Green needs to be #16a34a in light mode for proper contrast.
            </p>
          </div>
        </div>

        {/* 3. Tinted background */}
        <div className="bg-primary/[0.07] rounded-lg border border-primary/20 p-4 px-5">
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] text-primary bg-primary/[0.07] border border-primary/20 px-[7px] py-0.5 rounded-sm mb-2">
            Info
          </span>
          <p className="text-[13px] font-semibold text-foreground mb-1">Tinted background callout</p>
          <p className="text-[12px] text-muted-foreground/60 leading-[1.5]">
            7% opacity accent background with 20% border. No shadow — background provides depth.
          </p>
        </div>

        {/* 4. Warning callout */}
        <div className="bg-amber-50 rounded-lg border border-amber-600/[0.22] p-4 px-5">
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] text-amber-600 bg-amber-50 border border-amber-600/20 px-[7px] py-0.5 rounded-sm mb-2">
            Warning
          </span>
          <p className="text-[13px] font-semibold text-foreground mb-1">Warning callout</p>
          <p className="text-[12px] text-muted-foreground/60 leading-[1.5]">
            Amber at #d97706 (not #f59e0b). Darker tone maintains contrast ratio on white backgrounds.
          </p>
        </div>

      </div>
    </section>
  );
}
