"use client";

export function ElevationSection() {
  return (
    <section id="elevation">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">01</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Surface Elevation — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">White is elevated. The page canvas is slightly gray. Panels float above it.</p>
        </div>
      </div>

      <div className="bg-primary/[0.07] border border-primary/20 rounded-lg px-[18px] py-[14px] text-[13px] text-muted-foreground leading-[1.6] my-5">
        <strong className="text-foreground">Critical inversion:</strong> In dark mode, deeper = darker. In light mode, elevated = whiter. Your sidebar and cards should be #ffffff — the background behind them is the gray. This is how Notion, Linear light, and Vercel light all work.
      </div>

      {/* Elevation Strip */}
      <div className="flex gap-px bg-border rounded-xl overflow-hidden shadow-sm mb-6">
        {/* Layer 0 */}
        <div className="flex-1 bg-background p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Layer 0 — Canvas</div>
          <div className="font-mono text-[11px] text-muted-foreground/40 mb-1">#f0f0f3</div>
          <div className="text-[11px] text-muted-foreground/60 mt-1">Page background. Cool gray — never pure white. Everything sits on top of this.</div>
          <div className="mt-3 text-[10px] font-mono text-muted-foreground/40">bg-background</div>
        </div>

        {/* Layer 1 */}
        <div className="flex-1 bg-card p-5 border border-black/5">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Layer 1 — Panels</div>
          <div className="font-mono text-[11px] text-muted-foreground/40 mb-1">#ffffff</div>
          <div className="text-[11px] text-muted-foreground/60 mt-1">Sidebar, cards, modals. Pure white = visually elevated off the canvas.</div>
          <div className="mt-3 text-[10px] font-mono text-muted-foreground/40">bg-card</div>
        </div>

        {/* Layer 2 */}
        <div className="flex-1 bg-muted/50 p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Layer 2 — Nested</div>
          <div className="font-mono text-[11px] text-muted-foreground/40 mb-1">#f8f8fb</div>
          <div className="text-[11px] text-muted-foreground/60 mt-1">Backgrounds within panels. Slightly gray = recessed from white.</div>
          <div className="mt-3 text-[10px] font-mono text-muted-foreground/40">bg-muted/50</div>
        </div>

        {/* Layer 3 */}
        <div className="flex-1 bg-muted p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Layer 3 — Active</div>
          <div className="font-mono text-[11px] text-muted-foreground/40 mb-1">#ededf0</div>
          <div className="text-[11px] text-muted-foreground/60 mt-1">Hover states, selected rows, focused regions.</div>
          <div className="mt-3 text-[10px] font-mono text-muted-foreground/40">bg-muted</div>
        </div>

        {/* Layer 4 */}
        <div className="flex-1 bg-accent p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Layer 4 — Controls</div>
          <div className="font-mono text-[11px] text-muted-foreground/40 mb-1">accent</div>
          <div className="text-[11px] text-muted-foreground/60 mt-1">Input backgrounds, pressed states, active toggles.</div>
          <div className="mt-3 text-[10px] font-mono text-muted-foreground/40">bg-accent</div>
        </div>
      </div>

      {/* Compare Grid */}
      <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-border shadow-sm mb-6">
        {/* Wrong */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-600 bg-red-50 px-2 py-[3px] rounded mb-5">
            ✗ Wrong — white page, gray cards
          </div>
          <div className="bg-card rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted border border-border rounded-md p-3">
                <div className="text-[11px] font-semibold text-muted-foreground mb-1">Metric Card</div>
                <div className="text-xs text-muted-foreground/60">Revenue data</div>
              </div>
              <div className="bg-muted border border-border rounded-md p-3">
                <div className="text-[11px] font-semibold text-muted-foreground mb-1">Another Card</div>
                <div className="text-xs text-muted-foreground/60">Users data</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            Gray cards on white feels depressed, not elevated.
          </p>
        </div>

        {/* Right */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-green-600 bg-green-50 px-2 py-[3px] rounded mb-5">
            ✓ Right — gray canvas, white panels
          </div>
          <div className="bg-background rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card shadow-sm rounded-md p-3">
                <div className="text-[11px] font-semibold text-foreground mb-1">Metric Card</div>
                <div className="text-xs text-muted-foreground/60">Revenue data</div>
              </div>
              <div className="bg-card shadow-sm rounded-md p-3">
                <div className="text-[11px] font-semibold text-foreground mb-1">Another Card</div>
                <div className="text-xs text-muted-foreground/60">Users data</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            White panels on a gray canvas read as elevated. The subtle shadow reinforces that depth.
          </p>
        </div>
      </div>
    </section>
  );
}
