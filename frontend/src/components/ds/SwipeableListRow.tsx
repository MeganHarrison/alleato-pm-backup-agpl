"use client";

/**
 * SwipeableListRow
 *
 * Wraps a list row so that on touch devices the user can swipe left to reveal
 * Edit + Delete action buttons (iOS Mail / Linear inbox pattern). On non-touch
 * pointers the wrapper is a passthrough — the row behaves like a normal click
 * target.
 *
 * The row content is rendered inside a horizontally-translating layer. Two
 * action buttons sit behind it on the right edge, revealed as the layer moves
 * left. A tap outside the action zone snaps the row closed.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REVEAL_WIDTH = 160; // px — width of the two action buttons (2 × w-20)
const OPEN_THRESHOLD = 56; // px past which we snap open on release
const DIRECTION_LOCK = 8; // px before we decide horizontal vs vertical

interface SwipeableListRowProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  /** Disable swipe entirely (e.g. when the row is selected in a split view). */
  disabled?: boolean;
}

export function SwipeableListRow({
  children,
  onEdit,
  onDelete,
  className,
  disabled = false,
}: SwipeableListRowProps) {
  const [translate, setTranslate] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTranslate = useRef(0);
  const lockedAxis = useRef<"x" | "y" | null>(null);

  const isOpen = translate <= -OPEN_THRESHOLD;

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (disabled) return;
      const touch = event.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      startTranslate.current = translate;
      lockedAxis.current = null;
      setIsDragging(true);
    },
    [disabled, translate],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (disabled || !isDragging) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;

      if (lockedAxis.current === null) {
        if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) {
          return;
        }
        lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (lockedAxis.current !== "x") return;

      // Drag follows the finger; clamp so we can't drag past the reveal width
      // or pull the row right of its closed position.
      const next = Math.min(0, Math.max(-REVEAL_WIDTH, startTranslate.current + dx));
      setTranslate(next);
    },
    [disabled, isDragging],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (lockedAxis.current !== "x") return;
    setTranslate((current) => (current <= -OPEN_THRESHOLD ? -REVEAL_WIDTH : 0));
  }, []);

  const close = useCallback(() => setTranslate(0), []);

  // Close on outside tap when open.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    function handleDocPointer(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener("pointerdown", handleDocPointer);
    return () => document.removeEventListener("pointerdown", handleDocPointer);
  }, [isOpen, close]);

  return (
    <div
      ref={rootRef}
      className={cn("relative isolate overflow-hidden", className)}
    >
      {/* Action buttons sit behind the row */}
      <div
        className="absolute inset-y-0 right-0 z-0 flex items-stretch"
        aria-hidden={!isOpen}
      >
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              close();
              onEdit();
            }}
            className="flex h-full w-20 items-center justify-center rounded-none bg-muted px-3 text-sm font-medium text-foreground hover:bg-muted/80"
            tabIndex={isOpen ? 0 : -1}
          >
            Edit
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              close();
              onDelete();
            }}
            className="flex h-full w-20 items-center justify-center gap-1.5 rounded-none bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:opacity-90"
            tabIndex={isOpen ? 0 : -1}
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </Button>
        )}
      </div>

      {/* Foreground row */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translate3d(${translate}px, 0, 0)`,
          transition: isDragging ? "none" : "transform 180ms ease",
        }}
        className="relative z-10 bg-background"
      >
        {children}
      </div>
    </div>
  );
}
