"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type BudgetOverlayVariant = "dialog" | "sheet";
type BudgetOverlaySize = "sm" | "md" | "lg" | "xl" | "full";

interface BudgetOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  variant?: BudgetOverlayVariant;
  size?: BudgetOverlaySize;
  className?: string;
}

interface BudgetOverlayHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actions?: React.ReactNode;
  showCloseButton?: boolean;
}

interface BudgetOverlayContextValue {
  onClose: () => void;
  presentation: "dialog" | "sheet" | "drawer";
}

const BudgetOverlayContext =
  React.createContext<BudgetOverlayContextValue | null>(null);

const DIALOG_SIZE_CLASSES: Record<BudgetOverlaySize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
  xl: "sm:max-w-6xl",
  full: "sm:max-w-none",
};

const SHEET_SIZE_CLASSES: Record<BudgetOverlaySize, string> = {
  sm: "md:w-[480px] lg:w-[520px]",
  md: "md:w-[560px] lg:w-[620px]",
  lg: "md:w-[680px] lg:w-[760px]",
  xl: "md:w-[760px] lg:w-[860px]",
  full: "md:w-[92vw] lg:w-[88vw]",
};

/**
 * BudgetOverlay provides a single responsive shell for budget dialogs and sheets.
 */
export function BudgetOverlay({
  open,
  onOpenChange,
  children,
  variant = "dialog",
  size = "md",
  className,
}: BudgetOverlayProps) {
  const isMobile = useIsMobile();
  const content = (
    <BudgetOverlayContext.Provider
      value={{
        onClose: () => onOpenChange(false),
        presentation: isMobile ? "drawer" : variant,
      }}
    >
      {children}
    </BudgetOverlayContext.Provider>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "flex min-h-0 flex-col bg-background p-0",
            "data-[vaul-drawer-direction=bottom]:inset-x-4 data-[vaul-drawer-direction=bottom]:bottom-4 data-[vaul-drawer-direction=bottom]:top-auto",
            "data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[calc(100dvh-2rem)]",
            "data-[vaul-drawer-direction=bottom]:rounded-2xl data-[vaul-drawer-direction=bottom]:border",
            className,
          )}
        >
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  if (variant === "sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className={cn(
            "w-full gap-0 p-0",
            SHEET_SIZE_CLASSES[size],
            className,
          )}
        >
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          DIALOG_SIZE_CLASSES[size],
          "grid w-[calc(100vw-2rem)] gap-0 overflow-hidden border border-border/80 bg-background p-0 shadow-sm",
          "max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] rounded-t-2xl rounded-b-none",
          "sm:w-auto sm:max-w-[calc(100vw-4rem)] sm:max-h-[calc(100dvh-4rem)] sm:rounded-2xl",
          className,
        )}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}

/**
 * BudgetOverlayHeader renders the shared title, description, and close treatment.
 */
export function BudgetOverlayHeader({
  title,
  description,
  subtitle,
  className,
  contentClassName,
  titleClassName,
  descriptionClassName,
  actions,
  showCloseButton = true,
}: BudgetOverlayHeaderProps) {
  const context = React.useContext(BudgetOverlayContext);

  if (!context) {
    throw new Error("BudgetOverlayHeader must be used within BudgetOverlay");
  }

  return (
    <div
      className={cn(
        "shrink-0 bg-background px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={cn("min-w-0 space-y-1", contentClassName)}>
          {subtitle ? (
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
          {context.presentation === "drawer" ? (
            <DrawerTitle
              className={cn(
                "text-left text-base font-semibold tracking-tight text-foreground sm:text-lg",
                titleClassName,
              )}
            >
              {title}
            </DrawerTitle>
          ) : context.presentation === "sheet" ? (
            <SheetTitle
              className={cn(
                "text-base font-semibold tracking-tight text-foreground sm:text-lg",
                titleClassName,
              )}
            >
              {title}
            </SheetTitle>
          ) : (
            <DialogTitle
              className={cn(
                "text-base font-semibold tracking-tight text-foreground sm:text-lg",
                titleClassName,
              )}
            >
              {title}
            </DialogTitle>
          )}
          {description ? (
            context.presentation === "drawer" ? (
              <DrawerDescription
                className={cn(
                  "text-left text-sm text-muted-foreground",
                  descriptionClassName,
                )}
              >
                {description}
              </DrawerDescription>
            ) : context.presentation === "sheet" ? (
              <SheetDescription
                className={cn(
                  "text-sm text-muted-foreground",
                  descriptionClassName,
                )}
              >
                {description}
              </SheetDescription>
            ) : (
              <DialogDescription
                className={cn(
                  "text-sm text-muted-foreground",
                  descriptionClassName,
                )}
              >
                {description}
              </DialogDescription>
            )
          ) : null}
        </div>
        <div className="flex items-start gap-2">
          {actions}
          {showCloseButton ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={context.onClose}
              className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close overlay"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * BudgetOverlayBody provides the standard scrollable content area.
 */
export function BudgetOverlayBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto bg-background", className)}>
      {children}
    </div>
  );
}

/**
 * BudgetOverlayFooter provides the standard action row.
 */
export function BudgetOverlayFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-auto shrink-0 border-t border-border bg-muted/40 px-4 py-4 sm:px-6",
        "flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end",
        "pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
