"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Breakpoint = "sm" | "md" | "lg" | "xl";
type Orientation = "horizontal" | "vertical";
export type SplitPageVariant = "two-column" | "three-column";

interface SplitPageContextValue {
  isOpen: boolean;
  isDesktop: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export interface SplitPageProps {
  /** Two children by default: [left/top pane, right/bottom pane]. Add a third child with variant="three-column". */
  children: [ReactNode, ReactNode] | [ReactNode, ReactNode, ReactNode];
  /** Whether this split owns only the primary/detail panes or also an auxiliary rail. */
  variant?: SplitPageVariant;
  /** Breakpoint above which both panes are always visible */
  breakpoint?: Breakpoint;
  /** Desktop width for the first pane. Defaults to content/class sizing. */
  firstPaneWidth?: number | string;
  /** Whether the first pane is open on mobile by default */
  defaultIsOpen?: boolean;
  /** Layout direction */
  orientation?: Orientation;
  className?: string;
  firstPaneClassName?: string;
  secondPaneClassName?: string;
  thirdPaneClassName?: string;
}

type SplitPageFrameHeight = "content" | "viewport" | "fill";

export function getSplitPageFrameHeightClass(
  height: SplitPageFrameHeight,
): string {
  if (height === "viewport") return "h-svh";
  if (height === "fill") return "h-full flex-1";
  return "h-[calc(100dvh-5rem)]";
}

export interface SplitPageFrameProps extends React.ComponentPropsWithoutRef<"div"> {
  height?: SplitPageFrameHeight;
}

// ─── Media query hook ─────────────────────────────────────────────────────────

const BREAKPOINT_QUERIES: Record<Breakpoint, string> = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
};

function useMediaQuery(query: string): boolean {
  // Always start false (matches SSR) — useEffect corrects to real value after hydration
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SplitPageContext = createContext<SplitPageContextValue | null>(null);

export function useSplitPage(): SplitPageContextValue {
  const ctx = useContext(SplitPageContext);
  if (!ctx) throw new Error("useSplitPage must be used inside <SplitPage>");
  return ctx;
}

// ─── SplitPage ────────────────────────────────────────────────────────────────

export function SplitPage({
  children,
  variant = "two-column",
  breakpoint = "md",
  firstPaneWidth,
  defaultIsOpen = true,
  orientation = "horizontal",
  className,
  firstPaneClassName,
  secondPaneClassName,
  thirdPaneClassName,
}: SplitPageProps) {
  const [isOpen, setIsOpen] = useState(defaultIsOpen);
  const isDesktop = useMediaQuery(BREAKPOINT_QUERIES[breakpoint]);

  const [leftPane, rightPane, thirdPane] = children;
  const isHorizontal = orientation === "horizontal";
  const showThirdPane =
    variant === "three-column" && thirdPane !== undefined && isDesktop;
  const firstPaneStyle =
    isDesktop && isHorizontal && firstPaneWidth !== undefined
      ? {
          width:
            typeof firstPaneWidth === "number"
              ? `${firstPaneWidth}px`
              : firstPaneWidth,
        }
      : undefined;

  return (
    <SplitPageContext.Provider
      value={{
        isOpen,
        isDesktop,
        onOpen: () => setIsOpen(true),
        onClose: () => setIsOpen(false),
      }}
    >
      <div
        className={cn(
          "flex h-full w-full overflow-hidden",
          isHorizontal ? "flex-row" : "flex-col",
          className,
        )}
      >
        {/* First pane (left / top) */}
        <div
          style={firstPaneStyle}
          className={cn(
            "shrink-0 overflow-hidden",
            isHorizontal ? "h-full" : "w-full",
            isDesktop ? "block" : isOpen ? "block w-full flex-none" : "hidden",
            firstPaneClassName,
          )}
        >
          {leftPane}
        </div>

        {/* Second pane (right / bottom) */}
        <div
          className={cn(
            "flex-1 min-w-0 overflow-auto",
            isDesktop ? "block" : isOpen ? "hidden" : "block",
            secondPaneClassName,
          )}
        >
          {rightPane}
        </div>

        {/* Optional auxiliary pane (right / bottom rail) */}
        {showThirdPane ? (
          <div
            data-split-page-auxiliary-pane
            className={cn(
              "shrink-0 overflow-hidden",
              isHorizontal ? "h-full" : "w-full",
              thirdPaneClassName,
            )}
          >
            {thirdPane}
          </div>
        ) : null}
      </div>
    </SplitPageContext.Provider>
  );
}

export const SplitPageFrame = React.forwardRef<
  HTMLDivElement,
  SplitPageFrameProps
>(({ children, className, height = "content", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex min-h-0 w-full flex-col overflow-hidden",
      getSplitPageFrameHeightClass(height),
      className,
    )}
    {...props}
  >
    {children}
  </div>
));

SplitPageFrame.displayName = "SplitPageFrame";
