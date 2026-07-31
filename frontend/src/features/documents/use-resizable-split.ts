"use client";

import * as React from "react";

export function clampSplit(
  ratio: number,
  opts: { containerWidth: number; minPx: number; maxRatio?: number },
): number {
  const { containerWidth, minPx, maxRatio } = opts;
  if (containerWidth <= 0) return ratio;
  const minRatio = Math.min(0.5, minPx / containerWidth);
  const calculatedMaxRatio = Math.max(0.5, 1 - minPx / containerWidth);
  const boundedMaxRatio = Math.min(
    calculatedMaxRatio,
    maxRatio ?? calculatedMaxRatio,
  );
  const lo = Math.max(0, Math.min(minRatio, boundedMaxRatio));
  const hi = Math.min(1, Math.max(minRatio, boundedMaxRatio));
  return Math.min(hi, Math.max(lo, ratio));
}

const MIN_PANE_PX = 220;
const MAX_CONTENT_RATIO = 0.72;

export function useResizableSplit(storageKey: string, defaultRatio = 0.5) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = React.useState(defaultRatio);
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) {
        setRatio(Math.min(MAX_CONTENT_RATIO, parsed));
      }
    }
  }, [storageKey]);

  const persist = React.useCallback(
    (next: number) => {
      window.localStorage.setItem(storageKey, String(next));
    },
    [storageKey],
  );

  const onHandleDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const raw = (ev.clientX - rect.left) / rect.width;
        const next = clampSplit(raw, {
          containerWidth: rect.width,
          minPx: MIN_PANE_PX,
          maxRatio: MAX_CONTENT_RATIO,
        });
        setRatio(next);
      };
      const onUp = () => {
        draggingRef.current = false;
        setRatio((current) => {
          persist(current);
          return current;
        });
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [persist],
  );

  return { ratio, onHandleDown, containerRef };
}
