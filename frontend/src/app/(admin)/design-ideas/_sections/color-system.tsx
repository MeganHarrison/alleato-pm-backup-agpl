"use client";

const TEXT_COLORS = [
  {
    swatchClass: "bg-[rgba(0,0,0,0.88)]",
    name: "Primary",
    value: "rgba(0,0,0,0.88)",
    use: "Headings, values, active labels",
  },
  {
    swatchClass: "bg-[rgba(0,0,0,0.55)]",
    name: "Secondary",
    value: "rgba(0,0,0,0.55)",
    use: "Body text, descriptions. 55%, not 65%.",
  },
  {
    swatchClass: "bg-[rgba(0,0,0,0.38)]",
    name: "Tertiary",
    value: "rgba(0,0,0,0.38)",
    use: "Eyebrows, captions, section labels",
  },
  {
    swatchClass: "bg-[rgba(0,0,0,0.22)]",
    name: "Disabled",
    value: "rgba(0,0,0,0.22)",
    use: "Placeholders, truly inactive elements",
  },
];

const STATUS_COLORS = [
  {
    swatchClass: "bg-green-600",
    name: "Success",
    value: "#16a34a (not #22c55e)",
    use: "Darker green holds against white",
  },
  {
    swatchClass: "bg-amber-600",
    name: "Warning",
    value: "#d97706 (not #f59e0b)",
    use: "Darker amber — lighter would wash out",
  },
  {
    swatchClass: "bg-red-600",
    name: "Error",
    value: "#dc2626 (not #ef4444)",
    use: "Darker red — better contrast ratio",
  },
  {
    swatchClass: "bg-primary",
    name: "Accent",
    value: "#5b21b6 → brand orange",
    use: "Brand primary — maintains AA contrast",
  },
];

function ColorSwatchRow({ swatches }: { swatches: typeof TEXT_COLORS }) {
  return (
    <div className="flex gap-px bg-border rounded-lg overflow-hidden shadow-sm mb-4">
      {swatches.map((swatch) => (
        <div key={swatch.name} className="flex-1 bg-card p-4 flex flex-col gap-1.5">
          <div
            className={`w-6 h-6 rounded-md mb-1 border border-black/[0.08] ${swatch.swatchClass}`}
          />
          <span className="text-[11px] font-semibold text-muted-foreground">{swatch.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground/40">{swatch.value}</span>
          <span className="text-[10px] text-muted-foreground/60 leading-[1.4]">{swatch.use}</span>
        </div>
      ))}
    </div>
  );
}

export function ColorSystemSection() {
  return (
    <section id="colors">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">17</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Color System — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            All opacity values reference rgba(0,0,0,x). Status colors are darker/more saturated than dark mode equivalents.
          </p>
        </div>
      </div>

      {/* Text Colors */}
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-3">
        Text Colors — Dark on White
      </p>
      <ColorSwatchRow swatches={TEXT_COLORS} />

      {/* Status Colors */}
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-3">
        Status Colors — More Saturated for White Contrast
      </p>
      <ColorSwatchRow swatches={STATUS_COLORS} />

      {/* Callout */}
      <div className="bg-muted/50 rounded-lg border border-border px-5 py-4">
        <p className="text-[13px] text-muted-foreground leading-[1.6]">
          <span className="font-semibold text-foreground">The saturation rule:</span> Light mode status colors should be 1–2 shades darker than their dark mode equivalents. What reads clearly as #22c55e on a dark background needs to be #16a34a to maintain the same visual weight on white.
        </p>
      </div>
    </section>
  );
}
