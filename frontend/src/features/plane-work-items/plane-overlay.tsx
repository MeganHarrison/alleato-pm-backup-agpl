/**
 * Adapted from Plane's workspace overlay and portal layering conventions at
 * revision 39856932cd6b9bd17eab0920506d628190b47af2.
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md and /source for corresponding source information.
 */

"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import * as React from "react";

import {
  dialogContentMotion,
  dialogOverlayMotion,
} from "@/components/ui/dialog-motion";
import { cn } from "@/lib/utils";

const PlaneOverlayContext = React.createContext<HTMLElement | null>(null);

export function PlaneOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);

  return (
    <PlaneOverlayContext.Provider value={container}>
      {children}
      <div
        ref={setContainer}
        data-plane-overlay-host
        className="pointer-events-none absolute inset-0 z-[200]"
      />
    </PlaneOverlayContext.Provider>
  );
}

function usePlaneOverlayContainer() {
  return React.useContext(PlaneOverlayContext) ?? undefined;
}

const planeDialogContentSizes = {
  notification: "sm:max-w-lg",
  form: "sm:max-w-3xl lg:max-w-4xl",
  wide: "sm:max-w-5xl",
  fullscreen: "h-[calc(100svh-2rem)] sm:max-w-[calc(100vw-2rem)]",
} as const;

type PlaneDialogContentSize = keyof typeof planeDialogContentSizes;

const planeModalContentSizes = {
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full: "max-w-full",
  form: "max-w-3xl lg:max-w-4xl",
} as const;

type PlaneModalContentSize = keyof typeof planeModalContentSizes;

function PlaneDialogOverlay({ kind }: { kind: string }) {
  return (
    <DialogPrimitive.Overlay
      data-plane-overlay-content={`${kind}-overlay`}
      className={cn(
        "pointer-events-auto fixed inset-0 z-10 bg-black/50",
        dialogOverlayMotion,
      )}
    />
  );
}

export const PlaneDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
    size?: PlaneDialogContentSize;
  }
>(
  (
    {
      className,
      children,
      showCloseButton = true,
      size = "notification",
      ...props
    },
    ref,
  ) => {
    const container = usePlaneOverlayContainer();

    return (
      <DialogPrimitive.Portal container={container}>
        <PlaneDialogOverlay kind="dialog" />
        <DialogPrimitive.Content
          ref={ref}
          data-slot="dialog-content"
          data-plane-overlay-content="dialog"
          className={cn(
            "pointer-events-auto fixed left-1/2 top-1/2 z-20 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-sm outline-none",
            dialogContentMotion,
            planeDialogContentSizes[size],
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none xl:right-2 xl:top-2 xl:size-9">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
PlaneDialogContent.displayName = "PlaneDialogContent";

export const PlaneSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "top" | "right" | "bottom" | "left";
    showCloseButton?: boolean;
    showOverlay?: boolean;
  }
>(
  (
    {
      className,
      children,
      side = "right",
      showCloseButton = true,
      showOverlay = true,
      ...props
    },
    ref,
  ) => {
    const container = usePlaneOverlayContainer();

    return (
      <DialogPrimitive.Portal container={container}>
        {showOverlay ? <PlaneDialogOverlay kind="sheet" /> : null}
        <DialogPrimitive.Content
          ref={ref}
          data-slot="sheet-content"
          data-plane-overlay-content="sheet"
          className={cn(
            "pointer-events-auto fixed z-20 flex flex-col gap-4 overflow-y-auto bg-background shadow-sm transition-[transform,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:duration-[250ms] data-[state=open]:duration-[400ms] data-[state=open]:animate-in data-[state=closed]:animate-out",
            side === "right" && [
              "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
              "inset-y-0 right-0 h-dvh max-h-dvh w-full border-l sm:max-w-sm md:w-[60%] md:max-w-none lg:w-[45%]",
            ],
            side === "left" &&
              "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-dvh max-h-dvh w-3/4 border-r sm:max-w-sm",
            side === "top" &&
              "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
            side === "bottom" &&
              "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close className="text-muted-foreground focus-visible:ring-ring absolute right-4 top-4 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 disabled:pointer-events-none">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
PlaneSheetContent.displayName = "PlaneSheetContent";

export const PlaneModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideCloseButton?: boolean;
    size?: PlaneModalContentSize;
  }
>(
  (
    { className, children, hideCloseButton = false, size = "md", ...props },
    ref,
  ) => {
    const container = usePlaneOverlayContainer();

    return (
      <DialogPrimitive.Portal container={container}>
        <PlaneDialogOverlay kind="modal" />
        <DialogPrimitive.Content
          ref={ref}
          data-plane-overlay-content="modal"
          className={cn(
            "pointer-events-auto fixed left-1/2 top-1/2 z-20 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-sm outline-none sm:rounded-lg",
            dialogContentMotion,
            planeModalContentSizes[size],
            className,
          )}
          {...props}
        >
          {children}
          {!hideCloseButton ? (
            <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
PlaneModalContent.displayName = "PlaneModalContent";

export function PlaneDropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  const container = usePlaneOverlayContainer();

  return (
    <DropdownMenuPrimitive.Portal container={container}>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        data-plane-overlay-content="dropdown-menu"
        sideOffset={sideOffset}
        className={cn(
          "pointer-events-auto z-10 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-sm",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function PlanePopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const container = usePlaneOverlayContainer();

  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        data-plane-overlay-content="popover"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "pointer-events-auto z-10 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-sm outline-hidden",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PlaneSelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function PlaneSelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export function PlaneSelectContent({
  className,
  children,
  position = "popper",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const container = usePlaneOverlayContainer();

  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-plane-overlay-content="select"
        className={cn(
          "pointer-events-auto relative z-10 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-sm",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-0 data-[side=left]:-translate-x-0 data-[side=right]:translate-x-0 data-[side=top]:-translate-y-0",
          className,
        )}
        position={position}
        align={align}
        {...props}
      >
        <PlaneSelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <PlaneSelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export const PlaneAlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => {
  const container = usePlaneOverlayContainer();

  return (
    <AlertDialogPrimitive.Portal container={container}>
      <AlertDialogPrimitive.Overlay
        data-plane-overlay-content="alert-dialog-overlay"
        className={cn(
          "pointer-events-auto fixed inset-0 z-10 bg-black/50",
          dialogOverlayMotion,
        )}
      />
      <AlertDialogPrimitive.Content
        ref={ref}
        data-plane-overlay-content="alert-dialog"
        className={cn(
          "pointer-events-auto fixed left-1/2 top-1/2 z-20 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-sm outline-none sm:max-w-lg",
          dialogContentMotion,
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
});
PlaneAlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;
