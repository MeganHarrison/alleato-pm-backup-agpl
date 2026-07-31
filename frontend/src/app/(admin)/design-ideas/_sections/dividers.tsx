"use client";

export function DividersSection() {
  return (
    <section id="dividers">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">06</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Dividers — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">rgba(0,0,0,0.07) — needs slightly more opacity than dark mode to stay visible on white</p>
        </div>
      </div>

      {/* Compare Grid */}
      <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-border shadow-sm mb-6">

        {/* Wrong */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-600 bg-red-50 px-2 py-[3px] rounded mb-5">
            ✗ Wrong — Heavy or zero — both wrong
          </div>

          <div className="space-y-0">
            <div className="border-b-2 border-black/30 pb-4">
              <p className="text-[13px] font-semibold text-foreground">Section A</p>
              <p className="text-[13px] text-muted-foreground">Heavy border — too dominant</p>
            </div>
            <div className="border-b-2 border-black/30 py-4">
              <p className="text-[13px] font-semibold text-foreground">Section B</p>
              <p className="text-[13px] text-muted-foreground">Borders overpower content</p>
            </div>
            <div className="pt-4">
              <p className="text-[13px] font-semibold text-foreground">Section C</p>
              <p className="text-[13px] text-muted-foreground">No border here</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            At 30% opacity, borders draw more attention than the content.
          </p>
        </div>

        {/* Right */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-green-600 bg-green-50 px-2 py-[3px] rounded mb-5">
            ✓ Right — 7% opacity — barely there, perfectly readable
          </div>

          <div>
            <div className="pb-6 border-b border-border">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Profile Settings</p>
              <p className="text-[13px] text-muted-foreground">Display name, avatar, and personal info</p>
            </div>
            <div className="py-6 border-b border-border">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Notifications</p>
              <p className="text-[13px] text-muted-foreground">Email alerts and in-app preferences</p>
            </div>
            <div className="pt-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Security</p>
              <p className="text-[13px] text-muted-foreground">Password, sessions, and 2FA</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            rgba(0,0,0,0.07) creates a barely-there line that implies separation without drawing the eye.
          </p>
        </div>

      </div>
    </section>
  );
}
