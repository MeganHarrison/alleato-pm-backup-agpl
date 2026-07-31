"use client";

export function TypographyScaleSection() {
  return (
    <section id="typography">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">03</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Typography Hierarchy — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">Text opacity values shift down in light mode. Secondary is 55%, not 65%.</p>
        </div>
      </div>

      {/* Typography Demo Panel */}
      <div className="bg-card rounded-xl p-8 shadow-sm">
        {/* Row 1: Eyebrow / Section Label */}
        <div className="flex items-baseline gap-4 py-2 border-b border-border">
          <div className="font-mono text-[10px] text-muted-foreground/40 shrink-0 leading-[1.6] whitespace-pre-line" style={{ width: "140px" }}>
            {"11px / 700\n0.08em tracking\nuppercase\nrgba(0,0,0,0.38)"}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            SECTION LABEL / EYEBROW
          </div>
        </div>

        {/* Row 2: Page Title */}
        <div className="flex items-baseline gap-4 py-2 border-b border-border">
          <div className="font-mono text-[10px] text-muted-foreground/40 shrink-0 leading-[1.6] whitespace-pre-line" style={{ width: "140px" }}>
            {"32px / 700\n-0.03em tracking\nlh: 1.1\nrgba(0,0,0,0.88)"}
          </div>
          <div className="text-[32px] font-bold tracking-[-0.03em] text-foreground leading-[1.1]">
            Page Title or Hero Number
          </div>
        </div>

        {/* Row 3: Section Heading */}
        <div className="flex items-baseline gap-4 py-2 border-b border-border">
          <div className="font-mono text-[10px] text-muted-foreground/40 shrink-0 leading-[1.6] whitespace-pre-line" style={{ width: "140px" }}>
            {"20px / 600\n-0.02em tracking\nlh: 1.2\nrgba(0,0,0,0.88)"}
          </div>
          <div className="text-xl font-semibold tracking-[-0.02em] text-foreground">
            Section Heading
          </div>
        </div>

        {/* Row 4: Subsection Title */}
        <div className="flex items-baseline gap-4 py-2 border-b border-border">
          <div className="font-mono text-[10px] text-muted-foreground/40 shrink-0 leading-[1.6] whitespace-pre-line" style={{ width: "140px" }}>
            {"14px / 600\n0em tracking\nlh: 1.4\nrgba(0,0,0,0.88)"}
          </div>
          <div className="text-sm font-semibold text-foreground">
            Subsection / Component Title
          </div>
        </div>

        {/* Row 5: Body Text */}
        <div className="flex items-baseline gap-4 py-2 border-b border-border">
          <div className="font-mono text-[10px] text-muted-foreground/40 shrink-0 leading-[1.6] whitespace-pre-line" style={{ width: "140px" }}>
            {"14px / 400\n0em tracking\nlh: 1.6\nrgba(0,0,0,0.55)"}
          </div>
          <div className="text-sm text-muted-foreground leading-[1.6]">
            Body text. 55% opacity dark-on-light (not 65% as in dark mode). Use for descriptions, supporting copy, and prose that accompanies UI elements.
          </div>
        </div>

        {/* Row 6: Caption */}
        <div className="flex items-baseline gap-4 py-2">
          <div className="font-mono text-[10px] text-muted-foreground/40 shrink-0 leading-[1.6] whitespace-pre-line" style={{ width: "140px" }}>
            {"12px / 400\n0em tracking\nlh: 1.5\nrgba(0,0,0,0.38)"}
          </div>
          <div className="text-xs text-muted-foreground/60 leading-[1.5]">
            Caption text, timestamps, metadata. 38% opacity — clearly tertiary.
          </div>
        </div>
      </div>
    </section>
  );
}
