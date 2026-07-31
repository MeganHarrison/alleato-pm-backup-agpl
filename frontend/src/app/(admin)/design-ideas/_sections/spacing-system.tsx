"use client";

const SPACING_ROWS = [
  { label: "4px", widthClass: "w-1", use: "Icon-to-label, badge padding, micro gaps" },
  { label: "8px", widthClass: "w-2", use: "Tight inline spacing, icon margins" },
  { label: "12px", widthClass: "w-3", use: "Compact form fields, small component internals" },
  { label: "16px", widthClass: "w-4", use: "Standard padding — buttons, inputs, nav items" },
  { label: "24px", widthClass: "w-6", use: "Card/panel internal padding — default" },
  { label: "32px", widthClass: "w-8", use: "Between related groups within a section" },
  { label: "48px", widthClass: "w-12", use: "Between major sections on a page" },
  { label: "64px", widthClass: "w-16", use: "Page top/bottom padding, hero sections" },
];

export function SpacingSystemSection() {
  return (
    <section id="spacing">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">16</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Spacing System</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">Identical to dark mode — the 8pt grid is universal</p>
        </div>
      </div>

      {/* Spacing Ruler */}
      <div className="flex flex-col gap-1 mb-4">
        {SPACING_ROWS.map((row) => (
          <div key={row.label} className="flex items-center gap-4">
            <span className="font-mono text-[11px] text-muted-foreground/40 w-[72px] shrink-0 text-right">
              {row.label}
            </span>
            <div className={`${row.widthClass} h-2 bg-primary rounded-sm opacity-50`} />
            <span className="text-xs text-muted-foreground/60 ml-1">{row.use}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
