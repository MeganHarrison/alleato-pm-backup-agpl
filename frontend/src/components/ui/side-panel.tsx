"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const SIDE_PANEL_WIDTHS = {
  xs: "min(100vw, 18rem)",
  compact: "min(100vw, 24rem)",
  sm: "min(100vw, 28rem)",
  md: "min(100vw, 34rem)",
  lg: "min(100vw, 42rem)",
  xl: "min(100vw, 54rem)",
} as const;

type SidePanelSize = keyof typeof SIDE_PANEL_WIDTHS;

function SidePanel({
  ...props
}: React.ComponentProps<typeof Sheet>) {
  return <Sheet {...props} />;
}

function SidePanelContent({
  className,
  children,
  size = "sm",
  style,
  "aria-describedby": ariaDescribedBy = undefined,
  ...props
}: React.ComponentProps<typeof SheetContent> & {
  size?: SidePanelSize;
}) {
  return (
    <SheetContent
      className={cn(
        "gap-0 overflow-hidden p-0 md:w-auto lg:w-auto",
        className,
      )}
      style={{
        ...style,
        width: SIDE_PANEL_WIDTHS[size],
        maxWidth: "100vw",
      }}
      aria-describedby={ariaDescribedBy}
      {...props}
    >
      {children}
    </SheetContent>
  );
}

function SidePanelHeader({
  className,
  ...props
}: React.ComponentProps<typeof SheetHeader>) {
  return (
    <SheetHeader
      className={cn("shrink-0 px-5 py-4", className)}
      {...props}
    />
  );
}

function SidePanelTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetTitle>) {
  return (
    <SheetTitle
      className={cn("text-base font-semibold leading-snug", className)}
      {...props}
    />
  );
}

function SidePanelBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-5 py-5", className)}
      {...props}
    />
  );
}

function SidePanelFooter({
  className,
  ...props
}: React.ComponentProps<typeof SheetFooter>) {
  return (
    <SheetFooter
      className={cn(
        "shrink-0 px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
};
