"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { stateLabel } from "@/lib/procore-route-map";

interface Screenshot {
  stateId: string;
  label: string;
  src: string;
}

interface Props {
  feature: string | null;
  onExpandedChange?: (expanded: boolean) => void;
}

export function ScreenshotsTab({ feature, onExpandedChange }: Props) {
  const [screenshots, setScreenshots] = React.useState<Screenshot[]>([]);
  // Start as true so we never flash "no screenshots" before the first fetch
  const [loading, setLoading] = React.useState(true);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  const selectIndex = React.useCallback((idx: number | null) => {
    setSelectedIndex(idx);
    onExpandedChange?.(idx !== null);
  }, [onExpandedChange]);

  React.useEffect(() => {
    if (!feature) {
      setLoading(false);
      return;
    }
    setLoading(true);
    selectIndex(null);
    fetch(`/api/procore-screenshots/${feature}`)
      .then((r) => r.json())
      .then((data: { stateIds?: string[] }) => {
        const ids = data.stateIds ?? [];
        setScreenshots(
          ids.map((id) => ({
            stateId: id,
            label: stateLabel(id),
            src: `/api/procore-screenshots/${feature}/${id}.png`,
          })),
        );
      })
      .catch(() => setScreenshots([]))
      .finally(() => setLoading(false));
  }, [feature, selectIndex]);

  const selected = selectedIndex !== null ? screenshots[selectedIndex] : null;

  const goPrev = () => selectIndex(selectedIndex !== null ? Math.max(0, selectedIndex - 1) : 0);
  const goNext = () => selectIndex(selectedIndex !== null ? Math.min(screenshots.length - 1, selectedIndex + 1) : 0);

  if (loading) return <Empty>Loading screenshots…</Empty>;
  if (!feature) return <Empty>No Procore reference for this page.</Empty>;
  if (screenshots.length === 0) return <Empty>No screenshots found for {feature.replace(/-/g, " ")}.</Empty>;

  /* ── Thumbnail strip ── */
  if (selectedIndex === null) {
    return (
      <div className="flex h-full items-start gap-3 overflow-x-auto px-4 py-2.5">
        {screenshots.map((shot, i) => (
          <button
            key={shot.stateId}
            type="button"
            onClick={() => selectIndex(i)}
            aria-label={`View ${shot.label}`}
            className="group flex shrink-0 flex-col overflow-hidden rounded-md border border-border bg-muted hover:border-primary/50 transition-colors"
          >
            <div className="relative h-40 w-60 overflow-hidden">
              { }
              <img
                src={shot.src}
                alt={shot.label}
                className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]"
                loading="lazy"
              />
            </div>
            <p className="px-2.5 py-1.5 text-left text-[11px] font-medium text-foreground">
              {shot.label}
            </p>
          </button>
        ))}
      </div>
    );
  }

  /* ── Expanded view ── */
  return (
    <div className="flex h-full">
      {/* Mini list */}
      <div className="w-44 shrink-0 overflow-y-auto border-r border-border/50 p-1.5 flex flex-col gap-0.5">
        {screenshots.map((shot, i) => (
          <button
            key={shot.stateId}
            type="button"
            onClick={() => selectIndex(i)}
            aria-label={`View ${shot.label}`}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors",
              i === selectedIndex
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <div className="h-7 w-10 shrink-0 overflow-hidden rounded border border-border/50 bg-muted">
              { }
              <img src={shot.src} alt="" className="h-full w-full object-cover object-top" />
            </div>
            <span className="truncate leading-tight">{shot.label}</span>
          </button>
        ))}
      </div>

      {/* Large image */}
      <div className="relative flex flex-1 items-center justify-center overflow-auto bg-muted/30 p-3">
        { }
        <img
          src={selected?.src ?? ""}
          alt={selected?.label ?? ""}
          className="max-h-full max-w-full rounded border border-border/40 object-contain shadow-sm"
        />
        {/* Prev/next overlays */}
        {screenshots.length > 1 && (
          <>
            <button
              type="button"
              disabled={selectedIndex === 0}
              onClick={goPrev}
              aria-label="Previous"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow hover:bg-background disabled:opacity-20"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={selectedIndex === screenshots.length - 1}
              onClick={goNext}
              aria-label="Next"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow hover:bg-background disabled:opacity-20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Back link shown inline in the nav area — handled by parent header */}
    </div>
  );
}

/* ── Expose selected state upward via a simple callback prop ── */
export type { Screenshot };

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
