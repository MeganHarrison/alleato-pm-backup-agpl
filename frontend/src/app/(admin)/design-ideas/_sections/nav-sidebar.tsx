"use client";

import { Button } from "@/components/ui/button";

export function NavSidebarSection() {
  return (
    <section id="nav-pattern">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">11</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Navigation Sidebar — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            Active items use accent-tinted background — not a filled color block
          </p>
        </div>
      </div>

      {/* Nav Demo */}
      <div className="grid grid-cols-[220px_1fr] gap-px bg-border rounded-xl overflow-hidden min-h-[380px] shadow-sm mb-4">

        {/* Left Sidebar */}
        <div className="bg-card p-4 px-2">

          {/* Workspace Header */}
          <div className="flex items-center gap-2 p-2 rounded-md mb-5 cursor-pointer hover:bg-muted">
            <div className="w-6 h-6 rounded-md bg-primary shrink-0 flex items-center justify-center text-[11px] font-bold text-white">
              M
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground truncate">Megan Harrison LLC</div>
              <div className="text-[11px] text-muted-foreground/60">Admin · Pro plan</div>
            </div>
          </div>

          {/* Section: MAIN */}
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40 px-2 mb-[3px] mt-5">
            Main
          </div>

          {/* Nav: Dashboard (Active) */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors bg-primary/[0.07] text-primary font-semibold">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0"
              aria-hidden="true"
            >
              <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
              <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
              <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
              <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
            </svg>
            Dashboard
          </div>

          {/* Nav: Activity */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors text-muted-foreground/60 hover:bg-muted hover:text-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0"
              aria-hidden="true"
            >
              <path d="M1 7h2.5l2-4 3 8 2-6 1.5 2H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Activity
            <span className="ml-auto text-[11px] font-mono bg-muted px-1.5 py-px rounded text-muted-foreground/60 border border-border">
              12
            </span>
          </div>

          {/* Nav: Projects */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors text-muted-foreground/60 hover:bg-muted hover:text-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0"
              aria-hidden="true"
            >
              <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1 6h12" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 1l-.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M9 1l.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Projects
          </div>

          {/* Section: WORKSPACE */}
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40 px-2 mb-[3px] mt-5">
            Workspace
          </div>

          {/* Nav: Integrations */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors text-muted-foreground/60 hover:bg-muted hover:text-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0"
              aria-hidden="true"
            >
              <circle cx="4" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="10" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6.5 7h1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Integrations
          </div>

          {/* Nav: Team */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors text-muted-foreground/60 hover:bg-muted hover:text-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0"
              aria-hidden="true"
            >
              <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="9.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1 12c0-2.21 1.79-4 4-4h0c2.21 0 4 1.79 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M9.5 8.5c1.38.35 2.5 1.6 2.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Team
            <span className="ml-auto text-[11px] font-mono bg-muted px-1.5 py-px rounded text-muted-foreground/60 border border-border">
              3
            </span>
          </div>

          {/* Nav: Settings */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors text-muted-foreground/60 hover:bg-muted hover:text-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            Settings
          </div>
        </div>

        {/* Right Content Area */}
        <div className="bg-muted/50 p-6 px-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
            <div>
              {/* Breadcrumb */}
              <div className="text-xs text-muted-foreground/60">
                <span>Workspace</span>
                <span className="opacity-40 mx-1">›</span>
                <span className="text-muted-foreground">Dashboard</span>
              </div>
              <div className="text-base font-semibold tracking-[-0.01em] text-foreground mt-1">Dashboard</div>
            </div>
            <Button size="sm">
              + New Project
            </Button>
          </div>

          {/* Body Text */}
          <p className="text-[13px] text-muted-foreground/60 leading-[1.6]">
            Note how the active nav item uses{" "}
            <strong className="text-muted-foreground">
              accent-tinted background + accent text color
            </strong>{" "}
            — not a solid filled block. This keeps the sidebar feeling light and scannable instead of visually heavy.
          </p>
        </div>
      </div>
    </section>
  );
}
