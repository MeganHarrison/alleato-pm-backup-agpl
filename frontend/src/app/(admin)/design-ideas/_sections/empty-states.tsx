"use client";

import { Button } from "@/components/ui/button";

export function EmptyStatesSection() {
  return (
    <section id="empty">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">15</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Empty States</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            Icon background uses accent-subtle — carries the brand color into the empty state
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-border shadow-sm mb-6">
        {/* Wrong side */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-600 bg-red-50 px-2 py-[3px] rounded mb-5">
            ✗ Wrong
          </div>

          <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
            <span className="text-[13px] text-muted-foreground/60">No data available.</span>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            Bare text with no visual hierarchy, icon, or call to action. The user has no context or next step.
          </p>
        </div>

        {/* Right side */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-green-600 bg-green-50 px-2 py-[3px] rounded mb-5">
            ✓ Right
          </div>

          <div className="flex flex-col items-center justify-center min-h-[200px] text-center gap-3">
            <div className="w-12 h-12 bg-primary/[0.07] rounded-xl border border-primary/20 flex items-center justify-center text-xl mb-1">
              📊
            </div>
            <p className="text-[15px] font-semibold text-foreground">No projects yet</p>
            <p className="text-[13px] text-muted-foreground/60 leading-[1.6] max-w-[240px]">
              Create your first project to start tracking metrics and managing your team&apos;s work.
            </p>
            <Button size="sm" className="mt-1">
              Create project
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            Accent-tinted icon container, clear headline, descriptive body copy, and a single action button.
          </p>
        </div>
      </div>
    </section>
  );
}
