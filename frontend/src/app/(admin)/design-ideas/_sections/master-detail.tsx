"use client";

export function MasterDetailSection() {
  return (
    <section id="master-detail">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">09</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Master / Detail Split</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            Left panel white, right detail panel surface-2 — using elevation difference instead of a heavy border
          </p>
        </div>
      </div>

      {/* Demo Grid */}
      <div className="grid grid-cols-[280px_1fr] gap-px bg-border rounded-xl overflow-hidden min-h-[320px] shadow-sm mb-4">

        {/* Left — Master Pane */}
        <div className="bg-card">
          {/* Search Bar */}
          <div className="p-3 px-4 border-b border-border">
            <input
              type="text"
              placeholder="Search projects…"
              className="w-full bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-muted-foreground outline-none"
              readOnly
            />
          </div>

          {/* Item 1 — Selected */}
          <div className="flex items-start gap-3 p-3 px-4 border-b border-border bg-primary/[0.07] border-l-2 border-l-primary cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-primary shrink-0 flex items-center justify-center text-xs font-bold text-white">
              AG
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground">Alleato Group</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                Construction Dashboard · Active
              </div>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-start gap-3 p-3 px-4 border-b border-border bg-transparent hover:bg-muted cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-sky-600 shrink-0 flex items-center justify-center text-xs font-bold text-white">
              NS
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground">Nutrition Solutions</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                AI Chat Integration · Active
              </div>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex items-start gap-3 p-3 px-4 border-b border-border bg-transparent hover:bg-muted cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-green-600 shrink-0 flex items-center justify-center text-xs font-bold text-white">
              OC
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground">OpenClaw Deploy</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                Agent Pipeline · In Progress
              </div>
            </div>
          </div>

          {/* Item 4 */}
          <div className="flex items-start gap-3 p-3 px-4 bg-transparent hover:bg-muted cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-amber-600 shrink-0 flex items-center justify-center text-xs font-bold text-white">
              MH
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground">Megan Harrison LLC</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                Internal Tooling · Staging
              </div>
            </div>
          </div>
        </div>

        {/* Right — Detail Pane */}
        <div className="bg-muted/50 p-7">
          {/* Header */}
          <div className="flex items-start justify-between mb-6 pb-5 border-b border-border">
            <div>
              <div className="text-lg font-semibold tracking-[-0.02em] text-foreground">Alleato Group</div>
              <div className="text-[13px] text-muted-foreground/60 mt-1">
                Construction · Enterprise Plan · Since Jan 2024
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-green-600 bg-green-50 border border-green-600/20">
              Active
            </span>
          </div>

          {/* Props Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground/60 mb-1">
                Monthly Revenue
              </div>
              <div className="text-[13px] text-muted-foreground">$12,400</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground/60 mb-1">
                Primary Contact
              </div>
              <div className="text-[13px] text-muted-foreground">James R. · james@alleato.com</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground/60 mb-1">
                Last Activity
              </div>
              <div className="text-[13px] text-muted-foreground">2 hours ago</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground/60 mb-1">
                Stack
              </div>
              <div className="text-[13px] text-muted-foreground">Next.js · Supabase · OpenAI</div>
            </div>
          </div>

          {/* Milestones */}
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-3">
            Recent Milestones
          </div>

          {/* Milestone 1 */}
          <div className="flex gap-2.5 py-2 border-b border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600 mt-[5px] shrink-0" />
            <p className="text-xs text-muted-foreground/60 leading-[1.5]">
              RAG pipeline deployed to production — Fireflies integration live
            </p>
          </div>
          {/* Milestone 2 */}
          <div className="flex gap-2.5 py-2 border-b border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-[5px] shrink-0" />
            <p className="text-xs text-muted-foreground/60 leading-[1.5]">
              Meeting transcript ingestion complete — 240 docs indexed
            </p>
          </div>
          {/* Milestone 3 */}
          <div className="flex gap-2.5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-[5px] shrink-0" />
            <p className="text-xs text-muted-foreground/60 leading-[1.5]">
              Cloudflare Worker rate limit issue — under investigation
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
