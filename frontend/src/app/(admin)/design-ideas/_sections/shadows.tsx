"use client";

export function ShadowsSection() {
  return (
    <section id="shadows">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">02</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Shadow System ✦ Light Mode Exclusive</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">Shadows do the depth work that contrast does in dark mode. This section doesn&apos;t exist in dark mode.</p>
        </div>
      </div>

      <div className="bg-primary/[0.07] border border-primary/20 rounded-lg px-[18px] py-[14px] text-[13px] text-muted-foreground leading-[1.6] my-5">
        <strong className="text-foreground">The rule:</strong> In light mode, shadows are not decorative — they are structural. A white card on a gray background with no shadow reads as flat. The same card with shadow-sm reads as elevated. Always use at minimum shadow-sm on white surface components.
      </div>

      {/* Shadow Grid */}
      <div className="grid grid-cols-4 gap-5 mb-4">
        {/* None */}
        <div className="bg-card rounded-lg p-5">
          <div className="h-16 bg-card rounded-md mb-4" />
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">None</div>
          <div className="font-mono text-[10px] text-muted-foreground/40 mb-2">no shadow</div>
          <div className="text-[12px] text-muted-foreground/60 mt-2">Only for elements already inside a raised container.</div>
        </div>

        {/* Shadow SM */}
        <div className="bg-card rounded-lg p-5 shadow-sm">
          <div className="h-16 bg-card rounded-md shadow-sm mb-4" />
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Shadow SM</div>
          <div className="font-mono text-[10px] text-muted-foreground/40 mb-2 leading-[1.6]">
            0 1px 2px rgba(0,0,0,.06){"\n"}0 1px 3px rgba(0,0,0,.04)
          </div>
          <div className="text-[12px] text-muted-foreground/60 mt-2">Default for all white surface panels, cards, inputs.</div>
        </div>

        {/* Shadow MD */}
        <div className="bg-card rounded-lg p-5 shadow-sm">
          <div className="h-16 bg-card rounded-md shadow-sm mb-4" />
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Shadow MD</div>
          <div className="font-mono text-[10px] text-muted-foreground/40 mb-2 leading-[1.6]">
            0 4px 6px rgba(0,0,0,.06){"\n"}0 2px 4px rgba(0,0,0,.04)
          </div>
          <div className="text-[12px] text-muted-foreground/60 mt-2">Dropdowns, popovers, bento cells, KPI blocks.</div>
        </div>

        {/* Shadow LG */}
        <div className="bg-card rounded-lg p-5 shadow-sm">
          <div className="h-16 bg-card rounded-md shadow-sm mb-4" />
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Shadow LG</div>
          <div className="font-mono text-[10px] text-muted-foreground/40 mb-2 leading-[1.6]">
            0 10px 15px rgba(0,0,0,.07){"\n"}0 4px 6px rgba(0,0,0,.04)
          </div>
          <div className="text-[12px] text-muted-foreground/60 mt-2">Modals, command palettes, large overlays.</div>
        </div>
      </div>

      {/* Compare Grid */}
      <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-border shadow-sm mb-6">
        {/* Wrong */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-600 bg-red-50 px-2 py-[3px] rounded mb-5">
            ✗ Wrong — No shadows = flat, dead UI
          </div>
          <div className="bg-background p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-md p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Revenue</div>
                <div className="text-lg font-bold text-foreground">$248k</div>
              </div>
              <div className="bg-card rounded-md p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Users</div>
                <div className="text-lg font-bold text-foreground">14,821</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            Border-only cards feel stamped flat onto the page — no depth, no lift.
          </p>
        </div>

        {/* Right */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-green-600 bg-green-50 px-2 py-[3px] rounded mb-5">
            ✓ Right — Shadow-sm gives them life
          </div>
          <div className="bg-background p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card shadow-sm rounded-md p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Revenue</div>
                <div className="text-lg font-bold text-foreground">$248k</div>
              </div>
              <div className="bg-card shadow-sm rounded-md p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Users</div>
                <div className="text-lg font-bold text-foreground">14,821</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            Same color system, same borders — but shadow-sm added. The cards now float.
          </p>
        </div>
      </div>
    </section>
  );
}
